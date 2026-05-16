import asyncio
import logging
import os
import tempfile
from typing import Any

import boto3
from botocore.exceptions import ClientError

from app.core.config import settings

logger = logging.getLogger(__name__)


class StorageService:
    def __init__(self):
        self.bucket, legacy_static_credentials = self._resolve_bucket_and_legacy_credentials()
        self.s3 = self._build_s3_client(legacy_static_credentials)
        self._encryption_args = self._build_encryption_args()
        self._ensure_bucket_if_enabled()

    def _resolve_bucket_and_legacy_credentials(self) -> tuple[str, dict[str, str]]:
        """Resolve S3 config with temporary compatibility for legacy R2_* env vars."""
        bucket = settings.S3_BUCKET or settings.R2_BUCKET
        if not bucket:
            raise ValueError("S3 bucket is not configured. Set S3_BUCKET.")

        legacy_creds: dict[str, str] = {}
        if settings.R2_ACCESS_KEY and settings.R2_SECRET_KEY:
            legacy_creds = {
                "aws_access_key_id": settings.R2_ACCESS_KEY,
                "aws_secret_access_key": settings.R2_SECRET_KEY,
            }
            logger.warning("Using legacy R2 static credentials. Migrate to IAM roles or AWS credential chain.")

        return bucket, legacy_creds

    def _build_s3_client(self, legacy_static_credentials: dict[str, str]):
        endpoint_url = settings.S3_ENDPOINT_URL or settings.R2_ENDPOINT or None
        region = settings.S3_REGION or None

        client_kwargs: dict[str, Any] = {"region_name": region}
        if endpoint_url:
            client_kwargs["endpoint_url"] = endpoint_url

        # For AWS deployments, prefer the default credential provider chain.
        # Legacy R2/MinIO credentials are still honored when explicitly configured.
        if legacy_static_credentials:
            client_kwargs.update(legacy_static_credentials)

        return boto3.client("s3", **client_kwargs)

    def _build_encryption_args(self) -> dict[str, str]:
        sse = (settings.S3_SERVER_SIDE_ENCRYPTION or "").strip()
        if not sse:
            return {}

        normalized = sse.lower()
        if normalized == "aes256":
            return {"ServerSideEncryption": "AES256"}

        if normalized == "aws:kms":
            args = {"ServerSideEncryption": "aws:kms"}
            if settings.S3_KMS_KEY_ID:
                args["SSEKMSKeyId"] = settings.S3_KMS_KEY_ID
            return args

        raise ValueError("S3_SERVER_SIDE_ENCRYPTION must be AES256 or aws:kms when set.")

    def _ensure_bucket_if_enabled(self):
        """Create bucket only when explicitly enabled (development/local emulation)."""
        if not settings.S3_AUTO_CREATE_BUCKET:
            return

        try:
            self.s3.head_bucket(Bucket=self.bucket)
        except ClientError:
            try:
                self.s3.create_bucket(Bucket=self.bucket)
                logger.info("Created bucket: %s", self.bucket)
            except Exception as e:
                logger.warning("Could not create bucket (may already exist): %s", e)

    async def upload_file(self, file_bytes: bytes, key: str, content_type: str) -> str:
        """Upload bytes to S3-compatible storage. Returns the object key."""

        def _upload():
            put_args = {
                "Bucket": self.bucket,
                "Key": key,
                "Body": file_bytes,
                "ContentType": content_type,
                **self._encryption_args,
            }
            self.s3.put_object(**put_args)

        await asyncio.get_event_loop().run_in_executor(None, _upload)
        logger.info("Uploaded %s (%s bytes)", key, len(file_bytes))
        return key

    async def download_file(self, key: str) -> bytes:
        """Download file bytes from S3-compatible storage."""

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
        """Delete a file from S3-compatible storage."""

        def _delete():
            self.s3.delete_object(Bucket=self.bucket, Key=key)

        await asyncio.get_event_loop().run_in_executor(None, _delete)
        logger.info("Deleted %s", key)

    def get_presigned_url(self, key: str, expires_in: int = 3600) -> str:
        """Generate a presigned download URL."""
        return self.s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": key},
            ExpiresIn=expires_in,
        )


# Singleton
storage_service = StorageService()
