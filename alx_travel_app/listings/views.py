"""
API Views for the listings app.

This file contains ViewSets that provide RESTful API endpoints for:
- Listings (property management)
- Bookings (reservation system)
- Reviews (user feedback)
- User Profiles (user management)

Each ViewSet provides full CRUD operations with proper permissions,
filtering, searching, and pagination.
"""
import logging

from rest_framework import viewsets, status, permissions, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.shortcuts import get_object_or_404
from django.contrib.auth.models import User
from django.db.models import Q, Avg
from datetime import date
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAuthenticatedOrReadOnly
from django.utils import timezone
from celery.result import AsyncResult

from .models import UserProfile, Listing, Booking, Review
from .serializers import (
    UserProfileSerializer, 
    ListingSerializer, 
    BookingSerializer, 
    ReviewSerializer
)
from .filters import ListingFilter, BookingFilter  # We'll create these
from.tasks import (
    send_booking_confirmation_email,
    send_booking_reminder_email,
    send_booking_cancellation_email,
    cleanup_old_logs,
    test_celery_connection
)

logger = logging.getLogger(__name__)

class UserProfileViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing user profiles.
    
    Provides endpoints for:
    - GET /api/v1/users/ - List all users
    - GET /api/v1/users/{id}/ - Get specific user
    - POST /api/v1/users/ - Create new user
    - PUT /api/v1/users/{id}/ - Update user
    - DELETE /api/v1/users/{id}/ - Delete user
    """
    
    queryset = UserProfile.objects.all()
    serializer_class = UserProfileSerializer
    lookup_field = 'user_id'  # Use UUID instead of default pk
    
    # Filtering and searching
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['role', 'email_verified']
    search_fields = ['user__username', 'user__email', 'user__first_name', 'user__last_name']
    
    def get_permissions(self):
        """
        Instantiate and return the list of permissions required for this view.
        """
        if self.action == 'list':
            # Anyone can view the list (for hosts, etc.)
            permission_classes = [permissions.IsAuthenticatedOrReadOnly]
        elif self.action == 'create':
            # Anyone can create an account
            permission_classes = [permissions.AllowAny]
        else:
            # Only authenticated users can view/edit profiles
            permission_classes = [permissions.IsAuthenticated]
        
        return [permission() for permission in permission_classes]
    
    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def me(self, request):
        """
        Get current user's profile.
        GET /api/v1/users/me/
        """
        try:
            profile = UserProfile.objects.get(user=request.user)
            serializer = self.get_serializer(profile)
            return Response(serializer.data)
        except UserProfile.DoesNotExist:
            return Response(
                {'error': 'Profile not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=True, methods=['get'])
    def listings(self, request, user_id=None):
        """
        Get all listings for a specific user (host).
        GET /api/v1/users/{id}/listings/
        """
        user_profile = self.get_object()
        listings = Listing.objects.filter(host=user_profile)
        
        # Apply pagination
        page = self.paginate_queryset(listings)
        if page is not None:
            serializer = ListingSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = ListingSerializer(listings, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def bookings(self, request, user_id=None):
        """
        Get all bookings for a specific user.
        GET /api/v1/users/{id}/bookings/
        """
        user_profile = self.get_object()
        bookings = Booking.objects.filter(user=user_profile)
        
        # Apply pagination
        page = self.paginate_queryset(bookings)
        if page is not None:
            serializer = BookingSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = BookingSerializer(bookings, many=True)
        return Response(serializer.data)


class ListingViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing property listings.
    
    Provides endpoints for:
    - GET /api/v1/listings/ - List all listings (with filtering/search)
    - GET /api/v1/listings/{id}/ - Get specific listing
    - POST /api/v1/listings/ - Create new listing
    - PUT /api/v1/listings/{id}/ - Update listing
    - DELETE /api/v1/listings/{id}/ - Delete listing
    
    Additional endpoints:
    - GET /api/v1/listings/{id}/reviews/ - Get reviews for listing
    - GET /api/v1/listings/search/ - Advanced search
    """
    serializer_class = ListingSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]  # Anyone can view, only authenticated users can create/update/delete
    lookup_field = 'property_id'  # Use UUID instead of default pk

    # Filtering, searching, and ordering
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = ListingFilter  # Custom filter class (we'll create this)
    search_fields = ['name', 'description', 'city', 'county']
    ordering_fields = ['price_per_night', 'created_at', 'name']
    ordering = ['-created_at']  # Default ordering (newest first)
    
    def get_queryset(self):
        """ Filter listings based on query parameters and user permissions."""
        # Base query on approved listings
        if self.action == 'list':
            # For list view, only show approved listings
            queryset = Listing.objects.filter(status='approved').select_related('host__user')
        queryset = self.queryset

        #Filter by city
        city = self.request.query_params.get('City', None)
        if city:
            queryset = queryset.filter(city__icontains=city)
        
        #Filter by property type
        property_type = self.request.query_params.get('property_type', None)
        if property_type:
            queryset = queryset.filter(property_type__icontains=property_type)

        # Filter by max guests
        max_guests = self.request.query_params.get('max_guests', None)
        if max_guests:
            try:
                max_guests = int(max_guests)
                queryset = queryset.filter(max_guests__gte=max_guests)
            except ValueError:
                pass
        # Filter by price range
        min_price = self.request.query_params.get('min_price', None)
        max_price = self.request.query_params.get('max_price', None)

        if min_price:
            try:
                min_price = float(min_price)
                queryset = queryset.filter(price_per_night__gte=min_price)
            except ValueError:
                pass

        if max_price:
            try:
                max_price = float(max_price)
                queryset = queryset.filter(price_per_night__lte=max_price)
            except ValueError:
                pass

    
    def get_permissions(self):
        """
        Set permissions based on action.
        """
        if self.action in ['list', 'retrieve']:
            # Anyone can view listings
            permission_classes = [permissions.AllowAny]
        elif self.action == 'create':
            # Only authenticated users can create listings
            permission_classes = [permissions.IsAuthenticated]
        else:
            # Only listing owners can update/delete
            permission_classes = [permissions.IsAuthenticated]
        
        return [permission() for permission in permission_classes]
    
    def perform_create(self, serializer):
        """
        Set the host to the current user when creating a listing.
        """
        # Get or create user profile for the current user
        user_profile, created = UserProfile.objects.get_or_create(
            user=self.request.user,
            defaults={'role': 'host'}
        )
        
        # If user is not a host, update their role
        if user_profile.role == 'guest':
            user_profile.role = 'host'
            user_profile.save()
        
        serializer.save(host=user_profile)
    
    @action(detail=True, methods=['get'])
    def reviews(self, request, property_id=None):
        """
        Get all reviews for a specific listing.
        GET /api/v1/listings/{id}/reviews/
        """
        listing = self.get_object()
        reviews = Review.objects.filter(property=listing).select_related('user__user')
        
        # Apply pagination
        page = self.paginate_queryset(reviews)
        if page is not None:
            serializer = ReviewSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = ReviewSerializer(reviews, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def availability(self, request, property_id=None):
        """
        Check availability for a listing on specific dates.
        GET /api/v1/listings/{id}/availability/?start_date=2024-01-01&end_date=2024-01-07
        """
        listing = self.get_object()
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
        if not start_date or not end_date:
            return Response(
                {'error': 'start_date and end_date parameters are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            from datetime import datetime
            start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
            end_date = datetime.strptime(end_date, '%Y-%m-%d').date()
        except ValueError:
            return Response(
                {'error': 'Invalid date format. Use YYYY-MM-DD'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check for conflicting bookings
        conflicting_bookings = Booking.objects.filter(
            property=listing,
            status__in=['pending', 'confirmed'],
            start_date__lt=end_date,
            end_date__gt=start_date
        )
        
        is_available = not conflicting_bookings.exists()
        
        return Response({
            'available': is_available,
            'start_date': start_date,
            'end_date': end_date,
            'conflicting_bookings': conflicting_bookings.count()
        })
    
    @action(detail=False, methods=['get'])
    def search(self, request):
        """
        Advanced search for listings.
        GET /api/v1/listings/search/?city=New York&min_price=100&max_price=300
        """
        queryset = self.get_queryset()
        
        # Location search
        city = request.query_params.get('city')
        if city:
            queryset = queryset.filter(city__icontains=city)
        
        # Price range
        min_price = request.query_params.get('min_price')
        max_price = request.query_params.get('max_price')
        if min_price:
            queryset = queryset.filter(price_per_night__gte=min_price)
        if max_price:
            queryset = queryset.filter(price_per_night__lte=max_price)
        
        # Property specifications
        bedrooms = request.query_params.get('bedrooms')
        if bedrooms:
            queryset = queryset.filter(bedrooms__gte=bedrooms)
        
        guests = request.query_params.get('guests')
        if guests:
            queryset = queryset.filter(max_guests__gte=guests)
        
        # Apply pagination
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


class BookingViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing bookings/reservations.
    
    Provides endpoints for:
    - GET /api/v1/bookings/ - List user's bookings
    - GET /api/v1/bookings/{id}/ - Get specific booking
    - POST /api/v1/bookings/ - Create new booking
    - PUT /api/v1/bookings/{id}/ - Update booking
    - DELETE /api/v1/bookings/{id}/ - Cancel booking
    """
    
    serializer_class = BookingSerializer
    permissiion_classes = [IsAuthenticated] # Can't make a booking unless you are authenticated
    lookup_field = 'booking_id'  # Use UUID instead of default pk
    permission_classes = [permissions.IsAuthenticated]
    
    # Filtering and ordering
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_class = BookingFilter  # Custom filter class
    ordering_fields = ['start_date', 'created_at', 'total_price']
    ordering = ['-created_at']
    
    def get_queryset(self):
        """
        Return bookings based on user role.
        - Guests see their own bookings
        - Hosts see bookings for their properties
        - Admins see all bookings
        """
        user = self.request.user
        
        try:
            user_profile = UserProfile.objects.get(user=user)
        except UserProfile.DoesNotExist:
            return Booking.objects.none()
        
        if user_profile.role == 'admin':
            # Admins can see all bookings
            return Booking.objects.all().select_related('property', 'user__user')
        elif user_profile.role == 'host':
            # Hosts see bookings for their properties
            return Booking.objects.filter(
                property__host=user_profile
            ).select_related('property', 'user__user')
        else:
            # Guests see only their own bookings
            return Booking.objects.filter(
                user=user_profile
            ).select_related('property', 'user__user')
        
    def create(self, request, *args, **kwargs):
        """
        Create a new booking and send confirmation email asynchronously.
        """
        # Get user profile
        try:
            user_profile = get_object_or_404(UserProfile, user=request.user)

            # Add user_id to the request data
            mutable_data = request.data.copy()
            mutable_data['user_id'] = str(user_profile.user_id)

            # Create a serializer with modified data
            serializer = self.get_serializer(data=mutable_data)

            if serializer.is_valid():
                # Save the booking
                booking = serializer.save()

                # Get the booking details for email
                user = request.user
                user_email = user.email
                user_name = user.get_full_name() or user.username

                # Get listing details
                listing = booking.property
                listing_title = listing.name

                # Format dates
                check_in_date = booking.start_date.strftime('%B %d, %Y')
                check_out_date = booking.end_date.strftime('%B %d, %Y')

                # Prepare additional booking details
                booking_details = {
                    'duration_nights': booking.duration_nights,
                    'total_price': booking.total_price,
                    'booking_id': booking.booking_id,
                    'guests': booking.guests,
                    'property_type': listing.property_type,
                    'city': listing.city,
                    'host_name': listing.host.user.get_full_name() or listing.host.user.username,   
                }

                # Trigger the email task asynchronously
                try:
                    email_task = send_booking_confirmation_email.delay(
                        booking_id=booking.booking_id,
                        user_email=user_email,
                        user_name=user_name,
                        listing_title=listing_title,
                        check_in_date=check_in_date,
                        check_out_date=check_out_date,
                        total_price=booking.total_price,
                        booking_details=booking_details
                    )
                    #Log the task ID for tracking
                    logger.info(f"Booking Confirmation email task queued for {booking.booking_id}, task_id: {email_task.id}")

                    # Prepare response data
                    response_data = serializer.data
                    response_data['email_task_id'] = email_task.id
                    response_data['message'] = "Booking created successfully. Confirmation email will be sent to you shortly."

                    return Response(response_data, status=status.HTTP_201_CREATED)
                except Exception as email_error:
                    logger.error(f"Error sending booking confirmation email: {str(e)}")
                    response_data = serializer.data
                    response_data['message'] = 'Booking created successfully but email notification failed.'
                    response_data['email_error'] = str(email_error)
                    return Response(
                        response_data,
                        status=status.HTTP_201_CREATED
                    )
            else:
                return Response(serializer.errors, status=status.HTTP_404_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Error creating booking: {str(e)}")
            return Response(
                {'error': f"Failed to create booking: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    def update(self, request, *args, **kwargs):
        """
        Update a booking and optionally send notification.
        """
        try:
            partial = kwargs.pop('partial', False)
            instance = self.get_object()
            serializer = self.get_serializer(instance, data=request.data, partial=partial)
            
            if serializer.is_valid():
                # Check if important fields changed
                important_fields_changed = False
                if hasattr(instance, 'start_date') and 'start_date' in request.data:
                    if str(instance.start_date) != str(request.data.get('start_date')):
                        important_fields_changed = True
                
                if hasattr(instance, 'end_date') and 'end_date' in request.data:
                    if str(instance.end_date) != str(request.data.get('end_date')):
                        important_fields_changed = True
                
                # Save the updated booking
                updated_booking = serializer.save()
                
                # Send update notification if important fields changed
                if important_fields_changed:
                    try:
                        user = request.user
                        send_booking_confirmation_email.delay(
                            booking_id=str(updated_booking.booking_id),
                            user_email=user.email,
                            user_name=f"{user.first_name} {user.last_name}".strip() or user.username,
                            listing_title=updated_booking.property.name,
                            check_in_date=updated_booking.start_date.strftime('%B %d, %Y'),
                            check_out_date=updated_booking.end_date.strftime('%B %d, %Y'),
                            total_price=str(updated_booking.total_price)
                        )
                        logger.info(f"Update notification sent for booking {updated_booking.booking_id}")
                    except Exception as e:
                        logger.error(f"Failed to send update notification: {str(e)}")
                
                return Response(serializer.data)
            else:
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
                
        except Exception as e:
            logger.error(f"Error updating booking: {str(e)}")
            return Response(
                {'error': 'Failed to update booking'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def destroy(self, request, *args, **kwargs):
        """
        Cancel a booking and send cancellation email.
        """
        try:
            instance = self.get_object()
            
            # Send cancellation email before deleting
            try:
                user = request.user
                send_booking_cancellation_email.delay(
                    booking_id=str(instance.booking_id),
                    user_email=user.email,
                    user_name=f"{user.first_name} {user.last_name}".strip() or user.username,
                    listing_title=instance.property.name,
                    cancellation_reason=request.data.get('cancellation_reason', 'User requested cancellation')
                )
                logger.info(f"Cancellation email queued for booking {instance.booking_id}")
            except Exception as e:
                logger.error(f"Failed to send cancellation email: {str(e)}")
            
            # Delete the booking
            self.perform_destroy(instance)
            
            return Response(
                {'message': 'Booking cancelled successfully. Cancellation email will be sent shortly.'},
                status=status.HTTP_204_NO_CONTENT
            )
            
        except Exception as e:
            logger.error(f"Error cancelling booking: {str(e)}")
            return Response(
                {'error': 'Failed to cancel booking'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['post'])
    def send_reminder(self, request, pk=None):
        """
        Manually send a reminder email for a specific booking.
        """
        try:
            booking = self.get_object()
            user = request.user
            
            # Calculate days until check-in
            days_until = (booking.start_date - timezone.now().date()).days
            
            email_task = send_booking_reminder_email.delay(
                booking_id=str(booking.booking_id),
                user_email=user.email,
                user_name=f"{user.first_name} {user.last_name}".strip() or user.username,
                listing_title=booking.property.name,
                check_in_date=booking.start_date.strftime('%B %d, %Y'),
                days_until_checkin=days_until
            )
            
            return Response({
                'message': 'Reminder email sent successfully',
                'task_id': email_task.id,
                'days_until_checkin': days_until
            })
            
        except Exception as e:
            logger.error(f"Error sending reminder: {str(e)}")
            return Response(
                {'error': 'Failed to send reminder email'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def perform_create(self, serializer):
        """
        Set the user to the current user when creating a booking.
        """
        # Get user profile
        user_profile, created = UserProfile.objects.get_or_create(
            user=self.request.user,
            defaults={'role': 'guest'}
        )
        
        # Get the property
        property_id = serializer.validated_data.get('property_id')
        listing = get_object_or_404(Listing, property_id=property_id)
        
        # Calculate total price
        start_date = serializer.validated_data['start_date']
        end_date = serializer.validated_data['end_date']
        nights = (end_date - start_date).days
        total_price = listing.price_per_night * nights
        
        serializer.save(
            user=user_profile,
            property=listing,
            total_price=total_price
        )
    
    @action(detail=True, methods=['post'])
    def confirm(self, request, booking_id=None):
        """
        Confirm a pending booking (host only).
        POST /api/v1/bookings/{id}/confirm/
        """
        booking = self.get_object()
        
        # Check if user is the host of the property
        user_profile = UserProfile.objects.get(user=request.user)
        if booking.property.host != user_profile:
            return Response(
                {'error': 'Only the property host can confirm bookings'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        if booking.status != 'pending':
            return Response(
                {'error': 'Only pending bookings can be confirmed'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        booking.status = 'confirmed'
        booking.save()
        
        serializer = self.get_serializer(booking)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def cancel(self, request, booking_id=None):
        """
        Cancel a booking.
        POST /api/v1/bookings/{id}/cancel/
        """
        booking = self.get_object()
        
        # Check permissions (guest or host can cancel)
        user_profile = UserProfile.objects.get(user=request.user)
        if booking.user != user_profile and booking.property.host != user_profile:
            return Response(
                {'error': 'You can only cancel your own bookings or bookings for your properties'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        if booking.status in ['canceled', 'completed']:
            return Response(
                {'error': f'Cannot cancel {booking.status} booking'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        booking.status = 'canceled'
        booking.save()
        
        serializer = self.get_serializer(booking)
        return Response(serializer.data)


class ReviewViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing reviews.
    
    Provides endpoints for:
    - GET /api/v1/reviews/ - List reviews
    - GET /api/v1/reviews/{id}/ - Get specific review
    - POST /api/v1/reviews/ - Create new review
    - PUT /api/v1/reviews/{id}/ - Update review
    - DELETE /api/v1/reviews/{id}/ - Delete review
    """
    
    serializer_class = ReviewSerializer
    lookup_field = 'review_id'
    permission_classes = [IsAuthenticated]
    
    # Filtering and ordering
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['rating', 'property']
    ordering_fields = ['rating', 'created_at']
    ordering = ['-created_at']
    
    def get_queryset(self):
        """
        Return reviews based on user role.
        """
        queryset = Review.objects.all()
        user = self.request.user
        
        try:
            user_profile = UserProfile.objects.get(user=user)
        except UserProfile.DoesNotExist:
            return Review.objects.none()
        
        if user_profile.role == 'admin':
            # Admins can see all reviews
            return Review.objects.all().select_related('user__user', 'property')
        elif user_profile.role == 'host':
            # Hosts see reviews for their properties
            return Review.objects.filter(
                property__host=user_profile
            ).select_related('user__user', 'property')
        else:
            # Guests see reviews they've written
            return Review.objects.filter(
                user=user_profile
            ).select_related('user__user', 'property')
        
    def create(self, request, *args, **kwargs):
        """
        create a new review
        """
        try:
            user_profile = get_object_or_404(UserProfile, user=request.user)

            #Add user id to request data
            mutable_data = request.data.copy()
            mutable_data['user'] = str(user_profile.user_id)

            serializer = self.get_serializer(data=mutable_data)

            if serializer.is_valid():
                review=serializer.save()
                logger.info(f"Review created: {review.review_id}")
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            else:
                logger.error(f"Review creation failed: {serializer.errors}")
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f" Error creating review: {str(e)}")
            return Response({'error': f"Failed to create review: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
    def perform_create(self, serializer):
        """
        Set the user to the current user when creating a review.
        """
        user_profile = UserProfile.objects.get(user=self.request.user)
        
        # Get booking and property
        booking_id = serializer.validated_data.get('booking_id')
        property_id = serializer.validated_data.get('property_id')
        
        booking = get_object_or_404(Booking, booking_id=booking_id)
        listing = get_object_or_404(Listing, property_id=property_id)
        
        serializer.save(
            user=user_profile,
            booking=booking,
            property=listing
        )
    
    @action(detail=True, methods=['post'])
    def respond(self, request, review_id=None):
        """
        Add host response to a review (host only).
        POST /api/v1/reviews/{id}/respond/
        """
        review = self.get_object()
        
        # Check if user is the host of the property
        user_profile = UserProfile.objects.get(user=request.user)
        if review.property.host != user_profile:
            return Response(
                {'error': 'Only the property host can respond to reviews'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        host_response = request.data.get('host_response')
        if not host_response:
            return Response(
                {'error': 'host_response is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        from django.utils import timezone
        review.host_response = host_response
        review.host_response_date = timezone.now()
        review.save()
        
        serializer = self.get_serializer(review)
        return Response(serializer.data)
    

# TASK MONITORING VIEWS
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def check_email_task_status(request, task_id):
    """
    Check the status of the email that is sending the task.
    Usage: GET /api/email-task-status/<task_id>/
    """
    try:
        task_result = AsyncResult(task_id)

        response_data = {
            'task_id': task_id,
            'status': task_result.status,
            'ready': task_result.ready(),
            'successful': task_result.successful() if task_result.ready() else None,
        }

        if task_result.ready():
            if task_result.successful():
                response_data['result'] = task_result.result
            else:
                response_data['error'] = str(task_result.info)
        else:
            response_data['message'] = 'Task is still in progress'

        return Response(response_data, status=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f" Error checking task status: {str(e)}")
        return Response (
            {'error': f'Failed to check task status: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
@api_view(['POST'])
@permission_classes(['IsAuthenticated'])
def test_celery(request):
    """
    Test Celery connection and task execution.
    Usage: POST/api/test-celery/
    """
    try:
        # Run the test task
        task = test_celery_connection.delay()
        return Response(
            {
            'message': 'Test task created successfully',
            'task_id': task.id,
            'status': 'Task is currently running.......',
            'check_status_url': f'/api/email-task-status/{task.id}/'
            }
        )
    except Exception as e:
        logger.error(f"Error testing celery connection: {str(e)}")
        return Response({
            'error': f'Celery test failed: {str(e)}',
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes(['IsAuthenticated'])
def send_test_email(request):
    """
    Send a test email to verify the current email functionality.
    Usage: POST /api/send-test-email/
    Body:{"email": "test@example.com"}
    """
    try:
        # Get the email from the request data
        email = request.data.get('email') or request.user.email

        task = send_booking_confirmation_email.delay(
            booking_id="TEST-123",
            user_email=email,
            user_name=request.user.get_full_name() or request.user.username,
            listing_title="Test Property",
            check_in_date="January 1 2024",
            check_out_date="January 7 2024",
            total_price="500.00"
        )
        return Response({
            'message': f'Test email successfully queued to {email}',
            'task_id': task.id,
            'status': 'Task is currently running.......',
        })

    except Exception as e:
        logger.error(f"Error sending test email:{str(e)}")
        return Response(
            {'error':f'Test email failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

