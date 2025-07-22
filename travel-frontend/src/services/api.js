// src/services/api.js
import axios from 'axios';

// Base configuration
const API_BASE_URL = 'http://127.0.0.1:8000';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Auth token management
const getAuthToken = () => {
  return localStorage.getItem('access_token');
};

const setAuthToken = (token) => {
  localStorage.setItem('access_token', token);
};

const removeAuthToken = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
};

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/api/token/refresh/`, {
            refresh: refreshToken
          });
          
          const { access } = response.data;
          setAuthToken(access);
          originalRequest.headers.Authorization = `Bearer ${access}`;
          
          return api(originalRequest);
        }
      } catch (refreshError) {
        removeAuthToken();
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

// API Service Object
const apiService = {
  // Authentication
  auth: {
    login: async (credentials) => {
      try {
        const response = await api.post('/api/token/', credentials);
        const { access, refresh } = response.data;
        
        setAuthToken(access);
        localStorage.setItem('refresh_token', refresh);
        
        return { success: true, data: response.data };
      } catch (error) {
        return { 
          success: false, 
          error: error.response?.data || { message: 'Login failed' }
        };
      }
    },
    
    logout: () => {
      removeAuthToken();
      return { success: true };
    },
    
    getCurrentUser: async () => {
      try {
        const response = await api.get('/api/profiles/me/');
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: error.response?.data };
      }
    }
  },

  // Listings
  listings: {
    getAll: async (params = {}) => {
      try {
        const response = await api.get('/api/listings/', { params });
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: error.response?.data };
      }
    },
    
    getById: async (id) => {
      try {
        const response = await api.get(`/api/listings/${id}/`);
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: error.response?.data };
      }
    },
    
    create: async (listingData) => {
      try {
        const response = await api.post('/api/listings/', listingData);
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: error.response?.data };
      }
    }
  },

  // Bookings
  bookings: {
    getAll: async () => {
      try {
        const response = await api.get('/api/bookings/');
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: error.response?.data };
      }
    },
    
    create: async (bookingData) => {
      try {
        console.log('Creating booking:', bookingData);
        const response = await api.post('/api/bookings/', bookingData);
        return { success: true, data: response.data };
      } catch (error) {
        console.error('Booking error:', error.response?.data);
        return { success: false, error: error.response?.data };
      }
    },
    
    cancel: async (bookingId) => {
      try {
        const response = await api.delete(`/api/bookings/${bookingId}/`);
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: error.response?.data };
      }
    }
  },

  // Task Monitoring (Celery)
  tasks: {
    checkEmailStatus: async (taskId) => {
      try {
        const response = await api.get(`/api/email-task-status/${taskId}/`);
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: error.response?.data };
      }
    },
    
    testCelery: async () => {
      try {
        const response = await api.post('/api/test-celery/');
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: error.response?.data };
      }
    },
    
    sendTestEmail: async (email) => {
      try {
        const response = await api.post('/api/send-test-email/', { email });
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: error.response?.data };
      }
    }
  },

  // Reviews
  reviews: {
    getByProperty: async (propertyId) => {
      try {
        const response = await api.get(`/api/reviews/?property_id=${propertyId}`);
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: error.response?.data };
      }
    },
    
    create: async (reviewData) => {
      try {
        const response = await api.post('/api/reviews/', reviewData);
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: error.response?.data };
      }
    }
  }
};

export default apiService;

// Utility functions
export const isAuthenticated = () => {
  return !!getAuthToken();
};

export const getToken = getAuthToken;
export const formatError = (error) => {
  if (typeof error === 'string') return error;
  if (error?.message) return error.message;
  if (error?.detail) return error.detail;
  if (Array.isArray(error)) return error.join(', ');
  return 'An error occurred';
};