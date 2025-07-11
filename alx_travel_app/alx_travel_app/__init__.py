"""
This will make sure that the celery app is always imported when 
DJango starts so that the shared_task will use this app.
"""

from .celery import app as celery_app

# This ensures that Celery is loaded when Django starts

__all__= ('celery_app',)