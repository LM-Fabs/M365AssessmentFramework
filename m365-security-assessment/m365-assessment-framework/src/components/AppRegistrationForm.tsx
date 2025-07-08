import React, { useState } from 'react';
import { Customer } from '../services/customerService';
import './AppRegistrationForm.css';

interface AppRegistrationFormProps {
  customer: Customer;
  onUpdate: (updatedCustomer: Customer) => void;
  onCancel: () => void;
}

interface AppRegistrationData {
  applicationId: string;
  clientId: string;
  clientSecret: string;
  servicePrincipalId?: string;
}

export const AppRegistrationForm: React.FC<AppRegistrationFormProps> = ({
  customer,
  onUpdate,
  onCancel
}) => {
  const [formData, setFormData] = useState<AppRegistrationData>({
    applicationId: customer.applicationId === 'MANUAL_SETUP_REQUIRED' ? '' : customer.applicationId,
    clientId: customer.clientId === 'MANUAL_SETUP_REQUIRED' ? '' : customer.clientId,
    clientSecret: '',
    servicePrincipalId: customer.servicePrincipalId === 'MANUAL_SETUP_REQUIRED' ? '' : customer.servicePrincipalId
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (field: keyof AppRegistrationData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Auto-fill client ID if application ID is entered
    if (field === 'applicationId' && value && !formData.clientId) {
      setFormData(prev => ({
        ...prev,
        clientId: value
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate required fields
      if (!formData.applicationId || !formData.clientId || !formData.clientSecret) {
        throw new Error('Application ID, Client ID, and Client Secret are required');
      }

      // Update customer with app registration details
      const updateData = {
        applicationId: formData.applicationId,
        clientId: formData.clientId,
        servicePrincipalId: formData.servicePrincipalId || formData.applicationId,
        // We don't directly store the client secret here for security
        // The backend should handle secure storage
        appRegistration: {
          applicationId: formData.applicationId,
          clientId: formData.clientId,
          servicePrincipalId: formData.servicePrincipalId || formData.applicationId,
          clientSecret: formData.clientSecret,
          isReal: true,
          isManualSetup: true,
          updatedDate: new Date().toISOString(),
          permissions: [
            'Organization.Read.All',
            'SecurityEvents.Read.All',
            'Reports.Read.All',
            'Directory.Read.All',
            'Policy.Read.All',
            'IdentityRiskyUser.Read.All',
            'AuditLog.Read.All'
          ]
        }
      };

      // Call the update API (this would need to be implemented in CustomerService)
      // For now, we'll create a simple fetch call
      const response = await fetch(`/api/customers/${customer.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update customer');
      }

      const result = await response.json();
      
      if (result.success) {
        const updatedCustomer: Customer = {
          ...customer,
          ...updateData,
          applicationId: formData.applicationId,
          clientId: formData.clientId,
          servicePrincipalId: formData.servicePrincipalId || formData.applicationId
        };
        
        onUpdate(updatedCustomer);
      } else {
        throw new Error(result.error || 'Update failed');
      }
    } catch (error: any) {
      console.error('Error updating app registration:', error);
      setError(error.message || 'Failed to update app registration');
    } finally {
      setLoading(false);
    }
  };

  const generateConsentUrl = () => {
    if (formData.applicationId && customer.tenantId) {
      const redirectUri = encodeURIComponent('https://portal.azure.com/');
      return `https://login.microsoftonline.com/${customer.tenantId}/oauth2/v2.0/authorize?client_id=${formData.applicationId}&response_type=code&redirect_uri=${redirectUri}&response_mode=query&scope=https://graph.microsoft.com/.default&state=12345&prompt=admin_consent`;
    }
    return '';
  };

  return (
    <div className="app-registration-form">
      <div className="form-header">
        <h3>🔧 Update App Registration Details</h3>
        <p>Enter the Azure AD app registration details for <strong>{customer.tenantName}</strong></p>
      </div>

      {error && (
        <div className="error-message">
          <span>⚠️</span>
          <p>{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-section">
          <h4>Azure AD App Registration Details</h4>
          
          <div className="form-group">
            <label htmlFor="applicationId">Application ID (Client ID) *</label>
            <input
              type="text"
              id="applicationId"
              value={formData.applicationId}
              onChange={(e) => handleInputChange('applicationId', e.target.value)}
              placeholder="12345678-1234-1234-1234-123456789012"
              className="form-input"
              required
            />
            <small className="form-help">
              From Azure Portal → App registrations → Your app → Overview → Application (client) ID
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="clientId">Client ID *</label>
            <input
              type="text"
              id="clientId"
              value={formData.clientId}
              onChange={(e) => handleInputChange('clientId', e.target.value)}
              placeholder="12345678-1234-1234-1234-123456789012"
              className="form-input"
              required
            />
            <small className="form-help">
              Usually the same as Application ID
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="clientSecret">Client Secret *</label>
            <input
              type="password"
              id="clientSecret"
              value={formData.clientSecret}
              onChange={(e) => handleInputChange('clientSecret', e.target.value)}
              placeholder="Enter the client secret value"
              className="form-input"
              required
            />
            <small className="form-help">
              From Azure Portal → App registrations → Your app → Certificates & secrets → Client secrets
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="servicePrincipalId">Service Principal ID (optional)</label>
            <input
              type="text"
              id="servicePrincipalId"
              value={formData.servicePrincipalId}
              onChange={(e) => handleInputChange('servicePrincipalId', e.target.value)}
              placeholder="12345678-1234-1234-1234-123456789012"
              className="form-input"
            />
            <small className="form-help">
              From Azure Portal → Enterprise applications → Search for your app → Object ID
            </small>
          </div>
        </div>

        {formData.applicationId && (
          <div className="form-section">
            <h4>Admin Consent URL</h4>
            <div className="consent-url-section">
              <p>Provide this URL to the customer's Global Administrator:</p>
              <div className="consent-url">
                <input
                  type="text"
                  value={generateConsentUrl()}
                  readOnly
                  className="form-input consent-url-input"
                />
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(generateConsentUrl())}
                  className="btn-secondary copy-btn"
                >
                  📋 Copy
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="form-actions">
          <button
            type="button"
            onClick={onCancel}
            className="btn-secondary"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={loading || !formData.applicationId || !formData.clientId || !formData.clientSecret}
          >
            {loading ? 'Updating...' : 'Update App Registration'}
          </button>
        </div>
      </form>

      <div className="help-section">
        <h4>📋 Setup Checklist</h4>
        <ul>
          <li>✅ Created Azure AD app registration with multi-tenant support</li>
          <li>✅ Added required Microsoft Graph API permissions</li>
          <li>✅ Generated client secret (valid for 24 months recommended)</li>
          <li>🔄 Update customer record with app registration details (this form)</li>
          <li>🔄 Customer admin grants consent using the URL above</li>
          <li>🔄 Test by running an assessment</li>
        </ul>
      </div>
    </div>
  );
};
