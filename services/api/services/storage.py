"""S3-compatible storage service for project file snapshots."""

import io
import logging
import tarfile

import aioboto3

from config import settings

logger = logging.getLogger(__name__)

# Directories to exclude from snapshots (large / regenerable)
EXCLUDED_DIRS = {"node_modules", ".next", ".git", "__pycache__"}


class StorageService:
    """Upload and download project file snapshots to S3/MinIO."""

    def __init__(self) -> None:
        self._session = aioboto3.Session()

    def _client_kwargs(self) -> dict:
        kwargs: dict = {
            "service_name": "s3",
            "endpoint_url": settings.s3_endpoint,
            "region_name": settings.s3_region,
            "aws_access_key_id": settings.s3_access_key_id,
            "aws_secret_access_key": settings.s3_secret_access_key,
        }
        return kwargs

    def _s3_key(self, project_id: str) -> str:
        return f"snapshots/{project_id}/latest.tar.gz"

    async def _ensure_bucket(self, client) -> None:
        """Create the bucket if it doesn't exist."""
        try:
            await client.head_bucket(Bucket=settings.s3_bucket)
        except Exception:
            try:
                await client.create_bucket(Bucket=settings.s3_bucket)
                logger.info("[storage] Created bucket %s", settings.s3_bucket)
            except Exception as exc:
                logger.warning("[storage] Could not create bucket: %s", exc)

    async def upload_snapshot(self, project_id: str, files: dict[str, str]) -> str:
        """Tar.gz project files and upload to S3.

        Args:
            project_id: The project ID (used as the S3 key prefix).
            files: Mapping of {filepath: content}.

        Returns:
            The S3 key of the uploaded snapshot.
        """
        buf = io.BytesIO()
        with tarfile.open(fileobj=buf, mode="w:gz") as tar:
            for path, content in files.items():
                data = content.encode("utf-8")
                info = tarfile.TarInfo(name=path)
                info.size = len(data)
                tar.addfile(info, io.BytesIO(data))

        buf.seek(0)
        key = self._s3_key(project_id)

        async with self._session.client(**self._client_kwargs()) as client:
            await self._ensure_bucket(client)
            await client.upload_fileobj(buf, settings.s3_bucket, key)

        logger.info(
            "[storage] Uploaded snapshot for %s (%d files, %d bytes)",
            project_id,
            len(files),
            buf.tell(),
        )
        return key

    async def download_snapshot(self, project_id: str) -> dict[str, str] | None:
        """Download and extract the latest snapshot.

        Returns:
            Mapping of {filepath: content} or None if no snapshot exists.
        """
        key = self._s3_key(project_id)

        async with self._session.client(**self._client_kwargs()) as client:
            try:
                response = await client.get_object(
                    Bucket=settings.s3_bucket, Key=key
                )
                data = await response["Body"].read()
            except Exception:
                return None

        buf = io.BytesIO(data)
        files: dict[str, str] = {}

        try:
            with tarfile.open(fileobj=buf, mode="r:gz") as tar:
                for member in tar.getmembers():
                    if not member.isfile():
                        continue
                    f = tar.extractfile(member)
                    if f:
                        files[member.name] = f.read().decode("utf-8", errors="replace")
        except Exception as exc:
            logger.error("[storage] Failed to extract snapshot for %s: %s", project_id, exc)
            return None

        logger.info(
            "[storage] Downloaded snapshot for %s (%d files)", project_id, len(files)
        )
        return files

    async def has_snapshot(self, project_id: str) -> bool:
        """Check if a snapshot exists for the project."""
        key = self._s3_key(project_id)

        async with self._session.client(**self._client_kwargs()) as client:
            try:
                await client.head_object(Bucket=settings.s3_bucket, Key=key)
                return True
            except Exception:
                return False
