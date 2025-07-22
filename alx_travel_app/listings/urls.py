


"""
URL patterns for the listings app API endpoints.

This file configures all the REST API endpoints using DRF routers.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from django.views.decorators.csrf import csrf_exempt
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

from .views import (
    UserProfileViewSet,
    ListingViewSet,
    BookingViewSet,
    ReviewViewSet,
    check_email_task_status,
    test_celery,
    send_test_email
)

# Create a router and register our viewsets
router = DefaultRouter()

# Register viewsets with the router
# This automatically creates all CRUD endpoints
router.register(r'users', UserProfileViewSet, basename='userprofile')
router.register(r'listings', ListingViewSet, basename='listing')
router.register(r'bookings', BookingViewSet, basename='booking')
router.register(r'reviews', ReviewViewSet, basename='review')


# URL patterns
urlpatterns = [
    # Include router URLs
    path('', include(router.urls)),
    

    # Authentication endpoints
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # Task monitoring endpoints
    path('api/email-task-status/<str:task_id>/', check_email_task_status, name='email_task_status'),
    path('api/test-celery/', test_celery, name='test_celery'),
    path('api/send-test-email/', send_test_email, name='send_test_email'),

]

app_name = 'listings'