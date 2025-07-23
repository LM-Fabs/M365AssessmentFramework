import React, { useState, useEffect } from 'react';
import { Customer } from '../services/customerService';
import { GraphService } from '../services/graphService';
import { AdminConsentService, M365_ASSESSMENT_CONFIG } from '../services/adminConsentService';
import { useAuth } from '../hooks/useAuth';
import './ConsentUrlGenerator.css';

interface ConsentUrlGeneratorProps {
  customers: Customer[];
  onClose?: () => void;
}

interface ConsentUrlData {
  customer: Customer | null;
  clientId: string;
  tenantId: string;
  redirectUri: string;
  permissions: string[];
}

export const ConsentUrlGenerator: React.FC<ConsentUrlGeneratorProps> = ({ customers, onClose }) => {
  const { user } = useAuth();
  
  // Debug logging
  console.log('🎯 ConsentUrlGenerator initialized:', {
    customersCount: customers.length,
    customers: customers,
    user: user
  });

  const [formData, setFormData] = useState<ConsentUrlData>({
    customer: null,
    clientId: M365_ASSESSMENT_CONFIG.clientId, // Use YOUR app's client ID, not customer's
    tenantId: user?.tenantId || '', // Auto-populate from current user
    redirectUri: M365_ASSESSMENT_CONFIG.defaultRedirectUri,
    permissions: [...M365_ASSESSMENT_CONFIG.requiredPermissions]
  });

  const [generatedUrl, setGeneratedUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [isAutoDetecting, setIsAutoDetecting] = useState<boolean>(false);
  const [popupWindow, setPopupWindow] = useState<Window | null>(null);
  const [consentStatus, setConsentStatus] = useState<{
    status: 'idle' | 'pending' | 'success' | 'error';
    message?: string;
    customerId?: string;
  }>({ status: 'idle' });

  // Listen for messages from popup window
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      console.log('🎯 ConsentUrlGenerator received message:', event.data);
      
      if (event.data.type === 'ADMIN_CONSENT_RESULT') {
        const { data, success } = event.data;
        
        setConsentStatus({
          status: success ? 'success' : 'error',
          message: success ? 'Admin consent granted successfully!' : (data.error || 'Consent failed'),
          customerId: data.customerId
        });

        // Close popup after receiving result
        if (popupWindow && !popupWindow.closed) {
          popupWindow.close();
          setPopupWindow(null);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [popupWindow]);

  // Check if popup was closed manually
  useEffect(() => {
    if (!popupWindow) return;

    const checkClosed = setInterval(() => {
      if (popupWindow.closed) {
        setPopupWindow(null);
        if (consentStatus.status === 'pending') {
          setConsentStatus({
            status: 'error',
            message: 'Consent popup was closed before completion'
          });
        }
      }
    }, 1000);

    return () => clearInterval(checkClosed);
  }, [popupWindow, consentStatus.status]);

  // Auto-select customer if there's only one
  useEffect(() => {
    if (customers.length === 1 && !formData.customer) {
      setFormData(prev => ({ ...prev, customer: customers[0] }));
      generateConsentUrl();
    }
  }, [formData.customer]);

  // Generate consent URL whenever relevant fields change
  useEffect(() => {
    generateConsentUrl();
  }, [formData.tenantId, formData.redirectUri, formData.permissions, formData.customer, formData.clientId]);

  const generateConsentUrl = async () => {
    console.log('🎯 SIMPLIFIED: generateConsentUrl called with customer:', {
      customer: formData.customer,
      customerId: formData.customer?.id
    });

    if (!formData.customer?.id || !formData.tenantId) {
      console.log('❌ Missing customer or tenant ID, clearing URL');
      setGeneratedUrl('');
      return;
    }

    try {
      console.log('🔄 DIRECT CONSENT: Generating direct Microsoft admin consent URL');
      
      // Generate direct Microsoft admin consent URL using the correct v2.0 endpoint format
      const baseUrl = window.location.origin;
      const redirectUri = `${baseUrl}/admin-consent-success`;
      const permissions = formData.permissions.join(' ');
      
      // Use the proper admin consent endpoint format from Microsoft docs
      // https://login.microsoftonline.com/{tenant}/v2.0/adminconsent
      const consentUrl = `https://login.microsoftonline.com/${encodeURIComponent(formData.tenantId)}/v2.0/adminconsent` +
        `?client_id=${encodeURIComponent(formData.clientId)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&scope=${encodeURIComponent(permissions)}` +
        `&state=${encodeURIComponent(JSON.stringify({ 
          customer_id: formData.customer.id, 
          tenant: formData.tenantId,
          timestamp: Date.now()
        }))}`;
      
      console.log('✅ Generated DIRECT consent URL with tenant-specific endpoint:', consentUrl);
      setGeneratedUrl(consentUrl);
      
    } catch (error) {
      console.error('Error generating consent URL:', error);
      setGeneratedUrl('');
    }
  };

  const handleAutoDetectTenant = async () => {
    setIsAutoDetecting(true);
    
    try {
      // Try to get tenant ID from AdminConsentService first
      const adminConsentService = AdminConsentService.getInstance();
      const userTenantInfo = await adminConsentService.getCurrentUserTenantInfo();
      
      if (userTenantInfo?.tenantId) {
        setFormData(prev => ({ 
          ...prev, 
          tenantId: userTenantInfo.tenantId!
        }));
      } else if (user?.tenantId) {
        // Fallback to user's tenant ID from auth context
        setFormData(prev => ({ 
          ...prev, 
          tenantId: user.tenantId!
        }));
      } else {
        alert('Could not automatically detect your tenant ID. Please enter it manually.');
      }
    } catch (error) {
      console.error('Error auto-detecting tenant:', error);
      
      // Fallback to user's tenant ID from auth context
      if (user?.tenantId) {
        setFormData(prev => ({ 
          ...prev, 
          tenantId: user.tenantId!
        }));
      } else {
        alert('Failed to auto-detect tenant ID. Please enter it manually.');
      }
    } finally {
      setIsAutoDetecting(false);
    }
  };

  const handleCustomerSelect = (customerId: string) => {
    const selectedCustomer = customers.find(c => c.id === customerId) || null;
    setFormData(prev => ({ 
      ...prev, 
      customer: selectedCustomer,
      // Auto-populate tenant ID from selected customer
      tenantId: selectedCustomer ? selectedCustomer.tenantId : prev.tenantId
    }));
  };

  const handleInputChange = (field: keyof ConsentUrlData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handlePermissionToggle = (permission: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission]
    }));
  };

  const copyToClipboard = async () => {
    if (!generatedUrl) return;
    
    try {
      await navigator.clipboard.writeText(generatedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy URL:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = generatedUrl;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (fallbackError) {
        console.error('Fallback copy also failed:', fallbackError);
      }
      document.body.removeChild(textArea);
    }
  };

  const openInPopup = () => {
    if (!generatedUrl) return;

    setConsentStatus({ status: 'pending', message: 'Waiting for admin consent...' });

    const popup = window.open(
      generatedUrl,
      'admin-consent',
      'width=600,height=700,scrollbars=yes,resizable=yes,status=yes,location=yes,menubar=no,toolbar=no'
    );

    if (popup) {
      setPopupWindow(popup);
      popup.focus();
    } else {
      setConsentStatus({
        status: 'error',
        message: 'Failed to open popup. Please check if popups are blocked.'
      });
    }
  };

  const resetConsentStatus = () => {
    setConsentStatus({ status: 'idle' });
  };

  return (
    <div className="consent-url-generator">
      <div className="consent-modal">
        <div className="consent-header">
          <div>
            <h2>Admin Consent URL Generator</h2>
            <p className="subtitle">Generate Microsoft admin consent URLs for your M365 Assessment Framework</p>
          </div>
          <button onClick={onClose} className="close-button" aria-label="Close">
            ×
          </button>
        </div>

        <div className="consent-form">
        {/* Customer Selection */}
        <div className="form-group">
          <label htmlFor="customer-select">Select Customer:</label>
          <select
            id="customer-select"
            value={formData.customer?.id || ''}
            onChange={(e) => handleCustomerSelect(e.target.value)}
            className="form-select"
          >
            <option value="">-- Select a Customer --</option>
            {customers.map(customer => (
              <option key={customer.id} value={customer.id}>
                {customer.tenantName}
              </option>
            ))}
          </select>
        </div>

        {/* Tenant ID */}
        <div className="form-group">
          <label htmlFor="tenant-id">Target Tenant ID:</label>
          <div className="input-with-button">
            <input
              id="tenant-id"
              type="text"
              value={formData.tenantId}
              onChange={(e) => handleInputChange('tenantId', e.target.value)}
              placeholder="Enter tenant ID (GUID)"
              className="form-input"
            />
            <button
              onClick={handleAutoDetectTenant}
              disabled={isAutoDetecting}
              className="auto-detect-button"
              title="Auto-detect your tenant ID"
            >
              {isAutoDetecting ? '...' : 'Auto'}
            </button>
          </div>
        </div>

        {/* Client ID (Read-only) */}
        <div className="form-group">
          <label htmlFor="client-id">Client ID (Your App):</label>
          <input
            id="client-id"
            type="text"
            value={formData.clientId}
            readOnly
            className="form-input readonly"
            title="This is your main app's Client ID"
          />
        </div>

        {/* Permissions */}
        <div className="form-group">
          <label>Required Permissions:</label>
          <div className="permissions-list">
            {M365_ASSESSMENT_CONFIG.requiredPermissions.map(permission => (
              <label key={permission} className="permission-item">
                <input
                  type="checkbox"
                  checked={formData.permissions.includes(permission)}
                  onChange={() => handlePermissionToggle(permission)}
                />
                <span className="permission-name">{permission}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Generated URL */}
        {generatedUrl && (
          <div className="form-group">
            <label htmlFor="generated-url">Generated Consent URL:</label>
            <div className="url-display">
              <textarea
                id="generated-url"
                value={generatedUrl}
                readOnly
                rows={3}
                className="url-textarea"
              />
              <div className="url-buttons">
                <button onClick={copyToClipboard} className="copy-button">
                  {copied ? 'Copied!' : 'Copy URL'}
                </button>
                <button onClick={openInPopup} className="open-popup-button">
                  Open in Popup
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Consent Status */}
        {consentStatus.status !== 'idle' && (
          <div className={`consent-status ${consentStatus.status}`}>
            <div className="status-content">
              <span className="status-message">{consentStatus.message}</span>
              {consentStatus.status !== 'pending' && (
                <button onClick={resetConsentStatus} className="reset-button">
                  ✕
                </button>
              )}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="instructions">
          <h3>⚠️ IMPORTANT: Azure App Registration Setup Required</h3>
          <div className="alert-box">
            <strong>Before using this consent URL, you MUST add the redirect URI to your Azure app registration:</strong>
            <ol>
              <li>Go to <a href="https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade" target="_blank" rel="noopener noreferrer">Azure Portal → App Registrations</a></li>
              <li>Find your app: <code>{formData.clientId}</code></li>
              <li>Go to <strong>Authentication</strong> → <strong>Platform configurations</strong></li>
              <li>Add redirect URI: <code>{window.location.origin}/admin-consent-success</code></li>
              <li>Set platform type to <strong>Web</strong></li>
              <li>Click <strong>Save</strong></li>
            </ol>
          </div>
          
          <h3>Usage Instructions:</h3>
          <ol>
            <li>Complete the Azure app registration setup above</li>
            <li>Select the customer you want to generate consent for</li>
            <li>Enter or auto-detect the target tenant ID</li>
            <li>Review the required permissions</li>
            <li>Either copy the URL or open it directly in a popup</li>
            <li>Complete the admin consent process in Microsoft</li>
          </ol>
        </div>
      </div>
    </div>
    </div>
  );
};

export default ConsentUrlGenerator;
