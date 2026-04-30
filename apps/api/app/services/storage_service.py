import asyncio
import logging
import os
import tempfile
from typing import Optional

import boto3
from botocore.exceptions import ClientError

from app.core.config import settings

logger = logging.getLogger(__name__)


class StorageService:
    def __init__(self):
        self.s3 = boto3.client(
            "s3",
            endpoint_url=settings.R2_ENDPOINT,
            aws_access_key_id=settings.R2_ACCESS_KEY,
            aws_secret_access_key=settings.R2_SECRET_KEY,
            region_name="auto",
        )
        self.bucket = settings.R2_BUCKET
        self._ensure_bucket()

    def _ensure_bucket(self):
        """Create bucket if it doesn't exist (for local MinIO dev)."""
        try:
            self.s3.head_bucket(Bucket=self.bucket)
        except ClientError:
            try:
                self.s3.create_bucket(Bucket=self.bucket)
                logger.info(f"Created bucket: {self.bucket}")
            except Exception as e:
                logger.warning(f"Could not create bucket (may already exist): {e}")

    async def upload_file(
        self, file_bytes: bytes, key: str, content_type: str
    ) -> str:
        """Upload bytes to R2/MinIO. Returns the object key."""
        def _upload():
            self.s3.put_object(
                Bucket=self.bucket,
                Key=key,
                Body=file_bytes,
                ContentType=content_type,
            )

        await asyncio.get_event_loop().run_in_executor(None, _upload)
        logger.info(f"Uploaded {key} ({len(file_bytes)} bytes)")
        return key

    async def download_file(self, key: str) -> bytes:
        """Download file bytes from R2/MinIO."""
        def _download():
            response = self.s3.get_object(Bucket=self.bucket, Key=key)
            return response["Body"].read()

        return await asyncio.get_event_loop().run_in_executor(None, _download)

    async def download_to_temp(self, key: str) -> str:
        """Download file to a temp path and return the path."""
        data = await self.download_file(key)
        suffix = os.path.splitext(key)[1] or ".bin"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as f:
            f.write(data)
            return f.name

    async def delete_file(self, key: str) -> None:
        """Delete a file from R2/MinIO."""
        def _delete():
            self.s3.delete_object(Bucket=self.bucket, Key=key)

        await asyncio.get_event_loop().run_in_executor(None, _delete)
        logger.info(f"Deleted {key}")

    def get_presigned_url(self, key: str, expires_in: int = 3600) -> str:
        """Generate a presigned download URL."""
        return self.s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": key},
            ExpiresIn=expires_in,
        )


# Singleton
storage_service = StorageService()
