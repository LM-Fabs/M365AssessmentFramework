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
  clientId: string;
  tenantId: string;
  redirectUri: string;
  permissions: string[];
}

interface AppRegistrationStatus {
  status: 'idle' | 'creating' | 'success' | 'error';
  message?: string;
  appData?: {
    applicationId: string;
    clientId: string;
    servicePrincipalId: string;
    clientSecret: string;
    consentUrl: string;
    redirectUri: string;
    permissions: string[];
    resolvedTenantId: string;
  };
}

export const ConsentUrlGeneratorEmbedded: React.FC<ConsentUrlGeneratorEmbeddedProps> = ({ customers }) => {
  const { user } = useAuth();
  
  const [formData, setFormData] = useState<ConsentUrlData>({
    customer: null,
    clientId: M365_ASSESSMENT_CONFIG.clientId,
    tenantId: user?.tenantId || '',
    redirectUri: M365_ASSESSMENT_CONFIG.defaultRedirectUri,
    permissions: [...M365_ASSESSMENT_CONFIG.requiredPermissions]
  });

  const [generatedUrl, setGeneratedUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [isAutoDetecting, setIsAutoDetecting] = useState<boolean>(false);
  const [appRegistrationStatus, setAppRegistrationStatus] = useState<AppRegistrationStatus>({ status: 'idle' });

  // Generate consent URL whenever relevant fields change
  useEffect(() => {
    generateConsentUrl();
  }, [formData.tenantId, formData.redirectUri, formData.permissions, formData.customer, formData.clientId]);

  const generateConsentUrl = async () => {
    if (!formData.customer?.id || !formData.tenantId) {
      setGeneratedUrl('');
      return;
    }

    try {
      // Use app registration data if available, otherwise use default client ID
      const clientId = appRegistrationStatus.appData?.clientId || formData.clientId;
      
      const baseUrl = window.location.origin;
      const redirectUri = `${baseUrl}/auth/callback`;
      const permissions = formData.permissions.join(' ');
      
      const consentUrl = `https://login.microsoftonline.com/${encodeURIComponent(formData.tenantId)}/v2.0/adminconsent` +
        `?client_id=${encodeURIComponent(clientId)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&scope=${encodeURIComponent(permissions)}` +
        `&state=${encodeURIComponent(JSON.stringify({ 
          customer_id: formData.customer.id, 
          tenant: formData.tenantId,
          timestamp: Date.now()
        }))}`;
      
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
    
    // Reset app registration status when changing customers
    setAppRegistrationStatus({ status: 'idle' });
  };

  const handleAutoDetectTenant = async () => {
    setIsAutoDetecting(true);
    
    // For now, this feature is not implemented
    // TODO: Implement domain to tenant ID resolution
    console.log('Auto-detect feature not yet implemented');
    
    setIsAutoDetecting(false);
  };

  const createAppRegistration = async () => {
    if (!formData.customer) {
      return;
    }

    setAppRegistrationStatus({ status: 'creating', message: 'Creating app registration in customer tenant...' });

    console.log('🚀 About to create app registration with:', {
      targetTenantId: formData.tenantId,
      targetTenantDomain: formData.customer?.tenantDomain,
      tenantName: formData.customer?.tenantName,
      formData: formData
    });

    try {
      const response = await fetch('/api/enterprise-app/multi-tenant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetTenantId: formData.tenantId,
          targetTenantDomain: formData.customer.tenantDomain,
          tenantName: formData.customer.tenantName,
          contactEmail: formData.customer.contactEmail,
          assessmentName: `M365 Security Assessment - ${formData.customer.tenantName}`,
          requiredPermissions: formData.permissions
        })
      });

      const result = await response.json();

      if (result.success) {
        setAppRegistrationStatus({
          status: 'success',
          message: 'App registration created successfully!',
          appData: result.data
        });
        
        // Update form data with new client ID
        setFormData(prev => ({
          ...prev,
          clientId: result.data.clientId
        }));
      } else {
        setAppRegistrationStatus({
          status: 'error',
          message: result.error || 'Failed to create app registration'
        });
      }
    } catch (error: any) {
      setAppRegistrationStatus({
        status: 'error',
        message: `Error creating app registration: ${error.message}`
      });
    }
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

            {/* App Registration Section */}
            <div className="form-group">
              <label>App Registration:</label>
              <div className="app-registration-section">
                {appRegistrationStatus.status === 'idle' && (
                  <div className="app-reg-idle">
                    <p className="app-reg-explanation">
                      Create a new app registration in the customer's tenant for this assessment.
                      This will generate a dedicated client ID and configure the proper permissions.
                    </p>
                    <button
                      type="button"
                      onClick={createAppRegistration}
                      disabled={!formData.tenantId}
                      className="create-app-button"
                    >
                      Create App Registration
                    </button>
                  </div>
                )}

                {appRegistrationStatus.status === 'creating' && (
                  <div className="app-reg-loading">
                    <div className="loading-spinner"></div>
                    <p>{appRegistrationStatus.message}</p>
                  </div>
                )}

                {appRegistrationStatus.status === 'success' && (
                  <div className="app-reg-success">
                    <h4>✅ App Registration Created</h4>
                    <div className="app-details">
                      <p><strong>Application ID:</strong> {appRegistrationStatus.appData?.applicationId}</p>
                      <p><strong>Client ID:</strong> {appRegistrationStatus.appData?.clientId}</p>
                      <p><strong>Service Principal ID:</strong> {appRegistrationStatus.appData?.servicePrincipalId}</p>
                    </div>
                  </div>
                )}

                {appRegistrationStatus.status === 'error' && (
                  <div className="app-reg-error">
                    <h4>❌ App Registration Failed</h4>
                    <p>{appRegistrationStatus.message}</p>
                    <button
                      type="button"
                      onClick={createAppRegistration}
                      className="retry-button"
                    >
                      Retry
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Client ID Display */}
            <div className="form-group">
              <label htmlFor="client-id">Client ID:</label>
              <input
                id="client-id"
                type="text"
                value={formData.clientId}
                readOnly
                className="form-input readonly"
              />
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