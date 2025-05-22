import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoading, error, isAuthenticated, login } = useAuth();
  const [manualLogin, setManualLogin] = useState(false);

  // Check if this is a post-logout redirect that should not auto-login
  const noAutoLogin = new URLSearchParams(location.search).get('noauto') === 'true';

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !error && !noAutoLogin && !manualLogin) {
      login();
    } else if (isAuthenticated) {
      navigate('/');
    }
  }, [isLoading, isAuthenticated, error, login, navigate, noAutoLogin, manualLogin]);

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

  // Show a manual login button if coming from a logout
  if (noAutoLogin) {
    return (
      <div className="login-container">
        <h1>M365 Security Assessment</h1>
        <p>You have been successfully logged out.</p>
        <button
          onClick={() => {
            setManualLogin(true);
            login();
          }}
          className="login-button"
        >
          Sign in
        </button>
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