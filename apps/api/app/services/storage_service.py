"""
Google Cloud Storage service.
Uses Application Default Credentials (ADC) — no keys needed on GCP.
Project: studyforge-495618
"""
import asyncio
import logging
import mimetypes
import os
import tempfile
from datetime import timedelta

from google.cloud import storage as gcs

from app.core.config import settings

logger = logging.getLogger(__name__)


class StorageService:

    def __init__(self) -> None:
        if settings.GCS_EMULATOR_HOST:
            from google.auth.credentials import AnonymousCredentials
            self._client = gcs.Client(
                project=settings.GCP_PROJECT_ID or "local",
                credentials=AnonymousCredentials(),
                client_options={"api_endpoint": settings.GCS_EMULATOR_HOST},
            )
        else:
            self._client = gcs.Client(project=settings.GCP_PROJECT_ID or None)
        self.bucket_name = settings.GCS_BUCKET
        self._bucket: gcs.Bucket | None = None
        logger.info("StorageService: GCS backend — bucket=%s", self.bucket_name)

    @property
    def bucket(self) -> gcs.Bucket:
        if self._bucket is None:
            self._bucket = self._client.bucket(self.bucket_name)
        return self._bucket

    async def upload_file(self, file_bytes: bytes, key: str, content_type: str) -> str:
        """Upload bytes and return the object key."""
        if content_type is None:
            content_type, _ = mimetypes.guess_type(key)
            content_type = content_type or "application/octet-stream"
        await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: self.bucket.blob(key).upload_from_string(file_bytes, content_type=content_type),
        )
        logger.info("Uploaded %s (%d bytes) to gs://%s", key, len(file_bytes), self.bucket_name)
        return key

    async def download_file(self, key: str) -> bytes:
        """Return raw bytes for the object."""
        return await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: self.bucket.blob(key).download_as_bytes(),
        )

    async def download_to_temp(self, key: str) -> str:
        """Download to a temp file and return its path."""
        data = await self.download_file(key)
        suffix = os.path.splitext(key)[1] or ".bin"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as f:
            f.write(data)
            return f.name

    async def delete_file(self, key: str) -> bool:
        """Delete an object. Returns True if deleted, False if not found."""
        try:
            await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self.bucket.blob(key).delete(),
            )
            logger.info("Deleted %s from gs://%s", key, self.bucket_name)
            return True
        except Exception as exc:
            logger.warning("Could not delete %s: %s", key, exc)
            return False

    def get_presigned_url(self, key: str, expires_in: int = 3600) -> str:
        """Return a time-limited v4 signed URL for GET access."""
        try:
            return self.bucket.blob(key).generate_signed_url(
                version="v4",
                expiration=timedelta(seconds=min(max(expires_in, 60), 86400)),
                method="GET",
            )
        except Exception as exc:
            logger.warning("GCS signed URL failed (%s) — returning gs:// path", exc)
            return f"gs://{self.bucket_name}/{key}"

    async def file_exists(self, key: str) -> bool:
        """Check whether an object exists."""
        return await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: self.bucket.blob(key).exists(),
        )

    async def list_files(self, prefix: str) -> list[str]:
        """List all object names under a prefix."""
        blobs = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: list(self._client.list_blobs(self.bucket_name, prefix=prefix)),
        )
        return [b.name for b in blobs]

    async def copy_file(self, source_key: str, dest_key: str) -> str:
        """Copy an object within the same bucket. Returns the destination key."""
        source_blob = self.bucket.blob(source_key)
        await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: self.bucket.copy_blob(source_blob, self.bucket, dest_key),
        )
        return dest_key


storage_service = StorageService()
