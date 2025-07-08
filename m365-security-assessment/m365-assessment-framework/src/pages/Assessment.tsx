import React, { useState, useEffect } from 'react';
import { CustomerService, Customer } from '../services/customerService';
import { BasicAssessment } from '../components/assessment/BasicAssessment';
import './Assessment.css';

const Assessment: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualTenantId, setManualTenantId] = useState('');
  const [manualTenantDomain, setManualTenantDomain] = useState('');

  const customerService = CustomerService.getInstance();

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      setError(null);
      const customerList = await customerService.getCustomers();
      setCustomers(customerList);
    } catch (error: any) {
      console.error('Error loading customers:', error);
      setError('Failed to load customers. You can still perform manual assessments.');
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerSelect = (customer: Customer) => {
    setSelectedCustomer(customer);
    setShowManualEntry(false);
  };

  const handleManualEntry = async () => {
    if (manualTenantId.trim()) {
      try {
        setLoading(true);
        setError(null);
        
        // Create a customer record without automatic app registration (manual workflow preferred)
        const customerData = {
          tenantName: manualTenantDomain || `Manual Tenant ${Date.now()}`,
          tenantDomain: manualTenantDomain || `${manualTenantId.replace(/[^a-zA-Z0-9]/g, '')}.onmicrosoft.com`,
          tenantId: manualTenantId.trim(),
          contactEmail: '',
          notes: 'Created via manual entry - requires manual app registration setup'
        };

        console.log('Creating customer for manual app registration workflow:', customerData);
        
        // Create customer record (backend should not attempt automatic app registration)
        const newCustomer = await customerService.createCustomer({
          ...customerData,
          skipAutoAppRegistration: true // Signal to backend to skip automatic app registration
        });
        
        if (newCustomer) {
          console.log('Customer created successfully for manual workflow:', newCustomer);
          setSelectedCustomer(newCustomer);
          // Refresh customers list to include the new customer
          await loadCustomers();
        } else {
          throw new Error('Failed to create customer record');
        }
      } catch (error: any) {
        console.error('Error creating customer:', error);
        setError(`Failed to create customer record: ${error.message || error.toString()}`);
        
        // Create a temporary customer for assessment
        const tempCustomer: Customer = {
          id: `temp-${Date.now()}`,
          tenantId: manualTenantId.trim(),
          tenantName: manualTenantDomain || `Temp Tenant ${manualTenantId}`,
          tenantDomain: manualTenantDomain || '',
          applicationId: '',
          clientId: '',
          servicePrincipalId: '',
          createdDate: new Date(),
          totalAssessments: 0,
          status: 'active',
          permissions: []
        };
        setSelectedCustomer(tempCustomer);
        
        setError(`Could not create customer record: ${error.message}. Using temporary entry - you'll need to manually set up the app registration.`);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleAssessmentComplete = (assessment: any) => {
    console.log('Assessment completed:', assessment);
    // Here you could save the assessment result or navigate to results page
  };

  const resetSelection = () => {
    setSelectedCustomer(null);
    setShowManualEntry(false);
    setManualTenantId('');
    setManualTenantDomain('');
  };

  if (loading) {
    return (
      <div className="assessment-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading customers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="assessment-page">
      <div className="page-header">
        <h1>🛡️ Security Assessment</h1>
        <p>Perform comprehensive security assessments for Microsoft 365 tenants</p>
      </div>

      {!selectedCustomer && (
        <div className="customer-selection">
          <div className="selection-section">
            <h2>Select Customer</h2>
            
            {error && (
              <div className="error-message">
                <span>⚠️</span>
                <p>{error}</p>
              </div>
            )}

            {customers.length > 0 && (
              <div className="customer-list">
                <h3>Existing Customers</h3>
                <div className="customer-grid">
                  {customers.map(customer => (
                    <div 
                      key={customer.id}
                      className="customer-card"
                      onClick={() => handleCustomerSelect(customer)}
                    >
                      <div className="customer-header">
                        <h4>{customer.tenantName}</h4>
                        <span className={`status ${customer.status}`}>
                          {customer.status}
                        </span>
                      </div>
                      <p className="customer-domain">{customer.tenantDomain}</p>
                      <p className="customer-id">ID: {customer.tenantId}</p>
                      <div className="customer-stats">
                        <span>📊 {customer.totalAssessments} assessments</span>
                        {customer.lastAssessmentDate && (
                          <span>📅 Last: {customer.lastAssessmentDate.toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="manual-entry-section">
              <h3>Add New Customer</h3>
              <p>Register a new customer with automatic Azure AD app registration for assessments:</p>
              
              <div className="manual-form">
                <div className="form-group">
                  <label htmlFor="tenantId">Tenant ID or Domain *</label>
                  <input
                    type="text"
                    id="tenantId"
                    value={manualTenantId}
                    onChange={(e) => setManualTenantId(e.target.value)}
                    placeholder="e.g. contoso.onmicrosoft.com or 12345678-1234-1234-1234-123456789012"
                    className="form-input"
                  />
                  <small className="form-help">Enter the Microsoft 365 tenant ID (GUID) or domain</small>
                </div>
                
                <div className="form-group">
                  <label htmlFor="tenantDomain">Customer Name/Domain (optional)</label>
                  <input
                    type="text"
                    id="tenantDomain"
                    value={manualTenantDomain}
                    onChange={(e) => setManualTenantDomain(e.target.value)}
                    placeholder="e.g. Contoso Corporation or contoso.com"
                    className="form-input"
                  />
                  <small className="form-help">Friendly name or custom domain for this customer</small>
                </div>

                <div className="info-box">
                  <span>ℹ️</span>
                  <div>
                    <strong>What happens next:</strong>
                    <ul>
                      <li>A real Azure AD app registration will be created automatically</li>
                      <li>The customer will be added to your customers list</li>
                      <li>Admin consent will be required before assessments can run</li>
                      <li>You'll receive a consent URL for the customer admin</li>
                    </ul>
                  </div>
                </div>

                <button
                  className="btn-primary"
                  onClick={handleManualEntry}
                  disabled={!manualTenantId.trim() || loading}
                >
                  {loading ? 'Creating Customer...' : 'Create Customer & Start Assessment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedCustomer && (
        <div className="assessment-container">
          <div className="assessment-header-controls">
            <button 
              className="btn-secondary back-btn"
              onClick={resetSelection}
            >
              ← Back to Customer Selection
            </button>
          </div>

          {/* App Registration Status Check */}
          {selectedCustomer.clientId && selectedCustomer.clientId.startsWith('pending-') && (
            <div className="app-registration-warning">
              <div className="warning-content">
                <span className="warning-icon">⚠️</span>
                <div className="warning-text">
                  <h4>App Registration Setup Required</h4>
                  <p>This customer has a placeholder app registration. A real Azure AD app registration is needed for assessments to work properly.</p>
                  <div className="warning-actions">
                    <p><strong>To fix this:</strong></p>
                    <ol>
                      <li>Delete this customer and recreate using the "Add New Customer" option above</li>
                      <li>Or manually create an Azure AD app registration for this tenant</li>
                      <li>Grant admin consent for the required Microsoft Graph permissions</li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          )}

          {selectedCustomer.clientId && !selectedCustomer.clientId.startsWith('pending-') && selectedCustomer.clientId.length > 10 && (
            <div className="app-registration-success">
              <div className="success-content">
                <span className="success-icon">✅</span>
                <div className="success-text">
                  <h4>App Registration Active</h4>
                  <p>This customer has a valid Azure AD app registration. If assessments fail, admin consent may be required.</p>
                </div>
              </div>
            </div>
          )}

          <BasicAssessment
            customerId={selectedCustomer.id}
            tenantId={selectedCustomer.tenantId}
            tenantDomain={selectedCustomer.tenantDomain || undefined}
            onAssessmentComplete={handleAssessmentComplete}
          />
        </div>
      )}
    </div>
  );
};

export default Assessment;
