import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

interface AuthCallbackProps {}

const AuthCallback: React.FC<AuthCallbackProps> = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing authentication...');

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Parse URL parameters and fragments
        const urlParams = new URLSearchParams(location.search);
        const fragment = new URLSearchParams(location.hash.substring(1));
        
        // Get parameters from either query string or fragment
        const code = urlParams.get('code') || fragment.get('code');
        const state = urlParams.get('state') || fragment.get('state');
        const error = urlParams.get('error') || fragment.get('error');
        const errorDescription = urlParams.get('error_description') || fragment.get('error_description');

        // Handle OAuth2 errors
        if (error) {
          const errorMsg = errorDescription || error;
          setStatus('error');
          setMessage(`Authentication failed: ${errorMsg}`);
          
          // Send error message to parent window if in popup
          if (window.opener) {
            window.opener.postMessage({
              type: state === 'tenant-selection' ? 'TENANT_SELECTION_ERROR' : 'TENANT_AUTH_ERROR',
              error: errorMsg
            }, window.location.origin);
            window.close();
          }
          return;
        }

        // Handle successful authentication
        if (code && state) {
          if (state === 'tenant-selection') {
            // This is the initial tenant selection flow
            await handleTenantSelection(code);
          } else if (state === 'multi-tenant-assessment') {
            // This is the final assessment authentication
            await handleAssessmentAuth(code);
          } else {
            throw new Error('Invalid authentication state');
          }
        } else {
          throw new Error('Missing required authentication parameters');
        }

      } catch (error: any) {
        console.error('Auth callback error:', error);
        setStatus('error');
        setMessage(error.message || 'Authentication processing failed');
        
        // Send error to parent window if in popup
        if (window.opener) {
          window.opener.postMessage({
            type: 'TENANT_AUTH_ERROR',
            error: error.message || 'Authentication processing failed'
          }, window.location.origin);
          window.close();
        }
      }
    };

    handleAuthCallback();
  }, [location]);

  const handleTenantSelection = async (code: string) => {
    try {
      setMessage('Extracting tenant information...');
      
      // Exchange code for token to get tenant information
      const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: '04b07795-8ddb-461a-bbee-02f9e1bf7b46', // Microsoft Graph Explorer client ID
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: window.location.origin + '/auth/callback',
          scope: 'openid profile'
        })
      });

      if (!tokenResponse.ok) {
        throw new Error('Failed to exchange authorization code for token');
      }

      const tokenData = await tokenResponse.json();
      
      // Decode the ID token to extract tenant information
      const idToken = tokenData.id_token;
      if (!idToken) {
        throw new Error('No ID token received');
      }

      // Parse JWT payload (simple base64 decode - not verification since this is just for tenant info)
      const tokenParts = idToken.split('.');
      const payload = JSON.parse(atob(tokenParts[1]));
      
      // Extract tenant information
      const tenantId = payload.tid;
      const tenantDomain = payload.iss?.includes('https://sts.windows.net/') 
        ? `${tenantId}.onmicrosoft.com` 
        : extractDomainFromIssuer(payload.iss);
      
      const userInfo = {
        displayName: payload.name,
        email: payload.preferred_username || payload.email,
        upn: payload.upn
      };

      setStatus('success');
      setMessage('Tenant selected successfully');

      // Send tenant information to parent window
      if (window.opener) {
        window.opener.postMessage({
          type: 'TENANT_SELECTED',
          tenantId: tenantId,
          tenantDomain: tenantDomain,
          userInfo: userInfo
        }, window.location.origin);
        
        setTimeout(() => {
          window.close();
        }, 1000);
      } else {
        // If not in popup, redirect to settings with tenant info
        navigate('/settings', { 
          state: { 
            tenantSelected: true,
            tenantId,
            tenantDomain,
            userInfo 
          } 
        });
      }

    } catch (error: any) {
      console.error('Tenant selection error:', error);
      throw error;
    }
  };

  const handleAssessmentAuth = async (code: string) => {
    try {
      setMessage('Completing assessment authentication...');
      
      setStatus('success');
      setMessage('Authentication completed successfully');

      // Send success message to parent window or redirect
      if (window.opener) {
        window.opener.postMessage({
          type: 'TENANT_AUTH_SUCCESS',
          authCode: code
        }, window.location.origin);
        
        setTimeout(() => {
          window.close();
        }, 1000);
      } else {
        // Redirect to assessment configuration
        navigate('/settings', { 
          state: { 
            authCompleted: true,
            authCode: code 
          } 
        });
      }

    } catch (error: any) {
      console.error('Assessment auth error:', error);
      throw error;
    }
  };

  const extractDomainFromIssuer = (issuer: string): string => {
    try {
      // Extract domain from issuer URL patterns
      if (issuer.includes('https://login.microsoftonline.com/')) {
        const tenantPart = issuer.split('/')[3];
        return `${tenantPart}.onmicrosoft.com`;
      }
      return issuer;
    } catch {
      return 'unknown.onmicrosoft.com';
    }
  };

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
              {!window.opener && (
                <p className="redirect-notice">Redirecting you back to the application...</p>
              )}
            </>
          )}
          
          {status === 'error' && (
            <>
              <div className="error-icon">⚠</div>
              <h2>Authentication Failed</h2>
              <p>{message}</p>
              {!window.opener && (
                <button 
                  onClick={() => navigate('/settings')}
                  className="retry-button"
                >
                  Return to Settings
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <style jsx>{`
        .auth-callback-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
        }

        .auth-callback-container {
          background: white;
          border-radius: 12px;
          padding: 3rem;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
          text-align: center;
          max-width: 400px;
          width: 90%;
        }

        .auth-status h2 {
          margin: 1rem 0;
          color: #1e293b;
          font-size: 1.5rem;
        }

        .auth-status p {
          color: #64748b;
          margin-bottom: 1rem;
          line-height: 1.5;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #e2e8f0;
          border-top: 4px solid #3b82f6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 1rem auto;
        }

        .success-icon {
          width: 60px;
          height: 60px;
          background: #10b981;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2rem;
          font-weight: bold;
          margin: 0 auto 1rem auto;
        }

        .error-icon {
          width: 60px;
          height: 60px;
          background: #ef4444;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2rem;
          font-weight: bold;
          margin: 0 auto 1rem auto;
        }

        .retry-button {
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 6px;
          padding: 0.75rem 1.5rem;
          font-size: 1rem;
          cursor: pointer;
          transition: background 0.2s;
          margin-top: 1rem;
        }

        .retry-button:hover {
          background: #2563eb;
        }

        .redirect-notice {
          font-style: italic;
          color: #6b7280;
          font-size: 0.875rem;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default AuthCallback;