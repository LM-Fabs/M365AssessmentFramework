import React, { useState, useEffect } from 'react';
import { Customer } from '../services/customerService';
import { AdminConsentService, M365_ASSESSMENT_CONFIG } from '../services/adminConsentService';
import './ConsentUrlGeneratorEmbedded.css';

interface ConsentUrlGeneratorEmbeddedProps {
  customers: Customer[];
}

export const ConsentUrlGeneratorEmbedded: React.FC<ConsentUrlGeneratorEmbeddedProps> = ({
  customers
}) => {
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [tenantId, setTenantId] = useState('');
  const [permissions, setPermissions] = useState<string[]>([
    'Organization.Read.All',
    'SecurityEvents.Read.All'
  ]);
  const [copied, setCopied] = useState(false);

  // Auto-populate tenant ID when customer is selected
  useEffect(() => {
    if (selectedCustomer?.tenantId) {
      setTenantId(selectedCustomer.tenantId);
    }
  }, [selectedCustomer]);

  const generateConsentUrl = () => {
    if (!selectedCustomer || !tenantId) return '';

    const clientId = M365_ASSESSMENT_CONFIG.clientId;
    const redirectUri = `${window.location.origin}/admin-consent-success`;
    const scopes = permissions.join(' ');

    return `https://login.microsoftonline.com/${tenantId}/v2.0/adminconsent?client_id=${clientId}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  };

  const copyToClipboard = async () => {
    const url = generateConsentUrl();
    if (url) {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const openInPopup = () => {
    const url = generateConsentUrl();
    if (url) {
      window.open(url, 'admin-consent', 'width=600,height=800,scrollbars=yes,resizable=yes');
    }
  };

  const handleAutoDetectTenant = async () => {
    if (!selectedCustomer?.tenantDomain) return;
    
    try {
      // Simple tenant detection - for now just use the customer's existing tenantId
      if (selectedCustomer.tenantId) {
        setTenantId(selectedCustomer.tenantId);
      }
    } catch (error) {
      console.error('Failed to auto-detect tenant ID:', error);
    }
  };

  const consentUrl = generateConsentUrl();

  return (
    <div className="consent-url-generator-embedded">
      <div className="generator-form">
        {/* Customer Selection */}
        <div className="form-group">
          <label htmlFor="customer-select">Select Customer</label>
          <select
            id="customer-select"
            value={selectedCustomer?.id || ''}
            onChange={(e) => {
              const customer = customers.find(c => c.id === e.target.value);
              setSelectedCustomer(customer || null);
            }}
            className="form-select"
          >
            <option value="">Choose a customer...</option>
            {customers.map(customer => (
              <option key={customer.id} value={customer.id}>
                {customer.tenantName} ({customer.tenantDomain})
              </option>
            ))}
          </select>
        </div>

        {/* Tenant ID */}
        <div className="form-group">
          <label htmlFor="tenant-id">Target Tenant ID</label>
          <div className="input-with-button">
            <input
              id="tenant-id"
              type="text"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="form-input"
            />
            <button
              type="button"
              onClick={handleAutoDetectTenant}
              disabled={!selectedCustomer?.tenantDomain}
              className="auto-detect-button"
            >
              Auto-detect
            </button>
          </div>
        </div>

        {/* App Client ID */}
        <div className="form-group">
          <label htmlFor="client-id">Application Client ID</label>
          <input
            id="client-id"
            type="text"
            value={M365_ASSESSMENT_CONFIG.clientId}
            readOnly
            className="form-input readonly"
          />
        </div>

        {/* Permissions */}
        <div className="form-group">
          <label>Required Permissions</label>
          <div className="permissions-list">
            {permissions.map(permission => (
              <label key={permission} className="permission-item">
                <input
                  type="checkbox"
                  checked={true}
                  readOnly
                />
                <span className="permission-name">{permission}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Generated URL */}
        {consentUrl && (
          <div className="form-group">
            <label htmlFor="consent-url">Generated Admin Consent URL</label>
            <div className="url-display">
              <textarea
                id="consent-url"
                value={consentUrl}
                readOnly
                className="url-textarea"
                rows={4}
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

        {/* Instructions */}
        <div className="instructions">
          <h3>Usage Instructions:</h3>
          <ol>
            <li>Select the customer you want to generate consent for</li>
            <li>Enter or auto-detect the target tenant ID</li>
            <li>Review the required permissions</li>
            <li>Either copy the URL or open it directly in a popup</li>
            <li>Complete the admin consent process in Microsoft</li>
          </ol>
        </div>
      </div>
    </div>
  );
};
