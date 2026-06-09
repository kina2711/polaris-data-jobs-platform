import os

from minio import Minio
from sqlalchemy import create_engine


class MinioResource:
    def __init__(self):
        self.endpoint = os.environ.get("MINIO_ENDPOINT", "minio:9000")
        self.access_key = os.environ.get("MINIO_USER", "admin")
        self.secret_key = os.environ.get("MINIO_PASSWORD", "password")
        self.secure = False
        self.client = Minio(
            self.endpoint,
            access_key=self.access_key,
            secret_key=self.secret_key,
            secure=self.secure,
        )

    def ensure_bucket(self, bucket_name: str):
        if not self.client.bucket_exists(bucket_name):
            self.client.make_bucket(bucket_name)

    def put_object(
        self, bucket_name: str, object_name: str, data: bytes, content_type="text/html"
    ):
        import io

        self.ensure_bucket(bucket_name)
        self.client.put_object(
            bucket_name,
            object_name,
            data=io.BytesIO(data),
            length=len(data),
            content_type=content_type,
        )

    def list_objects(self, bucket_name: str, prefix: str = ""):
        self.ensure_bucket(bucket_name)
        return self.client.list_objects(bucket_name, prefix=prefix, recursive=True)

    def get_object(self, bucket_name: str, object_name: str) -> bytes:
        response = None
        try:
            response = self.client.get_object(bucket_name, object_name)
            return response.read()
        finally:
            if response:
                response.close()
                response.release_conn()


class PostgresResource:
    def __init__(self):
        user = os.environ.get("DB_USER", "postgres")
        password = os.environ.get("DB_PASSWORD", "postgres")
        host = os.environ.get("DAGSTER_PG_HOST", "postgresql_db")
        port = "5432"
        db = os.environ.get("DB_NAME", "crawl_jobs_db")
        self.engine = create_engine(
            f"postgresql://{user}:{password}@{host}:{port}/{db}"
        )

    def execute(self, sql, params=None):
        with self.engine.connect() as conn:
            return conn.execute(sql, params)
