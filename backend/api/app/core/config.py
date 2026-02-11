"""Application configuration."""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Load from environment or .env."""

    app_name: str = "Moodeng API"
    debug: bool = False

    # Firebase
    firebase_project_id: str = ""
    firebase_credentials_path: str = ""  # path to service account JSON, or use GOOGLE_APPLICATION_CREDENTIALS

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()
