from datetime import datetime
from urllib.parse import urljoin

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

BASE = "https://itviec.com"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/123.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Referer": "https://itviec.com/",
    "Connection": "keep-alive",
}

KEYWORDS = [
    "data-analyst",
    "data-engineer",
    "analytics-engineer",
    "business-intelligence",
    "data-scientist",
]


def build_session():
    return build_http_session(HEADERS)


@asset(group_name="ingestion")
def itviec_search_pages_html(context: AssetExecutionContext):
    """Crawl ITViec search pages and save raw HTML to MinIO."""
    minio = MinioResource()
    s = build_session()

    qtpl = "https://itviec.com/it-jobs/{keyword}?page={page}"
    pages_to_crawl = 2  # Giới hạn 2 trang mỗi keyword

    bucket_name = "raw-jobs"
    today_str = datetime.now().strftime("%Y-%m-%d")

    saved_files = []

    for keyword in KEYWORDS:
        for page in range(1, pages_to_crawl + 1):
            url = qtpl.format(keyword=keyword, page=page)
            context.log.info(
                f"[ITViec] Crawling keyword '{keyword}' page {page}: {url}"
            )
            html = get_html(s, url)
            if not html:
                break

            object_name = f"itviec/search_pages/{today_str}/{keyword}_page_{page}.html"
            minio.put_object(bucket_name, object_name, html.encode("utf-8"))
            saved_files.append(object_name)
            smart_sleep(1.5, 3.0)

    return MaterializeResult(
        metadata={
            "total_pages_crawled": len(saved_files),
            "files": MetadataValue.json(saved_files),
        }
    )


@asset(group_name="ingestion", deps=["itviec_search_pages_html"])
def itviec_job_details_html(context: AssetExecutionContext):
    """Parse search pages from MinIO, get Job URLs, crawl details, save to MinIO."""
    minio = MinioResource()
    s = build_session()
    bucket_name = "raw-jobs"
    today_str = datetime.now().strftime("%Y-%m-%d")

    objects = minio.list_objects(
        bucket_name, prefix=f"itviec/search_pages/{today_str}/"
    )
    job_urls = set()

    for obj in objects:
        html = minio.get_object(bucket_name, obj.object_name).decode("utf-8")
        soup = BeautifulSoup(html, "html.parser")
        # ITViec job items usually have class starting with 'job-card' or inside a specific list
        # Look for <a> tags inside h3 or h2
        for a_tag in soup.select("h3 a[href*='/it-jobs/']"):
            job_url = urljoin(BASE, a_tag.get("href").split("?")[0])
            job_urls.add(job_url)

    context.log.info(f"[ITViec] Found {len(job_urls)} unique jobs to crawl.")

    saved_files = []
    for i, job_url in enumerate(list(job_urls)[:30]):  # Test scale 30 jobs
        context.log.info(f"[ITViec] Crawling job {i + 1}: {job_url}")
        html = get_html(s, job_url)
        if html:
            job_id = job_url.split("/")[-1]
            object_name = f"itviec/job_details/{today_str}/itviec_{job_id}.html"
            minio.put_object(bucket_name, object_name, html.encode("utf-8"))
            saved_files.append(object_name)

        smart_sleep(1.0, 2.5)

    return MaterializeResult(
        metadata={
            "total_jobs_found": len(job_urls),
            "total_jobs_crawled": len(saved_files),
        }
    )


@asset(group_name="transformation", deps=["itviec_job_details_html"])
def parsed_itviec_jobs_postgresql(context: AssetExecutionContext):
    """Read Job HTMLs from MinIO, parse fields via Regex/BS4, save to Postgres."""
    minio = MinioResource()
    pg = PostgresResource()
    bucket_name = "raw-jobs"
    today_str = datetime.now().strftime("%Y-%m-%d")

    objects = minio.list_objects(bucket_name, prefix=f"itviec/job_details/{today_str}/")

    parsed_jobs = []

    for obj in objects:
        try:
            html = minio.get_object(bucket_name, obj.object_name).decode("utf-8")
            soup = BeautifulSoup(html, "html.parser")

            job_id = obj.object_name.split("/")[-1].replace(".html", "")
            title = extract_text(soup.select_one("h1"))

            # ITViec structure can vary, attempt to find common class names
            company = extract_text(
                soup.select_one(".employer-info__name, .company-name, h3.name")
            )

            # Location
            location = extract_text(soup.select_one(".location, .svg-icon__box"))

            # Salary
            salary = extract_text(
                soup.select_one(".salary-text, .salary, .svg-icon__box-salary")
            )

            # Description and requirements
            description = extract_text(
                soup.select_one(".job-description, .description")
            )
            requirements = extract_text(
                soup.select_one(
                    ".job-requirements, .requirements, .skills-requirements"
                )
            )

            # Tags
            tags = [extract_text(a) for a in soup.select(".job-tags .tag, .skill-tag")]

            parsed_jobs.append(
                {
                    "id": job_id,
                    "title": title,
                    "company": company,
                    "location": location,
                    "salary": salary,
                    "experience": "",  # Harder to extract cleanly on ITViec without deeper parsing
                    "description": description,
                    "requirements": requirements,
                    "tags": ", ".join(tags),
                    "source": "itviec",
                    "url": f"https://itviec.com/it-jobs/{job_id.replace('itviec_', '')}",
                    "crawled_at": datetime.now(),
                }
            )
        except Exception as e:
            context.log.warning(f"Failed to parse {obj.object_name}: {e}")
            pass

    if not parsed_jobs:
        context.log.warning("No jobs parsed from ITViec!")
        return MaterializeResult(metadata={"parsed": 0})

    inserted_count = upsert_raw_jobs(pg.engine, parsed_jobs)

    return MaterializeResult(metadata={"parsed_records": inserted_count})
