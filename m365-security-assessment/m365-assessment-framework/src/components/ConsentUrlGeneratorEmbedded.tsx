import React, { useState, useEffect } from 'react';
import { Customer } from '../services/customerService';
import { AdminConsentService, M365_ASSESSMENT_CONFIG } from '../services/adminConsentService';
import { useAuth } from '../hooks/useAuth';
import './ConsentUrlGeneratorEmbedded.css';

interface ConsentUrlGeneratorEmbeddedProps {
  customers: Customer[];
}

interface ConsentUrlData {
  customer: Customer | null;
  tenantId: string;
  redirectUri: string;
  permissions: string[];
}

export const ConsentUrlGeneratorEmbedded: React.FC<ConsentUrlGeneratorEmbeddedProps> = ({ customers }) => {
  const { user } = useAuth();
  
  const [formData, setFormData] = useState<ConsentUrlData>({
    customer: null,
    tenantId: user?.tenantId || '',
    redirectUri: M365_ASSESSMENT_CONFIG.defaultRedirectUri,
    permissions: [...M365_ASSESSMENT_CONFIG.requiredPermissions]
  });

  const [generatedUrl, setGeneratedUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [isAutoDetecting, setIsAutoDetecting] = useState<boolean>(false);

  // Generate consent URL whenever relevant fields change
  useEffect(() => {
    generateConsentUrl();
  }, [formData.tenantId, formData.redirectUri, formData.permissions, formData.customer]);

  const generateConsentUrl = async () => {
    if (!formData.customer?.id || !formData.tenantId) {
      setGeneratedUrl('');
      return;
    }

    try {
      // CORRECT MULTI-TENANT APPROACH: Always use YOUR app's client ID
      // The customer admin consents to YOUR multi-tenant app in THEIR tenant
      const clientId = M365_ASSESSMENT_CONFIG.clientId;
      
      // Microsoft Documentation: Use customer's tenant ID in the consent URL
      // This allows the admin to consent in THEIR tenant to YOUR app
      const customerTenantId = formData.tenantId;
      
      // Use your app's configured redirect URI
      const redirectUri = M365_ASSESSMENT_CONFIG.defaultRedirectUri;
      
      // Format: https://login.microsoftonline.com/{customer-tenant-id}/adminconsent
      // NOT /v2.0/adminconsent - that's for regular OAuth, not admin consent
      const consentUrl = `https://login.microsoftonline.com/${encodeURIComponent(customerTenantId)}/adminconsent` +
        `?client_id=${encodeURIComponent(clientId)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&state=${encodeURIComponent(JSON.stringify({ 
          customer_id: formData.customer.id, 
          tenant: customerTenantId,
          timestamp: Date.now(),
          workflow: 'multi-tenant-consent'
        }))}`;
      
      console.log('🔗 Generated multi-tenant admin consent URL:', {
        customerTenantId,
        clientId: clientId.substring(0, 8) + '...',
        redirectUri,
        consentUrl: consentUrl.substring(0, 100) + '...'
      });
      
      setGeneratedUrl(consentUrl);
      
    } catch (error) {
      console.error('Error generating consent URL:', error);
      setGeneratedUrl('');
    }
  };

  const handleCustomerSelect = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId) || null;
    console.log('🔍 Customer selected:', customer);
    console.log('🔍 Customer tenantId:', customer?.tenantId);
    
    setFormData(prev => ({
      ...prev,
      customer,
      tenantId: customer?.tenantId || ''
    }));
  };

  const handleAutoDetectTenant = async () => {
    setIsAutoDetecting(true);
    
    // For now, this feature is not implemented
    // TODO: Implement domain to tenant ID resolution
    console.log('Auto-detect feature not yet implemented');
    
    setIsAutoDetecting(false);
  };

  const copyToClipboard = async () => {
    if (!generatedUrl) return;
    
    try {
      await navigator.clipboard.writeText(generatedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const openConsentUrl = () => {
    if (generatedUrl) {
      window.open(generatedUrl, '_blank');
    }
  };

  return (
    <div className="consent-url-generator-embedded">
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
                {customer.tenantName} ({customer.tenantDomain})
              </option>
            ))}
          </select>
        </div>

        {formData.customer && (
          <>
            {/* Tenant ID */}
            <div className="form-group">
              <label htmlFor="tenant-id">Target Tenant ID:</label>
              <div className="input-with-button">
                <input
                  id="tenant-id"
                  type="text"
                  value={formData.tenantId}
                  onChange={(e) => setFormData(prev => ({ ...prev, tenantId: e.target.value }))}
                  placeholder="Enter tenant ID or use auto-detect"
                  className="form-input"
                />
                <button
                  type="button"
                  onClick={handleAutoDetectTenant}
                  disabled={isAutoDetecting || !formData.customer?.tenantDomain}
                  className="detect-button"
                >
                  {isAutoDetecting ? 'Detecting...' : 'Auto-detect'}
                </button>
              </div>
            </div>

            {/* Multi-Tenant App Information */}
            <div className="form-group">
              <label>Multi-Tenant App Registration:</label>
              <div className="multi-tenant-info">
                <div className="info-box">
                  <h4>📋 How Multi-Tenant Consent Works:</h4>
                  <ol>
                    <li>You have <strong>ONE</strong> multi-tenant app registered in your Azure tenant</li>
                    <li>Customer tenant admin clicks the consent URL below</li>
                    <li>Customer admin consents to <strong>your existing app</strong> in their tenant</li>
                    <li>Your app appears as an "Enterprise Application" in their tenant</li>
                    <li>You can then access their tenant using the same client ID</li>
                  </ol>
                  <p className="note">
                    <strong>Note:</strong> No new app registration is created in the customer tenant. 
                    They consent to your existing multi-tenant app.
                  </p>
                </div>
              </div>
            </div>

            {/* Multi-Tenant App Client ID */}
            <div className="form-group">
              <label htmlFor="client-id">Your Multi-Tenant App Client ID:</label>
              <input
                id="client-id"
                type="text"
                value={M365_ASSESSMENT_CONFIG.clientId}
                readOnly
                className="form-input readonly"
              />
              <p className="field-note">
                This is your master app registration that customers will consent to.
                The same client ID is used for all customers.
              </p>
            </div>

            {/* Permissions */}
            <div className="form-group">
              <label>Required Permissions:</label>
              <div className="permissions-list">
                {formData.permissions.map((permission, index) => (
                  <span key={index} className="permission-tag">
                    {permission}
                  </span>
                ))}
              </div>
            </div>

            {/* Generated URL */}
            {generatedUrl && (
              <div className="form-group">
                <label htmlFor="generated-url">Admin Consent URL:</label>
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
                    <button onClick={openConsentUrl} className="open-button">
                      Open Consent Page
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ConsentUrlGeneratorEmbedded;