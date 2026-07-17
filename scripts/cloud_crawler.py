"""Scheduled TopCV crawler for the canonical Polaris PostgreSQL raw_jobs table."""

from __future__ import annotations

import os
import random
import re
import sys
import time
from datetime import UTC, datetime
from typing import Any
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
from curl_cffi import requests as cffi_requests
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

DATABASE_URL = os.getenv("DATABASE_URL")
DISCORD_WEBHOOK_URL = os.getenv("DISCORD_WEBHOOK_URL")

BASE = "https://www.topcv.vn"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/123.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Referer": "https://www.topcv.vn/",
    "Connection": "keep-alive",
}
KEYWORDS = [
    "data-analyst",
    "data-engineer",
    "analytics-engineer",
    "business-intelligence",
    "data-scientist",
]
MAX_NEW_JOBS = 40
MAX_BACKFILL_JOBS = 100

RAW_JOBS_DDL = """
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE IF NOT EXISTS raw_jobs (
    id TEXT PRIMARY KEY,
    title TEXT,
    company TEXT,
    location TEXT,
    salary TEXT,
    experience TEXT,
    description TEXT,
    requirements TEXT,
    tags TEXT,
    source TEXT,
    url TEXT,
    crawled_at TIMESTAMP(3),
    embedding vector(384)
);
"""


def get_database_url() -> str:
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not set")
    if DATABASE_URL.startswith("postgres://"):
        return DATABASE_URL.replace("postgres://", "postgresql://", 1)
    return DATABASE_URL


def build_session() -> cffi_requests.Session:
    session = cffi_requests.Session(impersonate="chrome120")
    session.headers.update(HEADERS)
    return session


def smart_sleep(min_seconds: float = 1.0, max_seconds: float = 2.5) -> None:
    time.sleep(random.uniform(min_seconds, max_seconds))


def get_html(session: cffi_requests.Session, url: str) -> str:
    last_error: Exception | None = None
    for attempt in range(1, 4):
        try:
            response = session.get(url, timeout=30)
            if response.status_code in {403, 429}:
                last_error = RuntimeError(f"HTTP {response.status_code}")
                time.sleep(5 * attempt)
                continue
            response.raise_for_status()
            return response.text
        except Exception as error:  # network library exposes several exception types
            last_error = error
            time.sleep(2 * attempt)
    print(f"WARN: failed to fetch {url}: {last_error}", file=sys.stderr)
    return ""


def extract_text(element: Any) -> str:
    if not element:
        return ""
    value = element.get_text(" ", strip=True)
    return re.sub(r"\s+", " ", value) if value else ""


def pick_info_value(soup: BeautifulSoup, title: str) -> str:
    for section in soup.select(".job-detail__info--section"):
        heading = extract_text(
            section.select_one(".job-detail__info--section-content-title")
        )
        if heading.lower() == title.lower():
            value = section.select_one(".job-detail__info--section-content-value")
            return extract_text(value) if value else extract_text(section)
    return ""


def extract_desc_blocks(soup: BeautifulSoup) -> dict[str, str]:
    data: dict[str, str] = {}
    for item in soup.select(".job-description .job-description__item"):
        heading = extract_text(item.select_one("h3"))
        content = item.select_one(".job-description__item--content")
        if heading and content:
            data[heading] = extract_text(content)
    return data


def job_id_from_url(url: str) -> str:
    return url.rstrip("/").split("/")[-1].removesuffix(".html")


def discover_job_urls(session: cffi_requests.Session) -> set[str]:
    query_template = (
        "https://www.topcv.vn/tim-viec-lam-{keyword}?type_keyword=1&page={page}&sba=1"
    )
    urls: set[str] = set()
    for keyword in KEYWORDS:
        for page in range(1, 3):
            html = get_html(session, query_template.format(keyword=keyword, page=page))
            if not html:
                break
            soup = BeautifulSoup(html, "html.parser")
            for job in soup.select("div.job-item-search-result"):
                anchor = job.select_one("h3.title a[href]")
                if anchor and anchor.get("href"):
                    urls.add(urljoin(BASE, anchor["href"]).split("?")[0])
            smart_sleep()
    return urls


def crawl_job(session: cffi_requests.Session, job_url: str) -> dict[str, Any] | None:
    html = get_html(session, job_url)
    if not html:
        return None

    soup = BeautifulSoup(html, "html.parser")
    title = extract_text(soup.select_one(".job-detail__info--title, h1"))
    if not title:
        print(f"WARN: missing title for {job_url}", file=sys.stderr)
        return None

    blocks = extract_desc_blocks(soup)
    tags = [
        extract_text(anchor)
        for anchor in soup.select(".job-tags a.item")
        if extract_text(anchor)
    ]
    company = extract_text(soup.select_one("a.company-name")) or extract_text(
        soup.select_one("h2.company-name")
    )
    return {
        "id": job_id_from_url(job_url),
        "title": title,
        "company": company,
        "location": pick_info_value(soup, "Địa điểm"),
        "salary": pick_info_value(soup, "Mức lương"),
        "experience": pick_info_value(soup, "Kinh nghiệm"),
        "description": blocks.get("Mô tả công việc", ""),
        "requirements": blocks.get("Yêu cầu ứng viên", ""),
        "tags": ", ".join(tags),
        "source": "topcv",
        "url": job_url,
        "crawled_at": datetime.now(UTC).replace(tzinfo=None),
    }


def embedding_text(job: dict[str, Any]) -> str:
    return (
        f"Title: {job.get('title') or ''}. "
        f"Experience: {job.get('experience') or ''}. "
        f"Description: {job.get('description') or ''}. "
        f"Requirements: {job.get('requirements') or ''}"
    )


def encode_jobs(model: Any, jobs: list[dict[str, Any]]) -> None:
    if not jobs:
        return
    vectors = model.encode(
        [embedding_text(job) for job in jobs], normalize_embeddings=True
    )
    if len(vectors) != len(jobs):
        raise RuntimeError("Embedding model returned an unexpected vector count")
    for job, vector in zip(jobs, vectors, strict=True):
        values = vector.tolist()
        if len(values) != 384:
            raise RuntimeError(f"Expected a 384-dimensional vector for {job['id']}")
        job["embedding"] = f"[{','.join(map(str, values))}]"


def persist_new_jobs(
    engine: Engine, jobs: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    if not jobs:
        return []
    statement = text("""
        INSERT INTO raw_jobs (
            id, title, company, location, salary, experience, description,
            requirements, tags, source, url, crawled_at, embedding
        ) VALUES (
            :id, :title, :company, :location, :salary, :experience, :description,
            :requirements, :tags, :source, :url, :crawled_at,
            CAST(:embedding AS vector)
        )
        ON CONFLICT (id) DO NOTHING
        RETURNING id
    """)
    inserted_ids: set[str] = set()
    with engine.begin() as connection:
        # Keep one transaction, but execute each bounded candidate separately so
        # RETURNING identifies exactly which rows won a concurrent insert race.
        for job in jobs:
            inserted_id = connection.execute(statement, job).scalar_one_or_none()
            if inserted_id:
                inserted_ids.add(inserted_id)
    return [job for job in jobs if job["id"] in inserted_ids]


def backfill_embeddings(engine: Engine, model: Any) -> int:
    with engine.connect() as connection:
        rows = connection.execute(
            text("""
                SELECT id, title, experience, description, requirements
                FROM raw_jobs
                WHERE embedding IS NULL
                ORDER BY crawled_at ASC
                LIMIT :limit
            """),
            {"limit": MAX_BACKFILL_JOBS},
        ).mappings()
        jobs = [dict(row) for row in rows]

    encode_jobs(model, jobs)
    if not jobs:
        return 0

    with engine.begin() as connection:
        connection.execute(
            text("""
                UPDATE raw_jobs
                SET embedding = CAST(:embedding AS vector)
                WHERE id = :id AND embedding IS NULL
            """),
            [{"id": job["id"], "embedding": job["embedding"]} for job in jobs],
        )
    return len(jobs)


def truncate(value: str | None, limit: int = 1_000) -> str:
    text_value = value or "N/A"
    return text_value if len(text_value) <= limit else f"{text_value[: limit - 1]}…"


def notify_discord(jobs: list[dict[str, Any]]) -> None:
    if not DISCORD_WEBHOOK_URL or not jobs:
        return
    try:
        response = requests.post(
            DISCORD_WEBHOOK_URL,
            json={
                "username": "Polaris Data Jobs Bot",
                "content": f"Polaris collected {len(jobs)} new TopCV jobs.",
            },
            timeout=15,
        )
        response.raise_for_status()
        for job in jobs:
            embed = {
                "title": truncate(job["title"], 250),
                "url": job["url"],
                "color": 3447003,
                "fields": [
                    {
                        "name": "Company",
                        "value": truncate(job["company"]),
                        "inline": True,
                    },
                    {
                        "name": "Location",
                        "value": truncate(job["location"]),
                        "inline": True,
                    },
                    {
                        "name": "Salary",
                        "value": truncate(job["salary"]),
                        "inline": True,
                    },
                    {
                        "name": "Experience",
                        "value": truncate(job["experience"]),
                        "inline": True,
                    },
                ],
            }
            response = requests.post(
                DISCORD_WEBHOOK_URL,
                json={"username": "Polaris Data Jobs Bot", "embeds": [embed]},
                timeout=15,
            )
            response.raise_for_status()
            time.sleep(0.5)
    except requests.RequestException as error:
        print(f"WARN: Discord notification failed: {error}", file=sys.stderr)


def main() -> None:
    print("Starting Polaris cloud crawler.")
    session = build_session()
    discovered_urls = discover_job_urls(session)
    print(f"Discovered {len(discovered_urls)} unique TopCV URLs.")

    engine = create_engine(get_database_url(), pool_pre_ping=True)
    with engine.begin() as connection:
        connection.execute(text(RAW_JOBS_DDL))
        existing_ids = set(
            connection.execute(text("SELECT id FROM raw_jobs")).scalars()
        )

    candidate_urls = [
        url
        for url in sorted(discovered_urls)
        if job_id_from_url(url) not in existing_ids
    ][:MAX_NEW_JOBS]
    new_jobs: list[dict[str, Any]] = []
    for job_url in candidate_urls:
        job = crawl_job(session, job_url)
        if job:
            new_jobs.append(job)
        smart_sleep(0.5, 1.5)

    with engine.connect() as connection:
        needs_backfill = bool(
            connection.execute(
                text("SELECT 1 FROM raw_jobs WHERE embedding IS NULL LIMIT 1")
            ).scalar()
        )

    if new_jobs or needs_backfill:
        from sentence_transformers import SentenceTransformer

        model = SentenceTransformer("all-MiniLM-L6-v2")
        encode_jobs(model, new_jobs)
        inserted_jobs = persist_new_jobs(engine, new_jobs)
        backfilled = backfill_embeddings(engine, model)
    else:
        inserted_jobs = []
        backfilled = 0

    notify_discord(inserted_jobs)
    print(
        f"Polaris crawler complete: inserted={len(inserted_jobs)}, "
        f"backfilled_embeddings={backfilled}."
    )


if __name__ == "__main__":
    main()
