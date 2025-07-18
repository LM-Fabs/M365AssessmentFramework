import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import './ConsentResult.css';

interface ConsentResultData {
  status: 'success' | 'error' | 'partial';
  message: string;
  customerName?: string;
  appId?: string;
}

const ConsentResult: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [resultData, setResultData] = useState<ConsentResultData | null>(null);

  useEffect(() => {
    // Parse URL parameters
    const status = searchParams.get('status') as 'success' | 'error' | 'partial' || 'error';
    const message = searchParams.get('message') || 'Unknown status';
    const customerName = searchParams.get('customer') || undefined;
    const appId = searchParams.get('appId') || undefined;

    setResultData({
      status,
      message: decodeURIComponent(message),
      customerName: customerName ? decodeURIComponent(customerName) : undefined,
      appId
    });
  }, [searchParams]);

  const handleBackToSettings = () => {
    navigate('/settings');
  };

  const handleBackToReports = () => {
    navigate('/reports');
  };

  if (!resultData) {
    return (
      <div className="consent-result loading">
        <div className="loading-spinner"></div>
        <p>Processing consent result...</p>
      </div>
    );
  }

  const getStatusIcon = () => {
    switch (resultData.status) {
      case 'success':
        return '✅';
      case 'partial':
        return '⚠️';
      case 'error':
      default:
        return '❌';
    }
  };

  const getStatusTitle = () => {
    switch (resultData.status) {
      case 'success':
        return 'Consent Granted Successfully';
      case 'partial':
        return 'Consent Granted with Issues';
      case 'error':
      default:
        return 'Consent Failed';
    }
  };

  const getStatusDescription = () => {
    switch (resultData.status) {
      case 'success':
        return 'The enterprise app registration has been successfully created in the customer tenant. You can now run security assessments.';
      case 'partial':
        return 'Admin consent was granted, but there was an issue creating the enterprise app registration. You may need to create it manually.';
      case 'error':
      default:
        return 'The consent process failed or was cancelled. Please try again or contact support if the issue persists.';
    }
  };

  return (
    <div className="consent-result">
      <div className={`result-container ${resultData.status}`}>
        <div className="result-header">
          <div className="status-icon">{getStatusIcon()}</div>
          <h1>{getStatusTitle()}</h1>
        </div>

        <div className="result-content">
          <p className="status-description">{getStatusDescription()}</p>
          
          {resultData.message && (
            <div className="result-message">
              <strong>Details:</strong> {resultData.message}
            </div>
          )}

          {resultData.customerName && (
            <div className="customer-info">
              <strong>Customer:</strong> {resultData.customerName}
            </div>
          )}

          {resultData.appId && (
            <div className="app-info">
              <strong>Enterprise App ID:</strong> 
              <code>{resultData.appId}</code>
            </div>
          )}
        </div>

        <div className="result-actions">
          {resultData.status === 'success' && (
            <>
              <button 
                className="primary-button"
                onClick={handleBackToReports}
              >
                View Customer Reports
              </button>
              <button 
                className="secondary-button"
                onClick={handleBackToSettings}
              >
                Back to Settings
              </button>
            </>
          )}

          {resultData.status === 'partial' && (
            <>
              <button 
                className="primary-button"
                onClick={handleBackToSettings}
              >
                Manage App Registrations
              </button>
              <button 
                className="secondary-button"
                onClick={handleBackToReports}
              >
                View Reports
              </button>
            </>
          )}

          {resultData.status === 'error' && (
            <>
              <button 
                className="primary-button"
                onClick={handleBackToSettings}
              >
                Try Again
              </button>
              <button 
                className="secondary-button"
                onClick={() => window.close()}
              >
                Close Window
              </button>
            </>
          )}
        </div>

        <div className="help-section">
          <h3>What happens next?</h3>
          <ul>
            {resultData.status === 'success' && (
              <>
                <li>The enterprise app is now installed in the customer tenant</li>
                <li>You can run security assessments immediately</li>
                <li>The customer admin may need to assign users to the app if required</li>
              </>
            )}
            {resultData.status === 'partial' && (
              <>
                <li>Admin consent was granted successfully</li>
                <li>Contact support to resolve the enterprise app creation issue</li>
                <li>You may be able to create the enterprise app manually in the Azure portal</li>
              </>
            )}
            {resultData.status === 'error' && (
              <>
                <li>Check with the customer admin to ensure they have Global Administrator privileges</li>
                <li>Verify the application ID and tenant ID are correct</li>
                <li>Ensure the application is configured as multi-tenant</li>
              </>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ConsentResult;
