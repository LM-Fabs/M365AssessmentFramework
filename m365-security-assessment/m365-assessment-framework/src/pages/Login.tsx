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

  const handleLogin = () => {
    setManualLogin(true);
    login();
  };

  if (isLoading) {
    return (
      <div className="lm-login-container">
        <div className="lm-login-card">
          <div className="lm-logo-container">
            <img src="/images/lm-logo.svg" alt="LM Logo" className="lm-logo" />
            <h1 className="lm-title">M365 Security Assessment</h1>
          </div>
          <p className="lm-subtitle">Initializing authentication...</p>
          <div className="lm-loading-spinner"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="lm-login-container">
        <div className="lm-login-card">
          <div className="lm-logo-container">
            <img src="/images/lm-logo.svg" alt="LM Logo" className="lm-logo" />
            <h1 className="lm-title">M365 Security Assessment</h1>
          </div>
          <div className="error-message">{error}</div>
          <div className="lm-button-container">
            <button onClick={handleLogin} className="lm-button">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M13.8 12H3"></path>
              </svg>
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show a manual login button if coming from a logout
  if (noAutoLogin) {
    return (
      <div className="lm-login-container">
        <div className="lm-brand-background"></div>
        <div className="lm-login-card">
          <div className="lm-logo-container">
            <img src="/images/lm-logo.svg" alt="LM Logo" className="lm-logo" />
            <h1 className="lm-title">M365 Security Assessment</h1>
          </div>
          <p className="lm-subtitle">You have been successfully logged out.</p>
          <div className="lm-button-container">
            <button
              onClick={handleLogin}
              className="lm-button"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 48 48">
                <rect width="9" height="9" x="6" y="6" fill="#f25022" />
                <rect width="9" height="9" x="6" y="19" fill="#00a4ef" />
                <rect width="9" height="9" x="19" y="6" fill="#7fba00" />
                <rect width="9" height="9" x="19" y="19" fill="#ffb900" />
              </svg>
              Sign in with Microsoft
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="lm-login-container">
      <div className="lm-brand-background"></div>
      <div className="lm-login-card">
        <div className="lm-logo-container">
          <img src="/images/lm-logo.svg" alt="LM Logo" className="lm-logo" />
          <h1 className="lm-title">M365 Security Assessment</h1>
        </div>
        <p className="lm-subtitle">Secure assessment for your Microsoft 365 environment</p>
        <div className="lm-button-container">
          <button
            onClick={handleLogin}
            className="lm-button"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 48 48">
              <rect width="9" height="9" x="6" y="6" fill="#f25022" />
              <rect width="9" height="9" x="6" y="19" fill="#00a4ef" />
              <rect width="9" height="9" x="19" y="6" fill="#7fba00" />
              <rect width="9" height="9" x="19" y="19" fill="#ffb900" />
            </svg>
            Sign in with Microsoft
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;