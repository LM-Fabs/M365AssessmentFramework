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

  // Auto-populate fields when customer is selected
  useEffect(() => {
    if (formData.customer) {
      setFormData(prev => ({
        ...prev,
        // NOTE: We do NOT use customer's clientId - we use OUR app's clientId
        // The customer's tenant ID is what we need for targeting the consent
        tenantId: formData.customer?.tenantId || ''
      }));
      // Trigger URL generation immediately when customer changes
      generateConsentUrl();
    }
  }, [formData.customer]);

  // Generate consent URL whenever relevant fields change
  useEffect(() => {
    generateConsentUrl();
  }, [formData.tenantId, formData.redirectUri, formData.permissions, formData.customer, formData.clientId]);

  const generateConsentUrl = async () => {
    console.log('🔍 generateConsentUrl called:', {
      customer: formData.customer,
      tenantId: formData.tenantId,
      clientId: M365_ASSESSMENT_CONFIG.clientId
    });

    if (!formData.customer?.id) {
      console.log('❌ No customer selected, clearing URL');
      setGeneratedUrl('');
      return;
    }

    try {
      const adminConsentService = AdminConsentService.getInstance();
      
      // Always use YOUR app's client ID (not customer's)
      const clientId = M365_ASSESSMENT_CONFIG.clientId;
      console.log('📋 Using client ID:', clientId);
      
      // If no tenant ID is provided, try to auto-detect it
      let tenantId = formData.tenantId;
      if (!tenantId) {
        console.log('🔄 No tenant ID provided, trying auto-detection...');
        const autoDetectResult = await adminConsentService.generateConsentUrlWithAutoTenant(
          clientId, // YOUR app's client ID
          formData.redirectUri,
          formData.customer.id,
          formData.permissions.join(' ')
        );
        
        if (autoDetectResult.url) {
          console.log('✅ Auto-detection successful:', autoDetectResult);
          setGeneratedUrl(autoDetectResult.url);
          // Update the form with the detected tenant ID
          if (autoDetectResult.tenantId) {
            setFormData(prev => ({ ...prev, tenantId: autoDetectResult.tenantId! }));
          }
          return;
        } else {
          console.log('❌ Auto-detection failed:', autoDetectResult);
        }
      }

      // Fallback to manual tenant ID if provided
      if (tenantId) {
        console.log('🎯 Using manual tenant ID:', tenantId);
        const consentUrl = adminConsentService.generateCustomerConsentUrl({
          clientId: clientId, // YOUR app's client ID
          redirectUri: formData.redirectUri,
          customerId: formData.customer.id,
          customerTenantId: tenantId, // Customer's tenant ID
          scope: formData.permissions.join(' ')
        });
        
        console.log('✅ Generated consent URL:', consentUrl);
        setGeneratedUrl(consentUrl);
      } else {
        console.log('❌ No tenant ID available, clearing URL');
        setGeneratedUrl('');
      }
    } catch (error) {
      console.error('Error generating consent URL:', error);
      setGeneratedUrl('');
    }
  };

  const handleAutoDetectTenant = async () => {
    setIsAutoDetecting(true);
    
    try {
      const adminConsentService = AdminConsentService.getInstance();
      const userTenantInfo = await adminConsentService.getCurrentUserTenantInfo();
      
      if (userTenantInfo?.tenantId) {
        setFormData(prev => ({ 
          ...prev, 
          tenantId: userTenantInfo.tenantId!
          // Note: clientId is always M365_ASSESSMENT_CONFIG.clientId - not customer specific
        }));
      } else {
        alert('Could not automatically detect your tenant ID. Please enter it manually.');
      }
    } catch (error) {
      console.error('Error auto-detecting tenant:', error);
      alert('Failed to auto-detect tenant ID. Please enter it manually.');
    } finally {
      setIsAutoDetecting(false);
    }
  };

  const handleCustomerSelect = (customerId: string) => {
    const selectedCustomer = customers.find(c => c.id === customerId) || null;
    setFormData(prev => ({ ...prev, customer: selectedCustomer }));
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
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = generatedUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const openConsentUrl = () => {
    if (!generatedUrl) return;
    
    window.open(generatedUrl, 'admin-consent', 'width=600,height=800,scrollbars=yes,resizable=yes');
  };

  const availablePermissions = [
    { name: 'Organization.Read.All', description: 'Read organization and license information' },
    { name: 'SecurityEvents.Read.All', description: 'Read security events and secure score' },
    { name: 'Reports.Read.All', description: 'Read usage and activity reports' },
    { name: 'Directory.Read.All', description: 'Read directory data (users, groups, etc.)' },
    { name: 'Policy.Read.All', description: 'Read conditional access and compliance policies' },
    { name: 'IdentityRiskyUser.Read.All', description: 'Read identity protection data' },
    { name: 'AuditLog.Read.All', description: 'Read audit logs and sign-in logs' },
    { name: 'DeviceManagementManagedDevices.Read.All', description: 'Read managed device information' },
    { name: 'ThreatIndicators.Read.All', description: 'Read threat indicators and security alerts' }
  ];

  return (
    <div className="consent-url-generator">
      <div className="generator-header">
        <h3>🔗 Admin Consent URL Generator</h3>
        <p>Generate admin consent URLs for customer app registrations</p>
        {onClose && (
          <button type="button" className="close-button" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>

      <div className="generator-form">
        {/* Customer Selection */}
        <div className="form-section">
          <h4>Customer & App Registration</h4>
          
          <div className="form-field">
            <label htmlFor="customerSelect">Select Customer (Optional)</label>
            <select
              id="customerSelect"
              value={formData.customer?.id || ''}
              onChange={(e) => handleCustomerSelect(e.target.value)}
              className="form-input"
            >
              <option value="">Manual entry</option>
              {customers.map(customer => (
                <option key={customer.id} value={customer.id}>
                  {customer.tenantName || customer.tenantDomain || customer.id} 
                  {customer.tenantDomain && customer.tenantName !== customer.tenantDomain ? ` (${customer.tenantDomain})` : ''}
                </option>
              ))}
            </select>
            <small className="form-help">
              Select a customer to auto-populate fields, or enter manually below
            </small>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label htmlFor="clientId">Application (Client) ID (Auto-configured)</label>
              <input
                type="text"
                id="clientId"
                value={M365_ASSESSMENT_CONFIG.clientId}
                readOnly
                className="form-input readonly"
                title="This is YOUR app's client ID - same for all customers"
              />
              <small className="form-help">
                ✅ Auto-configured from your M365 Assessment Framework app registration
              </small>
            </div>

            <div className="form-field">
              <label htmlFor="tenantId">Customer Tenant ID/Domain *</label>
              <div className="input-with-button">
                <input
                  type="text"
                  id="tenantId"
                  value={formData.tenantId}
                  onChange={(e) => handleInputChange('tenantId', e.target.value)}
                  placeholder="customer.onmicrosoft.com or tenant ID"
                  className="form-input"
                  required
                />
                <button
                  type="button"
                  onClick={handleAutoDetectTenant}
                  disabled={isAutoDetecting}
                  className="auto-detect-button"
                  title="Auto-detect from current user session"
                >
                  {isAutoDetecting ? '🔄' : '🔍'}
                </button>
              </div>
              <small className="form-help">
                Customer's tenant ID or domain. Click 🔍 to auto-detect from your current session.
              </small>
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="redirectUri">Redirect URI</label>
            <input
              type="url"
              id="redirectUri"
              value={formData.redirectUri}
              onChange={(e) => handleInputChange('redirectUri', e.target.value)}
              className="form-input"
            />
            <small className="form-help">
              Where to redirect after consent (default: Azure Portal)
            </small>
          </div>
        </div>

        {/* Permissions Selection */}
        <div className="form-section">
          <h4>Required Permissions</h4>
          <p className="section-description">
            Select the Microsoft Graph permissions needed for security assessments
          </p>
          
          <div className="permissions-grid">
            {availablePermissions.map(permission => (
              <div key={permission.name} className="permission-item">
                <label className="permission-checkbox">
                  <input
                    type="checkbox"
                    checked={formData.permissions.includes(permission.name)}
                    onChange={() => handlePermissionToggle(permission.name)}
                  />
                  <span className="permission-name">{permission.name}</span>
                </label>
                <small className="permission-description">{permission.description}</small>
              </div>
            ))}
          </div>
        </div>

        {/* Generated URL */}
        <div className="form-section">
          <h4>Generated Admin Consent URL</h4>
          
          {generatedUrl ? (
            <div className="url-output">
              <div className="url-display">
                <textarea
                  value={generatedUrl}
                  readOnly
                  className="url-textarea"
                  rows={3}
                />
              </div>
              
              <div className="url-actions">
                <button
                  type="button"
                  onClick={copyToClipboard}
                  className="btn-secondary"
                  disabled={!generatedUrl}
                >
                  {copied ? (
                    <>
                      <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                        <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                      </svg>
                      Copy URL
                    </>
                  )}
                </button>
                
                <button
                  type="button"
                  onClick={openConsentUrl}
                  className="btn-primary"
                  disabled={!generatedUrl}
                >
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 11-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zm9 1a1 1 0 010-2h4a1 1 0 011 1v4a1 1 0 01-2 0V6.414l-2.293 2.293a1 1 0 11-1.414-1.414L13.586 5H12z" clipRule="evenodd" />
                  </svg>
                  Open Consent Page
                </button>
              </div>

              <div className="consent-instructions">
                <h5>📋 Instructions for Customer Admin</h5>
                <ol>
                  <li>Send this URL to the customer's <strong>Global Administrator</strong></li>
                  <li>Admin clicks the URL and signs in with their admin account</li>
                  <li>Admin reviews the requested permissions</li>
                  <li>Admin clicks <strong>"Accept"</strong> to grant organization-wide consent</li>
                  <li>App registration is now ready for security assessments</li>
                </ol>
              </div>
            </div>
          ) : (
            <div className="url-placeholder">
              <p>Enter Client ID and Tenant ID to generate consent URL</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
