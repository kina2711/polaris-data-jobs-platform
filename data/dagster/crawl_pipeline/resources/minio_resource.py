import os
from minio import Minio

class MinioResource:
    def __init__(self):
        self.endpoint = os.environ.get("MINIO_ENDPOINT", "minio:9000")
        self.access_key = os.environ.get("MINIO_ROOT_USER", "admin")
        self.secret_key = os.environ.get("MINIO_ROOT_PASSWORD", "password")
        self.client = Minio(
            self.endpoint,
            access_key=self.access_key,
            secret_key=self.secret_key,
            secure=False,
        )
        self._ensure_bucket("raw-jobs")

    def _ensure_bucket(self, bucket_name: str):
        if not self.client.bucket_exists(bucket_name):
            self.client.make_bucket(bucket_name)

    def put_object(self, bucket_name: str, object_name: str, data: bytes):
        import io
        self.client.put_object(
            bucket_name,
            object_name,
            data=io.BytesIO(data),
            length=len(data),
            content_type="text/html",
        )

    def list_objects(self, bucket_name: str, prefix: str):
        return self.client.list_objects(bucket_name, prefix=prefix, recursive=True)

    def get_object(self, bucket_name: str, object_name: str) -> bytes:
        response = self.client.get_object(bucket_name, object_name)
        data = response.read()
        response.close()
        response.release_conn()
        return data
