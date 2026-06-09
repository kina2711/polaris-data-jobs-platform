import random
import re
import time
from datetime import datetime
from urllib.parse import urljoin

import pandas as pd
from bs4 import BeautifulSoup
from curl_cffi import requests as cffi_requests
from dagster import AssetExecutionContext, MaterializeResult, MetadataValue, asset
from sqlalchemy import text

from .resources import MinioResource, PostgresResource

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


def build_session() -> cffi_requests.Session:
    # TopCV's Cloudflare often blocks default "chrome", "chrome110" or "chrome120" usually works better
    s = cffi_requests.Session(impersonate="chrome110")
    s.headers.update(HEADERS)
    try:
        s.get(BASE, timeout=20)
        time.sleep(1.0)
    except Exception:
        pass
    return s


def smart_sleep(min_s=1.2, max_s=2.8):
    time.sleep(random.uniform(min_s, max_s))


def get_html(session, url: str) -> str:
    for attempt in range(1, 6):
        try:
            r = session.get(url, timeout=30)
            if r.status_code in [429, 403]:
                retry_after = r.headers.get("Retry-After")
                wait = int(retry_after) if retry_after else 5 * attempt
                wait += random.uniform(1.0, 3.0)
                time.sleep(wait)
                continue
            r.raise_for_status()
            return r.text
        except Exception as e:
            if attempt == 5:
                print(f"Failed to fetch {url}: {e}")
                return ""
            time.sleep(2 * attempt)
    return ""


def extract_text(el) -> str:
    if not el:
        return ""
    t = el.get_text(" ", strip=True)
    return re.sub(r"\s+", " ", t) if t else ""


@asset(group_name="ingestion")
def topcv_search_pages_html(context: AssetExecutionContext):
    """Crawl TopCV search pages for multiple data keywords and save raw HTML to MinIO."""
    minio = MinioResource()
    s = build_session()

    qtpl = (
        "https://www.topcv.vn/tim-viec-lam-{keyword}?type_keyword=1&page={page}&sba=1"
    )
    pages_to_crawl = (
        2  # Giới hạn 2 trang mỗi keyword để test nhanh, tương lai có thể tăng lên
    )

    bucket_name = "raw-jobs"
    today_str = datetime.now().strftime("%Y-%m-%d")

    saved_files = []

    for keyword in KEYWORDS:
        for page in range(1, pages_to_crawl + 1):
            url = qtpl.format(keyword=keyword, page=page)
            context.log.info(f"[TopCV] Crawling keyword '{keyword}' page {page}: {url}")
            html = get_html(s, url)
            if not html:
                break

            object_name = f"topcv/search_pages/{today_str}/{keyword}_page_{page}.html"
            minio.put_object(bucket_name, object_name, html.encode("utf-8"))
            saved_files.append(object_name)
            smart_sleep(1.0, 2.0)

    return MaterializeResult(
        metadata={
            "total_pages_crawled": len(saved_files),
            "files": MetadataValue.json(saved_files),
        }
    )


@asset(group_name="ingestion", deps=["topcv_search_pages_html"])
def topcv_job_details_html(context: AssetExecutionContext):
    """Parse search pages from MinIO, get Job URLs, crawl details, save to MinIO."""
    minio = MinioResource()
    s = build_session()
    bucket_name = "raw-jobs"
    today_str = datetime.now().strftime("%Y-%m-%d")

    objects = minio.list_objects(bucket_name, prefix=f"topcv/search_pages/{today_str}/")
    job_urls = set()

    for obj in objects:
        html = minio.get_object(bucket_name, obj.object_name).decode("utf-8")
        soup = BeautifulSoup(html, "html.parser")
        for job in soup.select("div.job-item-search-result"):
            a_title = job.select_one("h3.title a[href]")
            if a_title:
                job_url = urljoin(BASE, a_title.get("href"))
                job_url = job_url.split("?")[0]
                job_urls.add(job_url)

    context.log.info(f"[TopCV] Found {len(job_urls)} unique jobs to crawl.")

    saved_files = []
    for i, job_url in enumerate(
        list(job_urls)[:30]
    ):  # Tăng giới hạn lên 30 để test scale đa dạng
        context.log.info(f"[TopCV] Crawling job {i + 1}: {job_url}")
        html = get_html(s, job_url)
        if html:
            job_id = job_url.split("/")[-1].replace(".html", "")
            object_name = f"topcv/job_details/{today_str}/{job_id}.html"
            minio.put_object(bucket_name, object_name, html.encode("utf-8"))
            saved_files.append(object_name)

        smart_sleep(0.5, 1.5)

    return MaterializeResult(
        metadata={
            "total_jobs_found": len(job_urls),
            "total_jobs_crawled": len(saved_files),
        }
    )


def pick_info_value(soup: BeautifulSoup, title: str) -> str:
    for sec in soup.select(".job-detail__info--section"):
        t = extract_text(sec.select_one(".job-detail__info--section-content-title"))
        if t.lower() == title.lower():
            v = sec.select_one(".job-detail__info--section-content-value")
            return extract_text(v) if v else extract_text(sec)
    return ""


def extract_desc_blocks(soup: BeautifulSoup):
    data = {}
    for item in soup.select(".job-description .job-description__item"):
        h3 = extract_text(item.select_one("h3"))
        content = item.select_one(".job-description__item--content")
        if content:
            data[h3] = extract_text(content)
    return data


@asset(group_name="transformation", deps=["topcv_job_details_html"])
def parsed_topcv_jobs_postgresql(context: AssetExecutionContext):
    """Read Job HTMLs from MinIO, parse fields via Regex/BS4, save to Postgres."""
    minio = MinioResource()
    pg = PostgresResource()
    bucket_name = "raw-jobs"
    today_str = datetime.now().strftime("%Y-%m-%d")

    objects = minio.list_objects(bucket_name, prefix=f"topcv/job_details/{today_str}/")

    parsed_jobs = []

    for obj in objects:
        html = minio.get_object(bucket_name, obj.object_name).decode("utf-8")
        soup = BeautifulSoup(html, "html.parser")

        job_id = obj.object_name.split("/")[-1].replace(".html", "")
        title = extract_text(soup.select_one(".job-detail__info--title, h1"))
        salary = pick_info_value(soup, "Mức lương")
        location = pick_info_value(soup, "Địa điểm")
        experience = pick_info_value(soup, "Kinh nghiệm")

        desc_blocks = extract_desc_blocks(soup)
        description = desc_blocks.get("Mô tả công việc", "")
        requirements = desc_blocks.get("Yêu cầu ứng viên", "")

        company = extract_text(soup.select_one("a.company-name")) or extract_text(
            soup.select_one("h2.company-name")
        )

        tags = [
            extract_text(a) for a in soup.select(".job-tags a.item") if extract_text(a)
        ]

        parsed_jobs.append(
            {
                "id": job_id,
                "title": title,
                "company": company,
                "location": location,
                "salary": salary,
                "experience": experience,
                "description": description,
                "requirements": requirements,
                "tags": ", ".join(tags),
                "source": "topcv",
                "url": f"https://www.topcv.vn/viec-lam/{job_id}.html",
                "crawled_at": datetime.now(),
            }
        )

    if not parsed_jobs:
        context.log.warning("No jobs parsed from TopCV!")
        return MaterializeResult(metadata={"parsed": 0})

    df = pd.DataFrame(parsed_jobs)

    create_table_sql = """
    CREATE TABLE IF NOT EXISTS raw_jobs (
        id VARCHAR PRIMARY KEY,
        title VARCHAR,
        company VARCHAR,
        location VARCHAR,
        salary VARCHAR,
        experience VARCHAR,
        description TEXT,
        requirements TEXT,
        tags VARCHAR,
        source VARCHAR,
        url VARCHAR,
        crawled_at TIMESTAMP
    );
    """
    with pg.engine.begin() as conn:
        conn.execute(text(create_table_sql))

    existing_ids_query = "SELECT id FROM raw_jobs"
    try:
        existing_df = pd.read_sql(existing_ids_query, pg.engine)
        existing_ids = existing_df["id"].tolist()
        df = df[~df["id"].isin(existing_ids)]
    except Exception as e:
        context.log.warning(f"Could not fetch existing IDs: {e}")

    inserted_count = 0
    if not df.empty:
        df.to_sql("raw_jobs", pg.engine, if_exists="append", index=False)
        inserted_count = len(df)

    return MaterializeResult(metadata={"parsed_records": inserted_count})
