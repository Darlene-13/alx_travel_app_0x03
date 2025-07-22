// src/contexts/AuthContext.jsx
import { createContext, useContext, useReducer, useEffect } from 'react';
import apiService, { isAuthenticated } from '../services/api';

const AuthContext = createContext();

// Auth reducer for state management
const authReducer = (state, action) => {
  switch (action.type) {
    case 'LOGIN_START':
      return { ...state, loading: true, error: null };
    
    case 'LOGIN_SUCCESS':
      return { 
        ...state, 
        loading: false, 
        error: null, 
        isAuthenticated: true, 
        user: action.payload 
      };
    
    case 'LOGIN_FAILURE':
      return { 
        ...state, 
        loading: false, 
        error: action.payload, 
        isAuthenticated: false, 
        user: null 
      };
    
    case 'LOGOUT':
      return { 
        ...state, 
        isAuthenticated: false, 
        user: null, 
        error: null, 
        loading: false 
      };
    
    case 'SET_USER':
      return { 
        ...state, 
        user: action.payload, 
        isAuthenticated: true 
      };
    
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    
    default:
      return state;
  }
};

const initialState = {
  isAuthenticated: isAuthenticated(),
  user: null,
  loading: false,
  error: null,
};

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Check if user is authenticated on app load
  useEffect(() => {
    const initializeAuth = async () => {
      if (isAuthenticated()) {
        dispatch({ type: 'SET_LOADING', payload: true });
        
        const result = await apiService.auth.getCurrentUser();
        
        if (result.success) {
          dispatch({ type: 'SET_USER', payload: result.data });
        } else {
          dispatch({ type: 'LOGOUT' });
        }
        
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };

    initializeAuth();
  }, []);

  const login = async (credentials) => {
    dispatch({ type: 'LOGIN_START' });
    
    const result = await apiService.auth.login(credentials);
    
    if (result.success) {
      // Get user profile after successful login
      const userResult = await apiService.auth.getCurrentUser();
      
      if (userResult.success) {
        dispatch({ type: 'LOGIN_SUCCESS', payload: userResult.data });
        return { success: true };
      } else {
        dispatch({ type: 'LOGIN_FAILURE', payload: 'Failed to get user profile' });
        return { success: false, error: 'Failed to get user profile' };
      }
    } else {
      dispatch({ type: 'LOGIN_FAILURE', payload: result.error });
      return result;
    }
  };

  const logout = () => {
    apiService.auth.logout();
    dispatch({ type: 'LOGOUT' });
  };

  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  const value = {
    ...state,
    login,
    logout,
    clearError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;