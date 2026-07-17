"""Atomic persistence helpers for the canonical PostgreSQL raw_jobs table."""

from collections.abc import Iterable, Mapping
from typing import Any

from sqlalchemy import text
from sqlalchemy.engine import Engine

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

UPSERT_RAW_JOB_SQL = """
INSERT INTO raw_jobs (
    id, title, company, location, salary, experience, description,
    requirements, tags, source, url, crawled_at
) VALUES (
    :id, :title, :company, :location, :salary, :experience, :description,
    :requirements, :tags, :source, :url, :crawled_at
)
ON CONFLICT (id) DO UPDATE SET
    embedding = CASE
        WHEN (raw_jobs.title, raw_jobs.experience, raw_jobs.description,
              raw_jobs.requirements)
             IS DISTINCT FROM
             (EXCLUDED.title, EXCLUDED.experience, EXCLUDED.description,
              EXCLUDED.requirements)
        THEN NULL
        ELSE raw_jobs.embedding
    END,
    title = EXCLUDED.title,
    company = EXCLUDED.company,
    location = EXCLUDED.location,
    salary = EXCLUDED.salary,
    experience = EXCLUDED.experience,
    description = EXCLUDED.description,
    requirements = EXCLUDED.requirements,
    tags = EXCLUDED.tags,
    source = EXCLUDED.source,
    url = EXCLUDED.url,
    crawled_at = COALESCE(raw_jobs.crawled_at, EXCLUDED.crawled_at);
"""


def upsert_raw_jobs(
    engine: Engine,
    records: Iterable[Mapping[str, Any]],
) -> int:
    """Create the shared table and atomically upsert a batch of crawler rows."""

    batch = list(records)
    if not batch:
        return 0

    with engine.begin() as connection:
        connection.execute(text(RAW_JOBS_DDL))
        connection.execute(text(UPSERT_RAW_JOB_SQL), batch)
    return len(batch)
