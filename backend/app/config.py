from pydantic_settings import BaseSettings
from typing import List
import os
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    # Application
    APP_NAME: str = "Jazyl"
    DEBUG: bool = os.getenv("DEBUG", "False").lower() == "true"
    SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "your-secret-key-min-32-chars")
    
    # Database
    DB_HOST: str = os.getenv("DB_HOST", "postgres")
    DB_PORT: int = int(os.getenv("DB_PORT", "5432"))
    DB_NAME: str = os.getenv("DB_NAME", "jazyl_db")
    DB_USER: str = os.getenv("DB_USER", "jazyl_user")
    DB_PASSWORD: str = os.getenv("DB_PASSWORD", "password")
    
    @property
    def DATABASE_URL(self) -> str:
        return f"postgresql+asyncpg://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
    
    # Redis
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://redis:6379/0")
    REDIS_PASSWORD: str | None = os.getenv("REDIS_PASSWORD")
    SSL_CERT_PATH: str | None = os.getenv("SSL_CERT_PATH")
    SSL_KEY_PATH: str | None = os.getenv("SSL_KEY_PATH")

    
    # JWT
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY")
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Email
    SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USERNAME: str = os.getenv("SMTP_USERNAME")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD")
    SMTP_FROM_EMAIL: str = os.getenv("SMTP_FROM_EMAIL", "noreply@jazyl.tech")
    SMTP_FROM_NAME: str = os.getenv("SMTP_FROM_NAME", "Jazyl")
    
    # Domain
    DOMAIN: str = os.getenv("DOMAIN", "jazyl.tech")
    API_DOMAIN: str = os.getenv("API_DOMAIN", "api.jazyl.tech")
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "https://jazyl.tech")
    
    # CORS
    ALLOWED_ORIGINS: List[str] = [
        "https://jazyl.tech",
        "https://*.jazyl.tech",
        "http://localhost:3000",  # For development
    ]
    
    ALLOWED_HOSTS: List[str] = [
        "jazyl.tech",
        "*.jazyl.tech",
        "localhost",
    ]
    
    # Celery
    CELERY_BROKER_URL: str = os.getenv("CELERY_BROKER_URL", "redis://redis:6379/0")
    CELERY_RESULT_BACKEND: str = os.getenv("CELERY_RESULT_BACKEND", "redis://redis:6379/0")
    
    # File Upload
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024  # 10MB
    UPLOAD_DIR: str = "/app/uploads"
    ALLOWED_EXTENSIONS: List[str] = [".jpg", ".jpeg", ".png", ".webp"]
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
