import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import './Login.css';

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
        <button onClick={login} className="lm-button">Try Again</button>
      </div>
    );
  }

  // Show a manual login button if coming from a logout
  if (noAutoLogin) {
    return (
      <div className="lm-login-container">
        <div className="lm-login-card">
          <div className="lm-logo-container">
            {/* Use text branding instead of logo image until logo is available */}
            <div className="lm-logo-text">LM</div>
            <h1 className="lm-title">M365 Security Assessment</h1>
          </div>
          <p className="lm-subtitle">You have been successfully logged out.</p>
          <div className="lm-button-container">
            <button
              onClick={() => {
                setManualLogin(true);
                login();
              }}
              className="lm-button"
            >
              Sign in with Microsoft
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="lm-login-container">
      <div className="lm-login-card">
        <div className="lm-logo-container">
          {/* Use text branding instead of logo image until logo is available */}
          <div className="lm-logo-text">LM</div>
          <h1 className="lm-title">M365 Security Assessment</h1>
        </div>
        <p className="lm-subtitle">Redirecting to login...</p>
        <div className="lm-loading-spinner"></div>
      </div>
    </div>
  );
};

export default Login;