import os
import random
import re
import sys
import time
from datetime import datetime
from urllib.parse import urljoin

import pandas as pd
import requests
from bs4 import BeautifulSoup
from curl_cffi import requests as cffi_requests
from sqlalchemy import create_engine, text

# Set environment variables from secrets
DATABASE_URL = os.getenv("DATABASE_URL")
DISCORD_WEBHOOK_URL = os.getenv("DISCORD_WEBHOOK_URL")

if not DATABASE_URL:
    print("❌ ERROR: DATABASE_URL is not set.")
    sys.exit(1)

# Ensure DATABASE_URL works with sqlalchemy (if starting with postgres:// change to postgresql://)
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

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
    s = cffi_requests.Session(impersonate="chrome110")
    s.headers.update(HEADERS)
    return s


def smart_sleep(min_s=1.0, max_s=2.5):
    time.sleep(random.uniform(min_s, max_s))


def get_html(session, url: str) -> str:
    for attempt in range(1, 4):
        try:
            r = session.get(url, timeout=30)
            if r.status_code in [429, 403]:
                time.sleep(5 * attempt)
                continue
            r.raise_for_status()
            return r.text
        except Exception:
            time.sleep(2 * attempt)
    return ""


def extract_text(el) -> str:
    if not el:
        return ""
    t = el.get_text(" ", strip=True)
    return re.sub(r"\s+", " ", t) if t else ""


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


def main():
    print("🚀 Bắt đầu quá trình Cào dữ liệu Cloud Crawler...")
    s = build_session()
    qtpl = (
        "https://www.topcv.vn/tim-viec-lam-{keyword}?type_keyword=1&page={page}&sba=1"
    )
    pages_to_crawl = 2
    job_urls = set()

    # 1. Crawl Search Pages
    print("1️⃣ Crawling danh sách Job...")
    for keyword in KEYWORDS:
        for page in range(1, pages_to_crawl + 1):
            url = qtpl.format(keyword=keyword, page=page)
            html = get_html(s, url)
            if not html:
                break

            soup = BeautifulSoup(html, "html.parser")
            for job in soup.select("div.job-item-search-result"):
                a_title = job.select_one("h3.title a[href]")
                if a_title:
                    j_url = urljoin(BASE, a_title.get("href")).split("?")[0]
                    job_urls.add(j_url)
            smart_sleep()

    print(f"✅ Tìm thấy {len(job_urls)} jobs.")

    # 2. Setup DB Connection
    engine = create_engine(DATABASE_URL)
    with engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
        conn.execute(
            text("""
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
                crawled_at TIMESTAMP,
                embedding vector(384)
            );
        """)
        )

    existing_df = pd.read_sql("SELECT id FROM raw_jobs", engine)
    existing_ids = set(existing_df["id"].tolist())

    new_jobs = []

    # 3. Crawl Details
    print("2️⃣ Crawling Job chi tiết...")
    for job_url in list(job_urls)[:40]:  # Tối đa 40 job mới mỗi lần chạy
        job_id = job_url.split("/")[-1].replace(".html", "")
        if job_id in existing_ids:
            continue

        html = get_html(s, job_url)
        if not html:
            continue

        soup = BeautifulSoup(html, "html.parser")
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

        if title:
            new_jobs.append(
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
                    "url": job_url,
                    "crawled_at": datetime.now(),
                }
            )
        smart_sleep(0.5, 1.5)

    if not new_jobs:
        print("Trạng thái: Không có job nào mới cần thêm.")
        return

    print(f"✅ Đã cào {len(new_jobs)} jobs mới. Đang nạp AI Model...")

    # 4. Generate Embeddings using Sentence Transformers
    try:
        from sentence_transformers import SentenceTransformer

        model = SentenceTransformer("all-MiniLM-L6-v2")
        texts_to_embed = [
            f"Title: {j['title']}. Exp: {j['experience']}. Desc: {j['description']}. Req: {j['requirements']}"
            for j in new_jobs
        ]
        print("3️⃣ Đang tính toán Vector Embeddings...")
        embeddings = model.encode(texts_to_embed, normalize_embeddings=True)
        for i, job in enumerate(new_jobs):
            job["embedding"] = embeddings[i].tolist()
    except Exception as e:
        print(f"⚠️ Lỗi tạo embedding: {e}. Sẽ lưu None.")
        for job in new_jobs:
            job["embedding"] = None

    # 5. Insert to DB
    print("4️⃣ Lưu vào Database Neon...")
    for job in new_jobs:
        vec_str = (
            f"[{','.join(map(str, job['embedding']))}]" if job["embedding"] else "NULL"
        )
        insert_sql = text(f"""
            INSERT INTO raw_jobs (id, title, company, location, salary, experience, description, requirements, tags, source, url, crawled_at, embedding)
            VALUES (:id, :title, :company, :location, :salary, :experience, :description, :requirements, :tags, :source, :url, :crawled_at, {vec_str})
            ON CONFLICT (id) DO NOTHING;
        """)
        with engine.begin() as conn:
            conn.execute(insert_sql, {k: v for k, v in job.items() if k != "embedding"})

    print("✅ Đã lưu DB xong!")

    # 6. Discord Notification
    if DISCORD_WEBHOOK_URL:
        print("5️⃣ Gửi thông báo Discord...")
        content = f"🎉 **Polaris Data Jobs Bot**: Vừa thu thập và tính toán Vector thành công **{len(new_jobs)}** jobs mới từ TopCV."
        requests.post(
            DISCORD_WEBHOOK_URL,
            json={"username": "Polaris Data Jobs Bot", "content": content},
        )

    print("🎉 QUÁ TRÌNH HOÀN TẤT MỸ MÃN!")


if __name__ == "__main__":
    main()
