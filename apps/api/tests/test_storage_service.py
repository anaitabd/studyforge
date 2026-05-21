"""Storage service tests — verify GCS client configuration."""
from unittest.mock import MagicMock, patch


def test_gcs_client_is_built_on_init(monkeypatch):
    """StorageService initialises a GCS client using ADC."""
    import app.services.storage_service as storage_module

    monkeypatch.setattr(storage_module.settings, "GCS_BUCKET", "test-bucket")
    monkeypatch.setattr(storage_module.settings, "GCS_EMULATOR_HOST", "")
    monkeypatch.setattr(storage_module.settings, "GCP_PROJECT_ID", "test-project")

    with patch("google.cloud.storage.Client") as mock_client_cls:
        mock_client_cls.return_value = MagicMock()
        svc = storage_module.StorageService()

    mock_client_cls.assert_called_once_with(project="test-project")
    assert svc.bucket_name == "test-bucket"


def test_gcs_emulator_uses_anonymous_credentials(monkeypatch):
    """StorageService uses AnonymousCredentials when GCS_EMULATOR_HOST is set."""
    import app.services.storage_service as storage_module

    monkeypatch.setattr(storage_module.settings, "GCS_BUCKET", "test-bucket")
    monkeypatch.setattr(storage_module.settings, "GCS_EMULATOR_HOST", "http://localhost:4443")
    monkeypatch.setattr(storage_module.settings, "GCP_PROJECT_ID", "local")

    with patch("google.cloud.storage.Client") as mock_client_cls:
        mock_client_cls.return_value = MagicMock()
        svc = storage_module.StorageService()

    call_kwargs = mock_client_cls.call_args[1]
    assert call_kwargs["client_options"] == {"api_endpoint": "http://localhost:4443"}
    assert svc.bucket_name == "test-bucket"


def test_bucket_property_is_lazily_created(monkeypatch):
    """The bucket property initialises on first access."""
    import app.services.storage_service as storage_module

    monkeypatch.setattr(storage_module.settings, "GCS_BUCKET", "test-bucket")
    monkeypatch.setattr(storage_module.settings, "GCS_EMULATOR_HOST", "")
    monkeypatch.setattr(storage_module.settings, "GCP_PROJECT_ID", "test-project")

    mock_client = MagicMock()
    with patch("google.cloud.storage.Client", return_value=mock_client):
        svc = storage_module.StorageService()

    _ = svc.bucket
    mock_client.bucket.assert_called_once_with("test-bucket")
