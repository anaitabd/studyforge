import asyncio
import logging
import os
import tempfile
from datetime import timedelta
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)


class StorageService:
    """Dual-backend storage service.

    - GCS_BUCKET set  → Google Cloud Storage (production on GCP, uses ADC)
    - S3_BUCKET / R2_BUCKET set → S3-compatible endpoint (local MinIO / R2)

    The public interface is identical for both backends.
    """

    def __init__(self) -> None:
        if settings.GCS_BUCKET:
            self._mode = "gcs"
            self.bucket_name = settings.GCS_BUCKET
            self._init_gcs()
            logger.info("StorageService: GCS backend — bucket=%s", self.bucket_name)
        else:
            self._mode = "s3"
            self._init_s3()
            logger.info("StorageService: S3 backend — bucket=%s", self.bucket_name)

    # ── GCS backend ───────────────────────────────────────────────────────────

    def _init_gcs(self) -> None:
        from google.cloud import storage as _gcs
        if settings.GCS_EMULATOR_HOST:
            # local fake-gcs-server (docker-compose dev)
            from google.auth.credentials import AnonymousCredentials
            self._gcs_client = _gcs.Client(
                project=settings.GOOGLE_PROJECT_ID or "local",
                credentials=AnonymousCredentials(),
                client_options={"api_endpoint": settings.GCS_EMULATOR_HOST},
            )
        else:
            self._gcs_client = _gcs.Client(project=settings.GOOGLE_PROJECT_ID or None)
        self._gcs_bucket = self._gcs_client.bucket(self.bucket_name)

    # ── S3-compatible backend (MinIO / R2 / AWS) ──────────────────────────────

    def _init_s3(self) -> None:
        import boto3
        self.bucket_name = settings.S3_BUCKET or settings.R2_BUCKET
        if not self.bucket_name:
            raise ValueError(
                "Storage not configured. Set GCS_BUCKET (GCP) or S3_BUCKET / R2_BUCKET (local MinIO)."
            )
        endpoint_url = settings.S3_ENDPOINT_URL or settings.R2_ENDPOINT or None
        client_kwargs: dict[str, Any] = {"region_name": settings.S3_REGION or None}
        if endpoint_url:
            client_kwargs["endpoint_url"] = endpoint_url
        if settings.R2_ACCESS_KEY and settings.R2_SECRET_KEY:
            client_kwargs["aws_access_key_id"] = settings.R2_ACCESS_KEY
            client_kwargs["aws_secret_access_key"] = settings.R2_SECRET_KEY
            logger.warning("Using static S3 credentials. Prefer IAM roles / workload identity in production.")
        self._s3 = boto3.client("s3", **client_kwargs)
        self._s3_enc: dict[str, str] = self._build_s3_enc()
        if settings.S3_AUTO_CREATE_BUCKET:
            self._s3_ensure_bucket()

    def _build_s3_enc(self) -> dict[str, str]:
        sse = (settings.S3_SERVER_SIDE_ENCRYPTION or "").strip().lower()
        if not sse:
            return {}
        if sse == "aes256":
            return {"ServerSideEncryption": "AES256"}
        if sse == "aws:kms":
            args: dict[str, str] = {"ServerSideEncryption": "aws:kms"}
            if settings.S3_KMS_KEY_ID:
                args["SSEKMSKeyId"] = settings.S3_KMS_KEY_ID
            return args
        raise ValueError("S3_SERVER_SIDE_ENCRYPTION must be AES256 or aws:kms.")

    def _s3_ensure_bucket(self) -> None:
        from botocore.exceptions import ClientError
        try:
            self._s3.head_bucket(Bucket=self.bucket_name)
        except ClientError:
            try:
                self._s3.create_bucket(Bucket=self.bucket_name)
                logger.info("Created S3 bucket: %s", self.bucket_name)
            except Exception as e:
                logger.warning("Could not create S3 bucket (may already exist): %s", e)

    # ── Public interface ──────────────────────────────────────────────────────

    async def upload_file(self, file_bytes: bytes, key: str, content_type: str) -> str:
        """Upload bytes and return the object key."""
        if self._mode == "gcs":
            await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self._gcs_bucket.blob(key).upload_from_string(
                    file_bytes, content_type=content_type
                ),
            )
        else:
            await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self._s3.put_object(
                    Bucket=self.bucket_name,
                    Key=key,
                    Body=file_bytes,
                    ContentType=content_type,
                    **self._s3_enc,
                ),
            )
        logger.info("Uploaded %s (%d bytes) via %s", key, len(file_bytes), self._mode)
        return key

    async def download_file(self, key: str) -> bytes:
        """Return raw bytes for the object."""
        if self._mode == "gcs":
            return await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self._gcs_bucket.blob(key).download_as_bytes(),
            )
        return await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: self._s3.get_object(Bucket=self.bucket_name, Key=key)["Body"].read(),
        )

    async def download_to_temp(self, key: str) -> str:
        """Download to a temp file and return its path."""
        data = await self.download_file(key)
        suffix = os.path.splitext(key)[1] or ".bin"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as f:
            f.write(data)
            return f.name

    async def delete_file(self, key: str) -> None:
        """Delete an object from storage."""
        if self._mode == "gcs":
            await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self._gcs_bucket.blob(key).delete(),
            )
        else:
            await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self._s3.delete_object(Bucket=self.bucket_name, Key=key),
            )
        logger.info("Deleted %s via %s", key, self._mode)

    def get_presigned_url(self, key: str, expires_in: int = 3600) -> str:
        """Return a time-limited download URL.

        GCS: uses v4 signed URLs (requires roles/iam.serviceAccountTokenCreator on the SA).
        S3: uses standard presigned URLs.
        """
        if self._mode == "gcs":
            try:
                return self._gcs_bucket.blob(key).generate_signed_url(
                    version="v4",
                    expiration=timedelta(seconds=min(max(expires_in, 60), 86400)),
                    method="GET",
                )
            except Exception as exc:
                logger.warning("GCS signed URL failed (%s) — returning gs:// path", exc)
                return f"gs://{self.bucket_name}/{key}"
        return self._s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket_name, "Key": key},
            ExpiresIn=expires_in,
        )


storage_service = StorageService()
