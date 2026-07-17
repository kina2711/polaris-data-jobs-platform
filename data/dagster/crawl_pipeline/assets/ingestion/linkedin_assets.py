import re
from datetime import datetime
from urllib.parse import quote

from bs4 import BeautifulSoup
from dagster import AssetExecutionContext, MaterializeResult, MetadataValue, asset

from ...resources.minio_resource import MinioResource
from ...resources.postgres_resource import PostgresResource
from ...utils.http_client import (
    build_session as build_http_session,
)
from ...utils.http_client import (
    extract_text,
    get_html,
    smart_sleep,
)
from ...utils.raw_jobs import upsert_raw_jobs

BASE = "https://www.linkedin.com"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/123.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Connection": "keep-alive",
}

KEYWORDS = [
    "data analyst",
    "data engineer",
    "analytics engineer",
    "business intelligence",
    "data scientist",
]


def build_session():
    return build_http_session(HEADERS)


@asset(group_name="ingestion")
def linkedin_search_pages_html(context: AssetExecutionContext):
    """Crawl LinkedIn search pages and save raw HTML to MinIO."""
    minio = MinioResource()
    s = build_session()

    qtpl = "https://www.linkedin.com/jobs/search?keywords={keyword}&location=Vietnam&position=1&pageNum=0&start={start}"
    jobs_per_page = 25
    pages_to_crawl = 2  # 2 pages = 50 jobs per keyword

    bucket_name = "raw-jobs"
    today_str = datetime.now().strftime("%Y-%m-%d")

    saved_files = []

    for keyword in KEYWORDS:
        kw_encoded = quote(keyword)
        for page in range(0, pages_to_crawl):
            start = page * jobs_per_page
            url = qtpl.format(keyword=kw_encoded, start=start)
            context.log.info(
                f"[LinkedIn] Crawling keyword '{keyword}' page {page + 1}: {url}"
            )
            html = get_html(s, url)
            if not html:
                break

            kw_safe = keyword.replace(" ", "-")
            object_name = (
                f"linkedin/search_pages/{today_str}/{kw_safe}_page_{page + 1}.html"
            )
            minio.put_object(bucket_name, object_name, html.encode("utf-8"))
            saved_files.append(object_name)
            smart_sleep(3.0, 6.0)

    return MaterializeResult(
        metadata={
            "total_pages_crawled": len(saved_files),
            "files": MetadataValue.json(saved_files),
        }
    )


@asset(group_name="ingestion", deps=["linkedin_search_pages_html"])
def linkedin_job_details_html(context: AssetExecutionContext):
    """Parse search pages from MinIO, get Job URLs, crawl details, save to MinIO."""
    minio = MinioResource()
    s = build_session()
    bucket_name = "raw-jobs"
    today_str = datetime.now().strftime("%Y-%m-%d")

    objects = minio.list_objects(
        bucket_name, prefix=f"linkedin/search_pages/{today_str}/"
    )
    job_urls = set()

    for obj in objects:
        html = minio.get_object(bucket_name, obj.object_name).decode("utf-8")
        soup = BeautifulSoup(html, "html.parser")
        # LinkedIn job cards in public search
        for a_tag in soup.select("a.base-card__full-link"):
            job_url = a_tag.get("href")
            if job_url:
                job_url = job_url.split("?")[0]  # clean query params
                job_url = job_url.replace("vn.linkedin.com", "www.linkedin.com")
                job_urls.add(job_url)

    context.log.info(f"[LinkedIn] Found {len(job_urls)} unique jobs to crawl.")

    saved_files = []
    for i, job_url in enumerate(list(job_urls)[:30]):  # Test scale 30 jobs
        context.log.info(f"[LinkedIn] Crawling job {i + 1}: {job_url}")
        html = get_html(s, job_url)
        if html:
            # try to extract job ID
            match = re.search(r"-(\d+)$", job_url)
            job_id = match.group(1) if match else str(i)

            object_name = f"linkedin/job_details/{today_str}/linkedin_{job_id}.html"
            minio.put_object(bucket_name, object_name, html.encode("utf-8"))
            saved_files.append(object_name)

        smart_sleep(2.0, 4.0)

    return MaterializeResult(
        metadata={
            "total_jobs_found": len(job_urls),
            "total_jobs_crawled": len(saved_files),
        }
    )


@asset(group_name="transformation", deps=["linkedin_job_details_html"])
def parsed_linkedin_jobs_postgresql(context: AssetExecutionContext):
    """Read Job HTMLs from MinIO, parse fields via Regex/BS4, save to Postgres."""
    minio = MinioResource()
    pg = PostgresResource()
    bucket_name = "raw-jobs"
    today_str = datetime.now().strftime("%Y-%m-%d")

    objects = minio.list_objects(
        bucket_name, prefix=f"linkedin/job_details/{today_str}/"
    )

    parsed_jobs = []

    for obj in objects:
        try:
            html = minio.get_object(bucket_name, obj.object_name).decode("utf-8")
            soup = BeautifulSoup(html, "html.parser")

            job_id = obj.object_name.split("/")[-1].replace(".html", "")

            title = extract_text(soup.select_one("h1.top-card-layout__title"))
            company = extract_text(soup.select_one("a.topcard__org-name-link"))
            location = extract_text(soup.select_one("span.topcard__flavor--bullet"))
            description = extract_text(
                soup.select_one(
                    "div.description__text, div.show-more-less-html__markup"
                )
            )

            # LinkedIn public usually doesn't show salary unless embedded in description
            salary = ""

            parsed_jobs.append(
                {
                    "id": job_id,
                    "title": title,
                    "company": company,
                    "location": location,
                    "salary": salary,
                    "experience": "",
                    "description": description,
                    "requirements": "",  # Typically merged into description on LinkedIn
                    "tags": "",
                    "source": "linkedin",
                    "url": f"https://www.linkedin.com/jobs/view/{job_id.replace('linkedin_', '')}",
                    "crawled_at": datetime.now(),
                }
            )
        except Exception as e:
            context.log.warning(f"Failed to parse {obj.object_name}: {e}")
            pass

    if not parsed_jobs:
        context.log.warning("No jobs parsed from LinkedIn!")
        return MaterializeResult(metadata={"parsed": 0})

    inserted_count = upsert_raw_jobs(pg.engine, parsed_jobs)

    return MaterializeResult(metadata={"parsed_records": inserted_count})
