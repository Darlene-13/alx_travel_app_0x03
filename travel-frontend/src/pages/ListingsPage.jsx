import { useState, useEffect } from 'react';
import apiService from '../services/api';
import { showToast } from '../components/Toast';
import { LoadingSpinner } from '../components/LoadingSpinner';
import {
  BuildingOfficeIcon,
  MapPinIcon,
  UserGroupIcon,
  CurrencyDollarIcon,
  CalendarIcon,
  StarIcon
} from '@heroicons/react/24/outline';

const ListingsPage = () => {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedListing, setSelectedListing] = useState(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingData, setBookingData] = useState({
    start_date: '',
    end_date: '',
    guests: 1,
    total_price: 0
  });
  const [bookingLoading, setBookingLoading] = useState(false);

  useEffect(() => {
    loadListings();
  }, []);

  const loadListings = async () => {
    const result = await apiService.listings.getAll();
    
    if (result.success) {
      setListings(result.data.results || result.data || []);
    } else {
      showToast('Failed to load listings', 'error');
    }
    setLoading(false);
  };

  const openBookingModal = (listing) => {
    setSelectedListing(listing);
    setBookingData({
      start_date: '',
      end_date: '',
      guests: 1,
      total_price: 0
    });
    setShowBookingModal(true);
  };

  const calculatePrice = (startDate, endDate, pricePerNight) => {
    if (!startDate || !endDate) return 0;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    const timeDiff = end.getTime() - start.getTime();
    const dayDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
    
    return Math.max(0, dayDiff * parseFloat(pricePerNight));
  };

  const handleBookingChange = (e) => {
    const { name, value } = e.target;
    const newBookingData = { ...bookingData, [name]: value };
    
    if (selectedListing && (name === 'start_date' || name === 'end_date')) {
      newBookingData.total_price = calculatePrice(
        newBookingData.start_date,
        newBookingData.end_date,
        selectedListing.price_per_night
      );
    }
    
    setBookingData(newBookingData);
  };

  const createBooking = async () => {
    if (!selectedListing) return;
    
    setBookingLoading(true);
    
    const bookingPayload = {
      property_id: selectedListing.property_id,
      start_date: bookingData.start_date,
      end_date: bookingData.end_date,
      guests: parseInt(bookingData.guests),
      total_price: bookingData.total_price.toString()
    };

    const result = await apiService.bookings.create(bookingPayload);
    
    if (result.success) {
      showToast('🎉 Booking created! Confirmation email is being sent in the background.', 'success');
      
      // Show task ID if available
      if (result.data.email_task_id) {
        setTimeout(() => {
          showToast(`📧 Email Task ID: ${result.data.email_task_id}`, 'info');
        }, 1000);
      }
      
      setShowBookingModal(false);
      setSelectedListing(null);
    } else {
      showToast(`Failed to create booking: ${result.error?.detail || 'Please try again'}`, 'error');
    }
    
    setBookingLoading(false);
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
          <BuildingOfficeIcon className="h-8 w-8 mr-3 text-primary-600" />
          Available Listings
        </h1>
        <p className="mt-2 text-gray-600">
          Discover amazing places to stay for your next adventure.
        </p>
      </div>

      {/* Listings Grid */}
      {listings.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {listings.map((listing) => (
            <div key={listing.property_id} className="card hover:shadow-lg transition-shadow">
              {/* Listing Image Placeholder */}
              <div className="h-48 bg-gradient-to-r from-primary-400 to-primary-600 rounded-lg mb-4 flex items-center justify-center">
                <BuildingOfficeIcon className="h-16 w-16 text-white opacity-50" />
              </div>

              {/* Listing Info */}
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">
                    {listing.name}
                  </h3>
                  <div className="flex items-center ml-2">
                    <StarIcon className="h-4 w-4 text-yellow-400" />
                    <span className="text-sm text-gray-600 ml-1">
                      {listing.average_rating > 0 ? listing.average_rating.toFixed(1) : 'New'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center text-gray-600 text-sm">
                  <MapPinIcon className="h-4 w-4 mr-1" />
                  {listing.city}, {listing.county}
                </div>

                <p className="text-sm text-gray-600 line-clamp-2">
                  {listing.description}
                </p>

                <div className="flex items-center justify-between text-sm text-gray-600">
                  <div className="flex items-center">
                    <UserGroupIcon className="h-4 w-4 mr-1" />
                    Up to {listing.max_guests} guests
                  </div>
                  <div className="flex items-center">
                    <BuildingOfficeIcon className="h-4 w-4 mr-1" />
                    {listing.bedroom} bed, {listing.bathroom} bath
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                  <div className="flex items-center">
                    <CurrencyDollarIcon className="h-5 w-5 text-green-600 mr-1" />
                    <span className="text-xl font-bold text-gray-900">
                      ${listing.price_per_night}
                    </span>
                    <span className="text-sm text-gray-600 ml-1">/night</span>
                  </div>
                  <button
                    onClick={() => openBookingModal(listing)}
                    className="btn-primary"
                  >
                    <CalendarIcon className="h-4 w-4 mr-1" />
                    Book Now
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <BuildingOfficeIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No listings available</h3>
          <p className="text-gray-600">Check back later for new properties.</p>
        </div>
      )}

      {/* Booking Modal */}
      {showBookingModal && selectedListing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full max-h-screen overflow-y-auto">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Book {selectedListing.name}
                </h3>
                <button
                  onClick={() => setShowBookingModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {/* Check-in Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Check-in Date
                </label>
                <input
                  type="date"
                  name="start_date"
                  value={bookingData.start_date}
                  onChange={handleBookingChange}
                  min={new Date().toISOString().split('T')[0]}
                  className="input"
                  required
                />
              </div>

              {/* Check-out Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Check-out Date
                </label>
                <input
                  type="date"
                  name="end_date"
                  value={bookingData.end_date}
                  onChange={handleBookingChange}
                  min={bookingData.start_date || new Date().toISOString().split('T')[0]}
                  className="input"
                  required
                />
              </div>

              {/* Guests */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Number of Guests
                </label>
                <select
                  name="guests"
                  value={bookingData.guests}
                  onChange={handleBookingChange}
                  className="input"
                >
                  {Array.from({ length: selectedListing.max_guests }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {i + 1} guest{i + 1 > 1 ? 's' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Price Summary */}
              {bookingData.total_price > 0 && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">
                      ${selectedListing.price_per_night} x {Math.ceil((new Date(bookingData.end_date) - new Date(bookingData.start_date)) / (1000 * 3600 * 24))} nights
                    </span>
                    <span className="text-sm text-gray-900">
                      ${bookingData.total_price}
                    </span>
                  </div>
                  <div className="border-t border-gray-200 pt-2">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-gray-900">Total</span>
                      <span className="font-semibold text-gray-900">
                        ${bookingData.total_price}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Email Notice */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  📧 A confirmation email will be sent automatically after booking completion using our background task system!
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-200 flex space-x-3">
              <button
                onClick={() => setShowBookingModal(false)}
                className="btn-secondary flex-1"
                disabled={bookingLoading}
              >
                Cancel
              </button>
              <button
                onClick={createBooking}
                disabled={bookingLoading || !bookingData.start_date || !bookingData.end_date || bookingData.total_price <= 0}
                className="btn-primary flex-1"
              >
                {bookingLoading ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Creating...
                  </>
                ) : (
                  `Book for $${bookingData.total_price}`
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};