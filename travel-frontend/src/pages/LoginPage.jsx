// src/pages/LoginPage.jsx
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { showToast } from '../components/Toast';
import { formatError } from '../services/api';

const LoginPage = () => {
  const [credentials, setCredentials] = useState({
    username: 'john_guest', // Pre-filled for testing
    password: 'testpass123'
  });
  const { login, loading, error, clearError } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();
    
    const result = await login(credentials);
    
    if (result.success) {
      showToast('Login successful! Welcome to ALX Travel App.', 'success');
    } else {
      showToast(`Login failed: ${formatError(result.error)}`, 'error');
    }
  };

  const handleChange = (e) => {
    setCredentials({
      ...credentials,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div>
          <div className="mx-auto h-20 w-20 flex items-center justify-center bg-primary-100 rounded-full">
            <span className="text-3xl">🏨</span>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Welcome to ALX Travel
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Sign in to your account to continue
          </p>
        </div>

        {/* Login Form */}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                value={credentials.username}
                onChange={handleChange}
                className="input"
                placeholder="Enter your username"
                disabled={loading}
              />
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={credentials.password}
                onChange={handleChange}
                className="input"
                placeholder="Enter your password"
                disabled={loading}
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
              <p className="text-sm">{formatError(error)}</p>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </div>

          {/* Demo Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mt-6">
            <h3 className="text-sm font-medium text-blue-800 mb-2">Demo Account</h3>
            <p className="text-xs text-blue-700 mb-2">
              Use the pre-filled credentials to test the application:
            </p>
            <ul className="text-xs text-blue-600 space-y-1">
              <li>• <strong>Username:</strong> john_guest</li>
              <li>• <strong>Password:</strong> testpass123</li>
              <li>• <strong>Role:</strong> Guest (can make bookings)</li>
            </ul>
          </div>

          {/* Features Preview */}
          <div className="bg-gray-50 rounded-md p-4 mt-4">
            <h3 className="text-sm font-medium text-gray-800 mb-2">✨ Features to Explore</h3>
            <ul className="text-xs text-gray-600 space-y-1">
              <li>🏠 Browse available listings</li>
              <li>📅 Create bookings with real-time email notifications</li>
              <li>📧 Background email processing with Celery</li>
              <li>🔍 Monitor task execution in real-time</li>
              <li>📱 Responsive design for all devices</li>
            </ul>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;