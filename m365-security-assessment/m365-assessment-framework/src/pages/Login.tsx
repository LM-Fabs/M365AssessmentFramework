import React, { useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';

const Login: React.FC = () => {
  const { isLoading, error, isAuthenticated } = useAuth();

  useEffect(() => {
    // If we end up here and we're not authenticated, redirect to Azure AD login
    if (!isLoading && !isAuthenticated) {
      window.location.href = '/.auth/login/aad';
    }
  }, [isLoading, isAuthenticated]);

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Initializing authentication...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <p className="error-message">{error}</p>
      </div>
    );
  }

  return (
    <div className="loading-container">
      <div className="loading-spinner"></div>
      <p>Redirecting to login...</p>
    </div>
  );
};

export default Login;