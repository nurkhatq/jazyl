from fastapi import FastAPI, Request, status
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import logging
from prometheus_client import make_asgi_app
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.database import engine, Base
from app.api import auth, tenants, bookings, masters, services, clients, dashboard
from app.utils.logger import setup_logging
from app.utils.middleware import TenantMiddleware, LoggingMiddleware
from app.utils.exceptions import CustomException
import os

# Setup logging
setup_logging()
logger = logging.getLogger(__name__)

# Create rate limiter
limiter = Limiter(key_func=get_remote_address)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    # Startup
    logger.info("Starting up Jazyl Backend...")
    
    # Create database tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    yield
    
    # Shutdown
    logger.info("Shutting down Jazyl Backend...")
    await engine.dispose()

# Create FastAPI app
app = FastAPI(
    title="Jazyl API",
    description="SaaS Platform for Barbershops",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

# Add middleware in correct order (ВАЖНО: порядок имеет значение!)
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=settings.ALLOWED_HOSTS,
)

# УДАЛЯЕМ URLFixMiddleware - он вызывает проблемы с redirects
# Вместо этого будем правильно определять пути в роутах

# Потом logging
app.add_middleware(LoggingMiddleware)

# Потом tenant detection
app.add_middleware(TenantMiddleware)

# Add rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Exception handlers
@app.exception_handler(CustomException)
async def custom_exception_handler(request: Request, exc: CustomException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )

# Health check endpoint
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "version": "1.0.0",
        "service": "jazyl-backend"
    }

# Include routers БЕЗ trailing slash
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(tenants.router, prefix="/api/tenants", tags=["Tenants"])
app.include_router(bookings.router, prefix="/api/bookings", tags=["Bookings"])
app.include_router(masters.router, prefix="/api/masters", tags=["Masters"])
app.include_router(services.router, prefix="/api/services", tags=["Services"])
app.include_router(clients.router, prefix="/api/clients", tags=["Clients"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])

# Mount metrics endpoint
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)

# Create uploads directory if not exists
uploads_dir = "uploads"
if not os.path.exists(uploads_dir):
    os.makedirs(uploads_dir)
    os.makedirs(os.path.join(uploads_dir, "masters"))

# Mount static files
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

@app.get("/")
async def root():
    return {
        "message": "Jazyl API",
        "version": "1.0.0",
        "docs": "/docs" if settings.DEBUG else None
    }