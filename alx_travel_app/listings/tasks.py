# listings/tasks.py

"""
Celery tasks for the listings app.

This module contains background tasks for:
- Sending booking confirmation emails
- Sending booking reminder emails  
- Cleanup and maintenance tasks
- Notification tasks
"""

import logging
from datetime import datetime, timedelta
from decimal import Decimal

from celery import shared_task
from django.core.mail import send_mail, EmailMultiAlternatives
from django.conf import settings
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.utils import timezone

# Set up logging
logger = logging.getLogger(__name__)

# =========================
# EMAIL TASKS
# =========================

@shared_task(bind=True, autoretry_for=(Exception,), retry_kwargs={'max_retries': 3, 'countdown': 60}, name='send_booking_confirmation_email')
def send_booking_confirmation_email(self, booking_id, user_email, user_name, listing_title, check_in_date, check_out_date, total_price=None, booking_details=None):
    """
    Send a booking confirmation email asynchronously.
    
    Args:
        booking_id (int): The ID of the booking
        user_email (str): User's email address
        user_name (str): User's full name
        listing_title (str): Name of the booked listing
        check_in_date (str): Check-in date
        check_out_date (str): Check-out date
        total_price (str, optional): Total booking price
        booking_details (dict, optional): Additional booking details
    
    Returns:
        str: Success message or raises exception for retry
    """
    try:
        # Log the task start
        logger.info(f"Starting booking confirmation email task for booking {booking_id}")
        
        # Prepare email context
        context = {
            'user_name': user_name,
            'booking_id': booking_id,
            'listing_title': listing_title,
            'check_in_date': check_in_date,
            'check_out_date': check_out_date,
            'total_price': total_price,
            'booking_details': booking_details or {},
            'company_name': 'ALX Travel App',
            'support_email': settings.ADMIN_EMAIL,
            'current_year': datetime.now().year,
        }
        
        # Email subject
        subject = f'Booking Confirmation - {listing_title}'
        
        # Try to render HTML template, fallback to plain text
        try:
            # Create HTML email content (you can create this template later)
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Booking Confirmation</title>
                <style>
                    body {{ font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; }}
                    .header {{ background-color: #007bff; color: white; padding: 20px; text-align: center; }}
                    .content {{ padding: 20px; }}
                    .booking-details {{ background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; }}
                    .footer {{ background-color: #6c757d; color: white; padding: 15px; text-align: center; font-size: 12px; }}
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🎉 Booking Confirmed!</h1>
                </div>
                <div class="content">
                    <p>Dear {user_name},</p>
                    
                    <p>Great news! Your booking has been confirmed. We're excited to host you!</p>
                    
                    <div class="booking-details">
                        <h3>📋 Booking Details</h3>
                        <p><strong>Booking ID:</strong> {booking_id}</p>
                        <p><strong>Property:</strong> {listing_title}</p>
                        <p><strong>Check-in:</strong> {check_in_date}</p>
                        <p><strong>Check-out:</strong> {check_out_date}</p>
                        {f"<p><strong>Total Price:</strong> ${total_price}</p>" if total_price else ""}
                    </div>
                    
                    <h3>📞 Need Help?</h3>
                    <p>If you have any questions or need to make changes to your booking, please contact us at:</p>
                    <p>📧 <a href="mailto:{settings.ADMIN_EMAIL}">{settings.ADMIN_EMAIL}</a></p>
                    
                    <p>We look forward to providing you with an amazing experience!</p>
                    
                    <p>Best regards,<br>The ALX Travel Team</p>
                </div>
                <div class="footer">
                    <p>&copy; {datetime.now().year} ALX Travel App. All rights reserved.</p>
                    <p>This is an automated message. Please do not reply to this email.</p>
                </div>
            </body>
            </html>
            """
            
            # Create plain text version
            plain_text_content = f"""
            Dear {user_name},
            
            Great news! Your booking has been confirmed.
            
            Booking Details:
            - Booking ID: {booking_id}
            - Property: {listing_title}
            - Check-in: {check_in_date}
            - Check-out: {check_out_date}
            {f"- Total Price: ${total_price}" if total_price else ""}
            
            If you have any questions, please contact us at {settings.ADMIN_EMAIL}
            
            We look forward to hosting you!
            
            Best regards,
            The ALX Travel Team
            
            ---
            © {datetime.now().year} ALX Travel App. All rights reserved.
            This is an automated message. Please do not reply to this email.
            """
            
        except Exception as template_error:
            logger.warning(f"Template rendering failed: {template_error}, using fallback")
            html_content = None
            plain_text_content = f"""
            Dear {user_name},
            
            Thank you for your booking with ALX Travel App!
            
            Booking Details:
            - Booking ID: {booking_id}
            - Property: {listing_title}
            - Check-in: {check_in_date}
            - Check-out: {check_out_date}
            {f"- Total Price: ${total_price}" if total_price else ""}
            
            We look forward to hosting you!
            
            Best regards,
            ALX Travel Team
            """
        
        # Send email with both HTML and plain text versions
        if html_content:
            # Send multipart email (HTML + plain text)
            email = EmailMultiAlternatives(
                subject=subject,
                body=plain_text_content,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[user_email]
            )
            email.attach_alternative(html_content, "text/html")
            email.send(fail_silently=False)
        else:
            # Send plain text email
            send_mail(
                subject=subject,
                message=plain_text_content,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user_email],
                fail_silently=False,
            )
        
        # Log success
        logger.info(f"Booking confirmation email sent successfully for booking {booking_id} to {user_email}")
        
        return f"Booking confirmation email sent successfully to {user_email}"
        
    except Exception as exc:
        # Log the error
        logger.error(f"Failed to send booking confirmation email for booking {booking_id}: {str(exc)}")
        
        # Retry the task
        raise self.retry(exc=exc)


@shared_task(bind=True, autoretry_for=(Exception,), retry_kwargs={'max_retries': 2, 'countdown': 120}, name='send_booking_reminder_email')
def send_booking_reminder_email(self, booking_id, user_email, user_name, listing_title, check_in_date, days_until_checkin=1):
    """
    Send a booking reminder email before check-in.
    
    Args:
        booking_id (int): The ID of the booking
        user_email (str): User's email address
        user_name (str): User's full name
        listing_title (str): Name of the booked listing
        check_in_date (str): Check-in date
        days_until_checkin (int): Number of days until check-in
    
    Returns:
        str: Success message
    """
    try:
        logger.info(f"Sending booking reminder email for booking {booking_id}")
        
        # Determine reminder message based on days
        if days_until_checkin <= 1:
            reminder_message = "Your check-in is tomorrow!"
            urgency = "high"
        elif days_until_checkin <= 3:
            reminder_message = f"Your check-in is in {days_until_checkin} days!"
            urgency = "medium"
        else:
            reminder_message = f"Your check-in is in {days_until_checkin} days."
            urgency = "low"
        
        subject = f'Upcoming Stay Reminder - {listing_title}'
        
        message = f"""
        Dear {user_name},
        
        {reminder_message}
        
        Booking Details:
        - Booking ID: {booking_id}
        - Property: {listing_title}
        - Check-in Date: {check_in_date}
        
        We're excited to welcome you! If you have any questions or need assistance, 
        please don't hesitate to contact us at {settings.ADMIN_EMAIL}
        
        Safe travels!
        
        Best regards,
        The ALX Travel Team
        """
        
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user_email],
            fail_silently=False,
        )
        
        logger.info(f"Booking reminder email sent successfully for booking {booking_id}")
        return f"Reminder email sent to {user_email}"
        
    except Exception as exc:
        logger.error(f"Failed to send booking reminder email for booking {booking_id}: {str(exc)}")
        raise self.retry(exc=exc)


@shared_task(name='send_booking_cancellation_email')
def send_booking_cancellation_email(booking_id, user_email, user_name, listing_title, cancellation_reason=None):
    """
    Send a booking cancellation email.
    
    Args:
        booking_id (int): The ID of the cancelled booking
        user_email (str): User's email address
        user_name (str): User's full name
        listing_title (str): Name of the cancelled listing
        cancellation_reason (str, optional): Reason for cancellation
    
    Returns:
        str: Success message
    """
    try:
        logger.info(f"Sending booking cancellation email for booking {booking_id}")
        
        subject = f'Booking Cancellation - {listing_title}'
        
        message = f"""
        Dear {user_name},
        
        We're writing to confirm that your booking has been cancelled.
        
        Cancelled Booking Details:
        - Booking ID: {booking_id}
        - Property: {listing_title}
        {f"- Cancellation Reason: {cancellation_reason}" if cancellation_reason else ""}
        
        If you have any questions about this cancellation or need assistance with 
        a new booking, please contact us at {settings.ADMIN_EMAIL}
        
        Thank you for choosing ALX Travel App.
        
        Best regards,
        The ALX Travel Team
        """
        
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user_email],
            fail_silently=False,
        )
        
        logger.info(f"Booking cancellation email sent successfully for booking {booking_id}")
        return f"Cancellation email sent to {user_email}"
        
    except Exception as exc:
        logger.error(f"Failed to send booking cancellation email for booking {booking_id}: {str(exc)}")
        raise exc


# =========================
# MAINTENANCE TASKS
# =========================

@shared_task(name='cleanup_old_logs')
def cleanup_old_logs():
    """
    Clean up old log files and temporary data.
    This is an example of a periodic maintenance task.
    
    Returns:
        str: Cleanup summary
    """
    try:
        logger.info("Starting log cleanup task")
        
        # Example cleanup logic (implement based on your needs)
        cleanup_summary = {
            'logs_cleaned': 0,
            'temp_files_removed': 0,
            'database_cleanup': False
        }
        
        # You could implement actual cleanup logic here:
        # - Remove old log files
        # - Clean up temporary uploads
        # - Archive old data
        # - Optimize database
        
        logger.info("Log cleanup task completed successfully")
        return f"Cleanup completed: {cleanup_summary}"
        
    except Exception as exc:
        logger.error(f"Log cleanup task failed: {str(exc)}")
        raise exc


@shared_task(name='send_admin_notification')
def send_admin_notification(subject, message, admin_emails=None):
    """
    Send notification email to administrators.
    
    Args:
        subject (str): Email subject
        message (str): Email message
        admin_emails (list, optional): List of admin emails
    
    Returns:
        str: Success message
    """
    try:
        if not admin_emails:
            admin_emails = [settings.ADMIN_EMAIL]
        
        full_subject = f"{settings.EMAIL_SUBJECT_PREFIX}{subject}"
        
        send_mail(
            subject=full_subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=admin_emails,
            fail_silently=False,
        )
        
        logger.info(f"Admin notification sent: {subject}")
        return f"Admin notification sent to {len(admin_emails)} recipients"
        
    except Exception as exc:
        logger.error(f"Failed to send admin notification: {str(exc)}")
        raise exc


# =========================
# UTILITY TASKS
# =========================

@shared_task(name='process_booking_analytics')
def process_booking_analytics(date_range=None):
    """
    Process booking analytics data (example background task).
    
    Args:
        date_range (dict, optional): Date range for analytics
    
    Returns:
        dict: Analytics summary
    """
    try:
        logger.info("Processing booking analytics")
        
        # Import here to avoid circular imports
        from .models import Booking, Listing
        
        # Example analytics processing
        analytics = {
            'total_bookings': Booking.objects.count(),
            'confirmed_bookings': Booking.objects.filter(status='confirmed').count(),
            'completed_bookings': Booking.objects.filter(status='completed').count(),
            'total_listings': Listing.objects.count(),
            'active_listings': Listing.objects.filter(status='approved').count(),
            'processed_at': timezone.now().isoformat()
        }
        
        # You could save this data to a AnalyticsReport model
        # or send it to an external analytics service
        
        logger.info(f"Analytics processed: {analytics}")
        return analytics
        
    except Exception as exc:
        logger.error(f"Analytics processing failed: {str(exc)}")
        raise exc


@shared_task(bind=True, name='test_celery_connection')
def test_celery_connection(self):
    """
    Test task to verify Celery is working correctly.
    
    Returns:
        dict: Connection test results
    """
    try:
        import time
        start_time = time.time()
        
        # Simulate some work
        time.sleep(1)
        
        execution_time = time.time() - start_time
        
        result = {
            'status': 'success',
            'message': 'Celery is working correctly!',
            'task_id': self.request.id,
            'execution_time': round(execution_time, 2),
            'timestamp': timezone.now().isoformat(),
            'worker_hostname': getattr(self.request, 'hostname', 'unknown')
        }
        
        logger.info(f"Celery connection test successful: {result}")
        return result
        
    except Exception as exc:
        logger.error(f"Celery connection test failed: {str(exc)}")
        raise exc