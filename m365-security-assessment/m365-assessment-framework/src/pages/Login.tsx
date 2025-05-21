import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { isLoading, error, isAuthenticated, login } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !error) {
      login();
    } else if (isAuthenticated) {
      navigate('/');
    }
  }, [isLoading, isAuthenticated, error, login, navigate]);

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
        <button onClick={login}>Try Again</button>
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