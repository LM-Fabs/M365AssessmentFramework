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
                      <div className="customer-details">
                        <p className="customer-domain"><strong>Domain:</strong> {customer.tenantDomain}</p>
                        <p className="customer-id"><strong>Tenant ID:</strong> {customer.tenantId}</p>
                        <p className="app-registration">
                          <strong>App Registration:</strong> {
                            customer.clientId?.startsWith('pending-') ? 
                              `${customer.clientId} (placeholder)` :
                            customer.clientId?.startsWith('client-') ?
                              `${customer.clientId} (manual setup)` :
                            customer.clientId === 'MANUAL_SETUP_REQUIRED' ?
                              'Manual setup required' :
                            customer.clientId && customer.clientId.length > 10 ?
                              `${customer.clientId.substring(0, 8)}...` :
                              'Not configured'
                          }
                        </p>
                        <div className="customer-stats">
                          <span>📊 <strong>Previous Assessments:</strong> {customer.totalAssessments}</span>
                          {customer.lastAssessmentDate ? (
                            <span>📅 <strong>Last Assessment:</strong> {customer.lastAssessmentDate.toLocaleDateString()}</span>
                          ) : (
                            <span>📅 <strong>Last Assessment:</strong> No assessments</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="manual-entry-section">
              <h3>Add New Customer</h3>
              <div className="info-box">
                <h4>🔧 Manual App Registration Workflow</h4>
                <p>This system uses a <strong>manual app registration process</strong> for reliability and security:</p>
                <ol>
                  <li><strong>Create customer record</strong> - Enter tenant details below</li>
                  <li><strong>Manual Azure AD setup</strong> - Create app registration in Azure Portal</li>
                  <li><strong>Configure permissions</strong> - Add required Microsoft Graph permissions</li>
                  <li><strong>Admin consent</strong> - Customer admin grants permissions</li>
                  <li><strong>Update customer</strong> - Add app registration details to customer record</li>
                </ol>
                <p>📋 See <strong>MANUAL-APP-REGISTRATION-GUIDE.md</strong> for detailed instructions.</p>
              </div>
              
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
                      <li>A customer record will be created with manual setup instructions</li>
                      <li>You'll need to create an Azure AD app registration manually</li>
                      <li>Configure the required Microsoft Graph API permissions</li>
                      <li>Customer admin must grant consent for the permissions</li>
                      <li>Update the customer record with app registration details</li>
                    </ul>
                    <p><strong>📋 Manual setup is recommended for production environments</strong></p>
                  </div>
                </div>

                <button
                  className="btn-primary"
                  onClick={handleManualEntry}
                  disabled={!manualTenantId.trim() || loading}
                >
                  {loading ? 'Creating Customer Record...' : 'Create Customer Record'}
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
          {selectedCustomer.clientId && (
            selectedCustomer.clientId.startsWith('pending-') || 
            selectedCustomer.clientId.startsWith('client-') ||
            selectedCustomer.clientId === 'MANUAL_SETUP_REQUIRED' ||
            selectedCustomer.clientId === 'REPLACE_WITH_REAL_SECRET'
          ) && (
            <div className="app-registration-warning">
              <div className="warning-content">
                <span className="warning-icon">⚠️</span>
                <div className="warning-text">
                  <h4>Manual App Registration Setup Required</h4>
                  <p>This customer requires manual Azure AD app registration setup. The current app registration needs to be replaced with real values.</p>
                  <div className="warning-actions">
                    <p><strong>Current Status:</strong></p>
                    <ul>
                      <li><strong>Application ID:</strong> {selectedCustomer.applicationId}</li>
                      <li><strong>Client ID:</strong> {selectedCustomer.clientId}</li>
                      <li><strong>Setup Status:</strong> Pending manual configuration</li>
                    </ul>
                    <p><strong>Next Steps:</strong></p>
                    <ol>
                      <li>📋 Follow the <strong>MANUAL-APP-REGISTRATION-GUIDE.md</strong> instructions</li>
                      <li>🔧 Create Azure AD app registration in Azure Portal</li>
                      <li>🔑 Configure required Microsoft Graph API permissions</li>
                      <li>✅ Grant admin consent during app registration creation</li>
                      <li>📝 Update this customer record with real app registration details</li>
                    </ol>
                    <div className="validation-tools">
                      <p><strong>Validation Tools:</strong></p>
                      <ul>
                        <li>Use <code>validate-manual-app-registration.sh</code> to test setup</li>
                        <li>Use the AppRegistrationForm component to update details</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {selectedCustomer.clientId && 
           !selectedCustomer.clientId.startsWith('pending-') && 
           !selectedCustomer.clientId.startsWith('client-') &&
           selectedCustomer.clientId !== 'MANUAL_SETUP_REQUIRED' &&
           selectedCustomer.clientId !== 'REPLACE_WITH_REAL_SECRET' &&
           selectedCustomer.clientId.length > 10 && (
            <div className="app-registration-success">
              <div className="success-content">
                <span className="success-icon">✅</span>
                <div className="success-text">
                  <h4>App Registration Active</h4>
                  <p>This customer has a valid Azure AD app registration with admin consent granted. Assessments should work properly.</p>
                  <div className="app-details">
                    <p><strong>Application ID:</strong> {selectedCustomer.applicationId}</p>
                    <p><strong>Client ID:</strong> {selectedCustomer.clientId}</p>
                    <p><strong>Status:</strong> Ready for assessments</p>
                  </div>
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
