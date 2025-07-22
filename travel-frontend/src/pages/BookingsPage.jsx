import { useState, useEffect } from 'react';
import apiService from '../services/api';
import { showToast } from '../components/Toast';
import { LoadingSpinner } from '../components/LoadingSpinner';
import {
  CalendarIcon,
  UserGroupIcon,
  CurrencyDollarIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  MapPinIcon
} from '@heroicons/react/24/outline';

const BookingsPage = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBookings();
  }, []);

  const loadBookings = async () => {
    const result = await apiService.bookings.getAll();
    
    if (result.success) {
      setBookings(result.data.results || result.data || []);
    } else {
      showToast('Failed to load bookings', 'error');
    }
    setLoading(false);
  };

  const cancelBooking = async (bookingId) => {
    if (!confirm('Are you sure you want to cancel this booking?')) return;
    
    const result = await apiService.bookings.cancel(bookingId);
    
    if (result.success) {
      showToast('Booking cancelled successfully. Cancellation email sent!', 'success');
      loadBookings(); // Refresh the list
    } else {
      showToast('Failed to cancel booking', 'error');
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'confirmed':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'completed':
        return <CheckCircleIcon className="h-5 w-5 text-blue-500" />;
      case 'canceled':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      default:
        return <ClockIcon className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      case 'canceled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
          <CalendarIcon className="h-8 w-8 mr-3 text-green-600" />
          My Bookings
        </h1>
        <p className="mt-2 text-gray-600">
          Manage your reservations and track confirmation emails.
        </p>
      </div>

      {/* Bookings List */}
      {bookings.length > 0 ? (
        <div className="space-y-6">
          {bookings.map((booking) => (
            <div key={booking.booking_id || booking.id} className="card">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between">
                {/* Booking Info */}
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {booking.property?.name || 'Booking'}
                      </h3>
                      <div className="flex items-center text-gray-600 text-sm mt-1">
                        <MapPinIcon className="h-4 w-4 mr-1" />
                        {booking.property?.city}, {booking.property?.county}
                      </div>
                    </div>
                    <div className="flex items-center">
                      {getStatusIcon(booking.status)}
                      <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(booking.status)}`}>
                        {booking.status || 'Pending'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Check-in</p>
                      <p className="font-medium text-gray-900">{booking.start_date}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Check-out</p>
                      <p className="font-medium text-gray-900">{booking.end_date}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Guests</p>
                      <p className="font-medium text-gray-900 flex items-center">
                        <UserGroupIcon className="h-4 w-4 mr-1" />
                        {booking.guests}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Total Price</p>
                      <p className="font-medium text-gray-900 flex items-center">
                        <CurrencyDollarIcon className="h-4 w-4 mr-1" />
                        {booking.total_price}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-4 lg:mt-0 lg:ml-6 flex space-x-3">
                  {(booking.status?.toLowerCase() === 'confirmed' || booking.status?.toLowerCase() === 'pending') && (
                    <button
                      onClick={() => cancelBooking(booking.booking_id || booking.id)}
                      className="btn-danger"
                    >
                      Cancel Booking
                    </button>
                  )}
                </div>
              </div>

              {/* Email Notice */}
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  📧 Confirmation emails are sent automatically via our background task system. 
                  Check the <a href="/tasks" className="underline">Task Monitor</a> to see email processing status.
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <CalendarIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No bookings yet</h3>
          <p className="text-gray-600 mb-6">Start exploring and book your first stay!</p>
          <a href="/listings" className="btn-primary">
            Browse Listings
          </a>
        </div>
      )}
    </div>
  );
};

export { ListingsPage, BookingsPage };