import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './AuthCallback.css';

const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing authentication...');

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // For Azure Static Web Apps, we don't need to handle OAuth manually
        // The platform handles authentication automatically
        setStatus('success');
        setMessage('Authentication successful');
        
        // Redirect to dashboard after successful authentication
        setTimeout(() => {
          navigate('/dashboard');
        }, 2000);
        
      } catch (error: any) {
        console.error('Auth callback error:', error);
        setStatus('error');
        setMessage('Authentication processing failed');
      }
    };

    handleAuthCallback();
  }, [navigate]);

  return (
    <div className="auth-callback-page">
      <div className="auth-callback-container">
        <div className="auth-status">
          {status === 'processing' && (
            <>
              <div className="spinner"></div>
              <h2>Processing Authentication</h2>
              <p>{message}</p>
            </>
          )}
          
          {status === 'success' && (
            <>
              <div className="success-icon">✓</div>
              <h2>Authentication Successful</h2>
              <p>{message}</p>
              <p className="redirect-notice">Redirecting you to the dashboard...</p>
            </>
          )}
          
          {status === 'error' && (
            <>
              <div className="error-icon">⚠</div>
              <h2>Authentication Failed</h2>
              <p>{message}</p>
              <button 
                onClick={() => navigate('/login')}
                className="retry-button"
              >
                Try Again
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthCallback;