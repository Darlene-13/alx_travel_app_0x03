// src/pages/Dashboard.jsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import { showToast } from '../components/Toast';
import { LoadingSpinner } from '../components/LoadingSpinner';
import {
  BuildingOfficeIcon,
  CalendarIcon,
  UserIcon,
  CpuChipIcon,
  EnvelopeIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    listings: 0,
    bookings: 0,
    emailTasks: 0
  });
  const [recentBookings, setRecentBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [testingCelery, setTestingCelery] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [listingsResult, bookingsResult] = await Promise.all([
        apiService.listings.getAll(),
        apiService.bookings.getAll()
      ]);

      if (listingsResult.success) {
        setStats(prev => ({ ...prev, listings: listingsResult.data.results?.length || listingsResult.data.length || 0 }));
      }

      if (bookingsResult.success) {
        const bookingsData = bookingsResult.data.results || bookingsResult.data || [];
        setStats(prev => ({ ...prev, bookings: bookingsData.length }));
        setRecentBookings(bookingsData.slice(0, 5));
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const testCeleryConnection = async () => {
    setTestingCelery(true);
    try {
      const result = await apiService.tasks.testCelery();
      
      if (result.success) {
        showToast('✅ Celery is working! Background tasks are ready.', 'success');
        
        // Check task status after a short delay
        setTimeout(async () => {
          const statusResult = await apiService.tasks.checkEmailStatus(result.data.task_id);
          if (statusResult.success) {
            showToast(`📊 Task Status: ${statusResult.data.status}`, 'info');
          }
        }, 2000);
      } else {
        showToast('❌ Celery test failed. Check your worker status.', 'error');
      }
    } catch (error) {
      showToast('❌ Error testing Celery connection.', 'error');
    } finally {
      setTestingCelery(false);
    }
  };

  const sendTestEmail = async () => {
    try {
      const result = await apiService.tasks.sendTestEmail(user.linked_user?.email || 'test@example.com');
      
      if (result.success) {
        showToast('📧 Test email queued! Check your console for output.', 'success');
      } else {
        showToast('❌ Failed to send test email.', 'error');
      }
    } catch (error) {
      showToast('❌ Error sending test email.', 'error');
    }
  };

  const getStatusBadge = (status) => {
    const statusStyles = {
      pending: 'bg-yellow-100 text-yellow-800',
      confirmed: 'bg-green-100 text-green-800',
      completed: 'bg-blue-100 text-blue-800',
      canceled: 'bg-red-100 text-red-800'
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyles[status] || statusStyles.pending}`}>
        {status}
      </span>
    );
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
      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {user?.linked_user?.first_name || user?.username || 'User'}! 👋
        </h1>
        <p className="mt-2 text-gray-600">
          Here's what's happening with your ALX Travel App today.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="card">
          <div className="flex items-center">
            <div className="p-2 bg-primary-100 rounded-lg">
              <BuildingOfficeIcon className="h-6 w-6 text-primary-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Available Listings</p>
              <p className="text-2xl font-bold text-gray-900">{stats.listings}</p>
            </div>
          </div>
          <div className="mt-4">
            <Link to="/listings" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
              View all listings →
            </Link>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <CalendarIcon className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Your Bookings</p>
              <p className="text-2xl font-bold text-gray-900">{stats.bookings}</p>
            </div>
          </div>
          <div className="mt-4">
            <Link to="/bookings" className="text-sm text-green-600 hover:text-green-700 font-medium">
              Manage bookings →
            </Link>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <CpuChipIcon className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Background Tasks</p>
              <p className="text-2xl font-bold text-gray-900">Active</p>
            </div>
          </div>
          <div className="mt-4">
            <Link to="/tasks" className="text-sm text-purple-600 hover:text-purple-700 font-medium">
              Monitor tasks →
            </Link>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <UserIcon className="h-6 w-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Account Type</p>
              <p className="text-lg font-bold text-gray-900 capitalize">{user?.role}</p>
            </div>
          </div>
          <div className="mt-4">
            <span className="text-sm text-orange-600 font-medium">
              {user?.email_verified ? '✅ Verified' : '⏳ Pending'}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Celery System Status */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <CpuChipIcon className="h-5 w-5 mr-2 text-purple-600" />
              Background Task System
            </h3>
            <div className="flex space-x-2">
              <button
                onClick={testCeleryConnection}
                disabled={testingCelery}
                className="btn-secondary text-sm"
              >
                {testingCelery ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-1" />
                    Testing...
                  </>
                ) : (
                  'Test Celery'
                )}
              </button>
              <button
                onClick={sendTestEmail}
                className="btn-primary text-sm"
              >
                <EnvelopeIcon className="h-4 w-4 mr-1" />
                Test Email
              </button>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center">
                <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
                <span className="text-sm font-medium">Email Notifications</span>
              </div>
              <span className="text-sm text-green-600">Active</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center">
                <ClockIcon className="h-5 w-5 text-blue-500 mr-2" />
                <span className="text-sm font-medium">Task Queue</span>
              </div>
              <span className="text-sm text-blue-600">Ready</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center">
                <CpuChipIcon className="h-5 w-5 text-purple-500 mr-2" />
                <span className="text-sm font-medium">Worker Status</span>
              </div>
              <span className="text-sm text-purple-600">Online</span>
            </div>
          </div>

          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              🚀 <strong>Try it out:</strong> Create a new booking and watch the confirmation email get processed in the background!
            </p>
          </div>
        </div>

        {/* Recent Bookings */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <CalendarIcon className="h-5 w-5 mr-2 text-green-600" />
              Recent Bookings
            </h3>
            <Link to="/bookings" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
              View all
            </Link>
          </div>

          {recentBookings.length > 0 ? (
            <div className="space-y-3">
              {recentBookings.map((booking) => (
                <div key={booking.booking_id || booking.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {booking.property?.name || 'Booking'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {booking.start_date} → {booking.end_date}
                    </p>
                  </div>
                  <div className="text-right">
                    {getStatusBadge(booking.status?.toLowerCase() || 'pending')}
                    <p className="text-xs text-gray-500 mt-1">
                      ${booking.total_price}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <CalendarIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No bookings yet</p>
              <Link to="/listings" className="btn-primary mt-4 inline-block">
                Browse Listings
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            to="/listings"
            className="card hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className="text-center">
              <div className="p-3 bg-blue-100 rounded-lg inline-block mb-3">
                <BuildingOfficeIcon className="h-8 w-8 text-blue-600" />
              </div>
              <h4 className="font-medium text-gray-900">Browse Listings</h4>
              <p className="text-sm text-gray-500 mt-1">Find your perfect stay</p>
            </div>
          </Link>

          <Link
            to="/bookings"
            className="card hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className="text-center">
              <div className="p-3 bg-green-100 rounded-lg inline-block mb-3">
                <CalendarIcon className="h-8 w-8 text-green-600" />
              </div>
              <h4 className="font-medium text-gray-900">My Bookings</h4>
              <p className="text-sm text-gray-500 mt-1">Manage your reservations</p>
            </div>
          </Link>

          <Link
            to="/tasks"
            className="card hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className="text-center">
              <div className="p-3 bg-purple-100 rounded-lg inline-block mb-3">
                <CpuChipIcon className="h-8 w-8 text-purple-600" />
              </div>
              <h4 className="font-medium text-gray-900">Task Monitor</h4>
              <p className="text-sm text-gray-500 mt-1">Watch background tasks</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;