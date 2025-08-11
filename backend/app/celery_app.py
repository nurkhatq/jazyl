from celery import Celery
from app.config import settings

celery_app = Celery(
    "jazyl",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["app.tasks"]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    beat_schedule={
        "send-reminders": {
            "task": "app.tasks.check_and_send_reminders",
            "schedule": 300.0,  # Every 5 minutes
        },
        "cleanup-old-bookings": {
            "task": "app.tasks.cleanup_old_bookings",
            "schedule": 86400.0,  # Daily
        },
    }
)