import time

import psycopg2
import requests
from psycopg2.extras import RealDictCursor

webhook_url = "https://discord.com/api/webhooks/1488215368534331623/S4xZ0dQAEGyAJMpgC0g5Yx-_meGA0h3OHjzgX0K_dJNS5Mf8tuN1JACCHEMakq0VZiYd"

conn = psycopg2.connect(
    host="postgresql_db", database="crawl_jobs_db", user="postgres", password="postgres"
)
cur = conn.cursor(cursor_factory=RealDictCursor)
cur.execute(
    "SELECT id, title, company, location, salary, source, url FROM raw_jobs ORDER BY crawled_at DESC LIMIT 20"
)
jobs = cur.fetchall()
cur.close()
conn.close()

if not jobs:
    print("No jobs found")
    exit(0)

print(f"Sending {len(jobs)} jobs...")
requests.post(
    webhook_url,
    json={
        "username": "Job Pipeline Bot",
        "avatar_url": "https://i.imgur.com/4M34hi2.png",
        "content": f"🎉 **Dagster Pipeline Completed!**\nHệ thống vừa cào thành công. Dưới đây là {len(jobs)} job mới nhất:",
    },
)

chunk_size = 10
for i in range(0, len(jobs), chunk_size):
    chunk = jobs[i : i + chunk_size]
    embeds = []
    for job in chunk:
        color = 3066993  # Green default
        if job["source"] == "topcv":
            color = 2860844  # TopCV Green
        elif job["source"] == "itviec":
            color = 15158332  # ITViec Red
        elif job["source"] == "linkedin":
            color = 28666  # LinkedIn Blue

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
        "username": "Job Pipeline Bot",
        "avatar_url": "https://i.imgur.com/4M34hi2.png",
        "embeds": embeds,
    }

    res = requests.post(webhook_url, json=payload)
    print("Status:", res.status_code)
    time.sleep(1)
