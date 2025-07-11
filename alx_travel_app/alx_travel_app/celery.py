"""
Celery configuration for ALX travel App.

This file is meant to set up celery to handle background tasks like email notifications, data processing and scheduled tasks.
"""

import os
from celery import Celery
from django.conf import settings
import time
from datetime import datetime

#Set the default Django settings module for the celery program
os.environ.setdefault('DJJANGO_SETTINGS_MODULE', 'alx_travel_app.settings')

# Create a celery instance and configure it
app = Celery('alx_travel_app')

# Using a string here means that the worker does not have to serialize
# The configuration object to child procesess.
# - namespace = 'CELERY' means all celery-related configuration keys
# Should have a 'CELERY_' prefix.

app.config_from_object('django.conf:settings', namespace='CELERY')
# Load task modules from all registed Django app configs.

app.autodiscover_tasks()

#Configure task routes (advanced feature)
app.conf.task_routes = {
    'listings.tasks.send_booking_confirmation_email': {'queue': 'emails'},
    'listings.tasks.send_booking_cancellation_email':{'queue':'emails'},
    'listings.tasks.cleanup_old_logs': {'queue': 'maintenance'},
}

#Configure periodic tasks (scheduled tasks)
from celery.schedules import crontab
app.conf.beat_schedule = {
    'send-daily-reminders': {
        'task': 'listings.tasks.send_booking_reminder_email',
        'schedule':crontab(hour=10, minute=0),
        'options':{'queue': 'emails'}
    },

    # Cleanup old logs every sunday at 2AM
    'weekly-cleanup': {
        'task': 'listings.tasks.cleanup_old_logs',
        'schedule': crontab(hour=2, minute=0, day_of_week=0),
        'options': {'queue':'maintenance'}
    },
}

# The timezone for celery app
app.conf.timezone = 'UTC'

# Task result settings
app.conf.result_expires = 3600 #The task results will expire after an hour

# Task execution settings for reliability
app.conf.task_acks_late = True
app.conf.worker_prefetch_multiplier = 1  # Ensures tasks are acknowledged only after completion

# Debugging task for testing Celery setup
@app.task(bind=True, ignore_result=True)
def debug_task(self):
    """
    Debug the task to test celery configuration.
    """
    print(f"Request: {self.request!r}")
    return f"Debug task executed successfully at {self.request.id}"


# Health check task
@app.task(bind=True)
def health_check(self):
    """
    Health check task to verify if Celery is working correctly.
    """
    start_time = time.time()
    current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    # Simulate some work
    time.sleep(1)

    execution_time = time.time() - start_time

    return {
        'status': 'healthy',
        'timestamp':'current_time',
        'execution_time': round(execution_time, 2),
        'worker_id': self.request.id,
        'host_name': self.request.hostname
    }
    