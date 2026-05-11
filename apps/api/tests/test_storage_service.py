from unittest.mock import patch


def test_legacy_r2_credentials_are_passed_to_s3_client(monkeypatch):
    from app.services import storage_service as storage_module

    monkeypatch.setattr(storage_module.settings, "S3_REGION", "us-east-1")
    monkeypatch.setattr(storage_module.settings, "S3_ENDPOINT_URL", "")
    monkeypatch.setattr(storage_module.settings, "R2_ENDPOINT", "http://minio:9000")
    monkeypatch.setattr(storage_module.settings, "S3_USE_AWS_MANAGED_CREDENTIALS", True)

    service = storage_module.StorageService.__new__(storage_module.StorageService)
    legacy_credentials = {
        "aws_access_key_id": "minioadmin",
        "aws_secret_access_key": "minioadmin",
    }

    with patch.object(storage_module.boto3, "client") as mock_client:
        service._build_s3_client(legacy_credentials)

    mock_client.assert_called_once_with(
        "s3",
        region_name="us-east-1",
        endpoint_url="http://minio:9000",
        aws_access_key_id="minioadmin",
        aws_secret_access_key="minioadmin",
    )


def test_s3_client_uses_aws_provider_chain_without_legacy_credentials(monkeypatch):
    from app.services import storage_service as storage_module

    monkeypatch.setattr(storage_module.settings, "S3_REGION", "us-east-1")
    monkeypatch.setattr(storage_module.settings, "S3_ENDPOINT_URL", "")
    monkeypatch.setattr(storage_module.settings, "R2_ENDPOINT", "")

    service = storage_module.StorageService.__new__(storage_module.StorageService)

    with patch.object(storage_module.boto3, "client") as mock_client:
        service._build_s3_client({})

    mock_client.assert_called_once_with("s3", region_name="us-east-1")
