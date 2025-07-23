import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import './AdminConsentSuccess.css';

interface ConsentSuccessData {
  customerId: string;
  status: string;
  consentType: string;
  error?: string;
}

/**
 * Admin Consent Success Page
 * 
 * This component is specifically designed to work in popup windows opened by the
 * ConsentUrlGenerator component. It:
 * 
 * 1. Displays success/error messages to the user
 * 2. Communicates the result back to the parent window via postMessage
 * 3. Automatically closes the popup after a short delay
 * 4. Handles both success and error scenarios from the consent callback
 */
const AdminConsentSuccess: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [countdown, setCountdown] = useState(5);
  const [data, setData] = useState<ConsentSuccessData | null>(null);

  useEffect(() => {
    // Parse URL parameters
    const customerId = searchParams.get('customer_id') || '';
    const status = searchParams.get('status') || '';
    const consentType = searchParams.get('consent_type') || '';
    const error = searchParams.get('error') || '';

    const consentData: ConsentSuccessData = {
      customerId,
      status,
      consentType,
      error
    };

    setData(consentData);

    // Send result to parent window
    if (window.opener && !window.opener.closed) {
      const message = {
        type: 'ADMIN_CONSENT_RESULT',
        data: consentData,
        success: status === 'success' && !error,
        timestamp: new Date().toISOString()
      };

      console.log('🔗 AdminConsentSuccess: Sending message to parent window:', message);
      window.opener.postMessage(message, window.location.origin);
    }

    // Countdown timer to auto-close
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          // Close the popup window
          if (window.opener && !window.opener.closed) {
            window.close();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [searchParams]);

  const closeNow = () => {
    if (window.opener && !window.opener.closed) {
      window.close();
    }
  };

  if (!data) {
    return (
      <div className="admin-consent-success">
        <div className="loading">
          <div className="spinner"></div>
          <p>Processing consent result...</p>
        </div>
      </div>
    );
  }

  const isSuccess = data.status === 'success' && !data.error;

  return (
    <div className="admin-consent-success">
      <div className={`result-container ${isSuccess ? 'success' : 'error'}`}>
        <div className="result-icon">
          {isSuccess ? (
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 12l2 2 4-4"></path>
              <circle cx="12" cy="12" r="10"></circle>
            </svg>
          ) : (
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
          )}
        </div>

        <h1>{isSuccess ? 'Admin Consent Granted!' : 'Consent Failed'}</h1>

        {isSuccess ? (
          <div className="success-content">
            <p>✅ Admin consent has been successfully granted for customer <strong>{data.customerId}</strong></p>
            <p>The app registration has been created and configured with the required permissions:</p>
            <ul>
              <li>Organization.Read.All</li>
              <li>Directory.Read.All</li>
              <li>AuditLog.Read.All</li>
              <li>SecurityEvents.Read.All</li>
            </ul>
            <p>You can now run security assessments for this customer.</p>
          </div>
        ) : (
          <div className="error-content">
            <p>❌ Admin consent failed for customer <strong>{data.customerId}</strong></p>
            {data.error && (
              <div className="error-details">
                <p><strong>Error:</strong> {data.error}</p>
              </div>
            )}
            <p>Please try the consent process again or contact support if the issue persists.</p>
          </div>
        )}

        <div className="actions">
          <p>This window will close automatically in <strong>{countdown}</strong> seconds.</p>
          <button type="button" className="close-button" onClick={closeNow}>
            Close Now
          </button>
        </div>

        <div className="debug-info">
          <details>
            <summary>Debug Information</summary>
            <pre>{JSON.stringify(data, null, 2)}</pre>
          </details>
        </div>
      </div>
    </div>
  );
};

export default AdminConsentSuccess;
