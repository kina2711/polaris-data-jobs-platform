import os
from sqlalchemy import create_engine

class PostgresResource:
    def __init__(self):
        host = os.environ.get("DAGSTER_PG_HOST", "postgresql_db")
        user = os.environ.get("DAGSTER_POSTGRES_USER", "postgres")
        password = os.environ.get("DAGSTER_POSTGRES_PASSWORD", "postgres")
        db = os.environ.get("DAGSTER_POSTGRES_DB", "crawl_jobs_db")
        self.engine = create_engine(
            f"postgresql+psycopg2://{user}:{password}@{host}:5432/{db}"
        )
