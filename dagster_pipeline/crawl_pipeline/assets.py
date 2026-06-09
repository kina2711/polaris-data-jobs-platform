import os
import time

import psycopg2
import requests
from dagster import AssetExecutionContext, MaterializeResult, asset
from dagster_dbt import DbtCliResource, dbt_assets
from psycopg2.extras import RealDictCursor

# Import all specific crawler assets so Dagster registers them

dbt_project_dir = os.path.join(
    os.path.dirname(os.path.dirname(__file__)), "dbt_project"
)


# Create a consolidating asset that maps exactly to the dbt source `public.raw_jobs`
@asset(
    deps=[
        "parsed_topcv_jobs_postgresql",
        "parsed_itviec_jobs_postgresql",
        "parsed_linkedin_jobs_postgresql",
    ],
    key_prefix=["public"],
    name="raw_jobs",
    group_name="transformation",
)
def raw_jobs_sync(context: AssetExecutionContext):
    """Consolidates all parsed jobs into the public.raw_jobs table for dbt to consume."""
    context.log.info("All raw jobs parsed and inserted into Postgres. Ready for dbt.")
    return MaterializeResult()


# DBT depends on `public.raw_jobs` implicitly via manifest.json
@dbt_assets(manifest=os.path.join(dbt_project_dir, "target", "manifest.json"))
def dbt_transformation_assets(context: AssetExecutionContext, dbt: DbtCliResource):
    yield from dbt.cli(["build"], context=context).stream()


# AI Vectorization depends on DBT Transformation
@asset(group_name="ai_matching", deps=[dbt_transformation_assets])
def vectorized_jobs_ai(context: AssetExecutionContext):
    """Trigger the Next.js API to run AI Vectorization (Transformers.js)."""
    url = "http://crawl_web:3400/api/vectorize"

    context.log.info(f"Triggering Vectorization at {url}")
    try:
        response = requests.post(url, timeout=300)
        response.raise_for_status()
        data = response.json()
        context.log.info(f"Vectorization Response: {data}")
        return MaterializeResult(
            metadata={
                "message": data.get("message", "Success"),
                "status_code": response.status_code,
            }
        )
    except Exception as e:
        context.log.error(f"Vectorization failed: {e!s}")
        raise e


# Discord Notification depends on AI Vectorization (The final step)
@asset(group_name="notifications", deps=[vectorized_jobs_ai])
def discord_notification_asset(context: AssetExecutionContext):
    """Sends latest jobs to Discord webhook."""
    webhook_url = "https://discord.com/api/webhooks/1488215368534331623/S4xZ0dQAEGyAJMpgC0g5Yx-_meGA0h3OHjzgX0K_dJNS5Mf8tuN1JACCHEMakq0VZiYd"

    # Query latest jobs from DB
    try:
        conn = psycopg2.connect(
            host=os.environ.get("DAGSTER_PG_HOST", "postgresql_db"),
            database=os.environ.get("DAGSTER_POSTGRES_DB", "crawl_jobs_db"),
            user=os.environ.get("DAGSTER_POSTGRES_USER", "postgres"),
            password=os.environ.get("DAGSTER_POSTGRES_PASSWORD", "postgres"),
        )
        cur = conn.cursor(cursor_factory=RealDictCursor)
        # Fetch all jobs from the latest crawl batch (within the last hour of the most recent job)
        query = """
            SELECT id, title, company, location, salary, source, url 
            FROM raw_jobs 
            WHERE crawled_at >= (SELECT MAX(crawled_at) - INTERVAL '1 hour' FROM raw_jobs)
            ORDER BY crawled_at DESC
        """
        cur.execute(query)
        jobs = cur.fetchall()
        cur.close()
        conn.close()
    except Exception as e:
        context.log.error(f"Failed to query database for Discord alert: {e!s}")
        jobs = []

    if not jobs:
        context.log.info("No jobs found to send to Discord.")
        return MaterializeResult(metadata={"status": "No jobs found"})

    context.log.info(f"Sending {len(jobs)} jobs to Discord...")

    # Discord allows max 10 embeds per message.
    chunk_size = 10
    success_count = 0

    for i in range(0, len(jobs), chunk_size):
        chunk = jobs[i : i + chunk_size]
        embeds = []
        for job in chunk:
            # Map source to color
            color = 3066993  # Green default
            if job["source"] == "topcv":
                color = 2860844  # TopCV Green
            elif job["source"] == "itviec":
                color = 15158332  # ITViec Red
            elif job["source"] == "linkedin":
                color = 28666  # LinkedIn Blue

            # Handle missing URL
            job_url = job.get("url")
            if not job_url:
                if job["source"] == "itviec":
                    job_url = f"https://itviec.com/it-jobs/{job['id']}"
                elif job["source"] == "linkedin":
                    job_url = f"https://www.linkedin.com/jobs/view/{job['id']}"
                else:
                    job_url = f"https://www.topcv.vn/viec-lam/{job['id']}.html"

            embeds.append(
                {
                    "title": f"[{job['source'].upper()}] {job['title']}",
                    "url": job_url,
                    "color": color,
                    "fields": [
                        {
                            "name": "🏢 Công ty",
                            "value": job.get("company") or "N/A",
                            "inline": True,
                        },
                        {
                            "name": "📍 Địa điểm",
                            "value": job.get("location") or "N/A",
                            "inline": True,
                        },
                        {
                            "name": "💰 Mức lương",
                            "value": str(job.get("salary")) or "Thỏa thuận",
                            "inline": False,
                        },
                    ],
                }
            )

        payload = {
            "username": "crawl_job_data_Pipeline Bot",
            "avatar_url": "https://i.imgur.com/4M34hi2.png",
            "embeds": embeds,
        }

        try:
            res = requests.post(webhook_url, json=payload)
            res.raise_for_status()
            success_count += len(chunk)
            time.sleep(1)  # sleep to prevent rate limit
        except Exception as e:
            context.log.error(f"Failed to send chunk to Discord: {e!s}")

    context.log.info(
        f"Discord notification sent successfully for {success_count} jobs."
    )
    return MaterializeResult(metadata={"status": "Sent", "jobs_sent": success_count})
