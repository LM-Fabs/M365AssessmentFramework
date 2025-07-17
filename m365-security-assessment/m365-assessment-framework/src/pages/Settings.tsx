// filepath: /m365-assessment-framework/m365-assessment-framework/src/pages/Settings.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { AssessmentService } from '../services/assessmentService';
import { Customer, CustomerService } from '../services/customerService';
import CustomerSelector, { CustomerSelectorRef } from '../components/ui/CustomerSelector';
import { SECURITY_CATEGORIES } from '../shared/constants';
import './Settings.css';

const Settings = () => {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [newCustomerData, setNewCustomerData] = useState({
    tenantName: '',
    tenantDomain: '',
    tenantId: '',  // Add tenant ID field
    contactEmail: '',
    notes: ''
  });
  const [newCustomerError, setNewCustomerError] = useState<string | null>(null);
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  
  // Customer management state
  const [showCustomerManagement, setShowCustomerManagement] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState(false);
  const [customerError, setCustomerError] = useState<string | null>(null);
  
  // App registration management state
  const [creatingAppRegistration, setCreatingAppRegistration] = useState<string | null>(null);
  const [appRegistrationStatus, setAppRegistrationStatus] = useState<{[customerId: string]: string}>({});
  
  // Helper function to generate assessment name with date
  const generateAssessmentName = (customerName?: string) => {
    const today = new Date();
    const dateStr = today.toLocaleDateString('de-DE'); // German format: DD.MM.YYYY
    const baseName = customerName ? `Security Assessment ${customerName}` : 'Security Assessment';
    return `${baseName} - ${dateStr}`;
  };
  
  const [formData, setFormData] = useState({
    assessmentName: generateAssessmentName(),
    includedCategories: Object.keys(SECURITY_CATEGORIES),
    notificationEmail: user?.email || '',
    autoSchedule: false,
    scheduleFrequency: 'monthly'
  });
  
  // Add a ref to access CustomerSelector methods
  const customerSelectorRef = useRef<CustomerSelectorRef>(null);

  const handleCustomerSelect = (customer: Customer | null) => {
    setSelectedCustomer(customer);
    setError(null);
    
    // Update assessment name with customer name and current date
    setFormData(prev => ({
      ...prev,
      assessmentName: generateAssessmentName(customer?.tenantName)
    }));
  };

  const handleAssessmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedCustomer) {
      setError('Please select a customer or create a new one');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const assessmentService = AssessmentService.getInstance();
      
      // Use the existing customer's app registration to perform the assessment
      const assessmentData = {
        customerId: selectedCustomer.id,
        tenantId: selectedCustomer.tenantId,
        assessmentName: formData.assessmentName,
        includedCategories: formData.includedCategories,
        notificationEmail: formData.notificationEmail,
        autoSchedule: formData.autoSchedule,
        scheduleFrequency: formData.scheduleFrequency
      };

      // Perform the assessment using the customer's existing Azure app registration
      const assessmentResult = await assessmentService.createAssessmentForCustomer(assessmentData);
      
      setSuccess(true);
      setTimeout(() => {
        navigate('/dashboard', { 
          state: { 
            assessment: assessmentResult,
            customer: selectedCustomer
          } 
        });
      }, 1500);
    } catch (error: any) {
      setError(error.message || 'Failed to perform security assessment');
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryToggle = (category: string) => {
    setFormData(prev => ({
      ...prev,
      includedCategories: prev.includedCategories.includes(category)
        ? prev.includedCategories.filter(c => c !== category)
        : [...prev.includedCategories, category]
    }));
  };

  const handleCreateNewCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!newCustomerData.tenantName || !newCustomerData.tenantDomain) {
      setNewCustomerError('Tenant Name and Domain are required');
      return;
    }

    setCreatingCustomer(true);
    setNewCustomerError(null);

    try {
      const customerService = CustomerService.getInstance();
      const newCustomer = await customerService.createCustomer({
        tenantName: newCustomerData.tenantName,
        tenantDomain: newCustomerData.tenantDomain,
        tenantId: newCustomerData.tenantId || undefined,  // Include tenantId if provided
        contactEmail: newCustomerData.contactEmail,
        notes: newCustomerData.notes
      });
      
      setSelectedCustomer(newCustomer);
      
      try {
        await customerSelectorRef.current?.refresh();
      } catch (refreshError) {
        console.error('Error refreshing customer selector:', refreshError);
      }
      
      setNewCustomerData({
        tenantName: '',
        tenantDomain: '',
        tenantId: '',  // Include tenant ID in reset
        contactEmail: '',
        notes: ''
      });
      
      setShowNewCustomerForm(false);
      
      // Update the assessment name with the new customer and current date
      setFormData(prev => ({
        ...prev,
        assessmentName: generateAssessmentName(newCustomer.tenantName)
      }));

      setError(null);
      setSuccess(false);
      
    } catch (error: any) {
      console.error('Customer creation failed:', error);
      const errorMessage = error.message || 'Failed to create new customer';
      setNewCustomerError(errorMessage);
    } finally {
      setCreatingCustomer(false);
    }
  };

  // Customer management functions
  const loadCustomers = async () => {
    setLoadingCustomers(true);
    setCustomerError(null);
    
    try {
      const customerService = CustomerService.getInstance();
      const customerList = await customerService.getCustomers();
      setCustomers(customerList.filter(c => c.status === 'active'));
    } catch (error: any) {
      setCustomerError('Failed to load customers');
    } finally {
      setLoadingCustomers(false);
    }
  };

  const handleDeleteCustomer = async (customer: Customer) => {
    setCustomerToDelete(customer);
  };

  const confirmDeleteCustomer = async () => {
    if (!customerToDelete) return;
    
    setDeletingCustomer(true);
    setCustomerError(null);
    
    try {
      const customerService = CustomerService.getInstance();
      await customerService.deleteCustomer(customerToDelete.id);
      
      setCustomers(prev => prev.filter(c => c.id !== customerToDelete.id));
      
      if (selectedCustomer?.id === customerToDelete.id) {
        setSelectedCustomer(null);
      }
      
      await customerSelectorRef.current?.refresh();
      setCustomerToDelete(null);
    } catch (error: any) {
      console.error('Failed to delete customer:', error);
      setCustomerError(error.message || 'Failed to delete customer');
    } finally {
      setDeletingCustomer(false);
    }
  };

  // App registration management function
  const handleCreateAppRegistration = async (customer: Customer) => {
    setCreatingAppRegistration(customer.id);
    setAppRegistrationStatus(prev => ({ ...prev, [customer.id]: 'Creating Azure AD app registration...' }));
    
    try {
      console.log('🏢 Creating Azure AD app registration for customer:', customer.tenantName);
      
      const response = await fetch('/api/enterprise-app/multi-tenant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetTenantId: customer.tenantId,
          targetTenantDomain: customer.tenantDomain,
          tenantName: customer.tenantName,
          contactEmail: customer.contactEmail,
          assessmentName: `M365 Security Assessment - ${customer.tenantName}`,
          requiredPermissions: [
            // Minimal permissions for license and secure score assessment only
            'Organization.Read.All',      // Required for license data (/subscribedSkus)
            'SecurityEvents.Read.All'     // Required for secure score data (/security/secureScores, /security/secureScoreControlProfiles)
          ]
        })
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      if (result.success && result.data) {
        const appData = result.data;
        
        // Check if app registration failed
        if (appData.applicationId === 'ERROR_DURING_CREATION') {
          throw new Error(`App registration failed: ${result.appRegistrationError?.error || 'Unknown error during app registration creation'}`);
        }
        
        // Update customer with app registration details (excluding client secret for security)
        const customerService = CustomerService.getInstance();
        await customerService.updateCustomer(customer.id, {
          applicationId: appData.applicationId,
          clientId: appData.clientId,
          servicePrincipalId: appData.servicePrincipalId,
          // Note: Client secret is not stored in customer record for security reasons
          // It should be stored securely (e.g., Key Vault) and accessed when needed
        });
        
        console.log('✅ App registration created successfully:', appData.clientId);
        console.log('🔗 Admin consent URL:', appData.consentUrl);
        
        // Ensure we have a valid consent URL
        let consentUrl = appData.consentUrl;
        if (!consentUrl || consentUrl.trim() === '') {
          // Generate fallback consent URL
          consentUrl = `https://login.microsoftonline.com/${customer.tenantId}/adminconsent?client_id=${appData.clientId}&redirect_uri=${encodeURIComponent('https://portal.azure.com/')}`;
          console.warn('⚠️ No consent URL provided, using fallback:', consentUrl);
        }
        
        // Open admin consent URL in a new window
        const consentWindow = window.open(
          consentUrl,
          'admin-consent',
          'width=600,height=800,scrollbars=yes,resizable=yes'
        );
        
        if (!consentWindow) {
          // Popup blocked or failed to open
          setAppRegistrationStatus(prev => ({ 
            ...prev, 
            [customer.id]: `App registration created successfully! Please manually open the admin consent URL: ${consentUrl}` 
          }));
        } else {
          setAppRegistrationStatus(prev => ({ 
            ...prev, 
            [customer.id]: 'App registration created successfully! Admin consent window opened. Please complete the consent process.' 
          }));
        }
        
        // Monitor consent window closure
        const checkClosed = setInterval(() => {
          if (consentWindow?.closed) {
            clearInterval(checkClosed);
            setAppRegistrationStatus(prev => ({ 
              ...prev, 
              [customer.id]: 'App registration created. Please verify admin consent was completed successfully.' 
            }));
            // Refresh customer data to reflect changes
            loadCustomers();
          }
        }, 1000);
        
        // Auto-close status message after successful creation
        setTimeout(() => {
          if (consentWindow?.closed) {
            setAppRegistrationStatus(prev => {
              const updated = { ...prev };
              delete updated[customer.id];
              return updated;
            });
          }
        }, 10000);
        
      } else {
        throw new Error(result.error || 'App registration creation failed - no data returned');
      }
      
    } catch (error: any) {
      console.error('❌ Error creating app registration:', error);
      
      let errorMessage = 'Failed to create app registration';
      
      if (error.message?.includes('App registration failed:')) {
        // This is an error from the backend indicating app registration creation failed
        errorMessage = error.message;
      } else if (error.message?.includes('authentication') || error.message?.includes('token')) {
        errorMessage = 'Authentication failed. Please check the service configuration.';
      } else if (error.message?.includes('permissions') || error.message?.includes('403')) {
        errorMessage = 'Insufficient permissions. Please contact your administrator to grant Application.ReadWrite.All permission to the service principal.';
      } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      } else if (error.message?.includes('Missing required environment variables')) {
        errorMessage = 'Service configuration error. Missing Azure credentials. Please contact your administrator.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setAppRegistrationStatus(prev => ({ 
        ...prev, 
        [customer.id]: `Failed: ${errorMessage}` 
      }));
      
    } finally {
      setCreatingAppRegistration(null);
    }
  };

  // Helper function to get app registration status
  const getAppRegistrationStatus = (customer: Customer): { status: string; color: string; action?: string } => {
    if (appRegistrationStatus[customer.id]) {
      return { 
        status: appRegistrationStatus[customer.id], 
        color: appRegistrationStatus[customer.id].includes('successfully') ? 'green' : 
               appRegistrationStatus[customer.id].includes('Failed') ? 'red' : 'blue' 
      };
    }
    
    if (customer.applicationId && customer.clientId && customer.servicePrincipalId &&
        !customer.applicationId.startsWith('pending-') && !customer.clientId.startsWith('pending-')) {
      return { status: 'Active', color: 'green' };
    }
    
    if (customer.applicationId?.startsWith('pending-') || customer.clientId?.startsWith('pending-')) {
      return { status: 'Pending Setup', color: 'orange', action: 'Create App Registration' };
    }
    
    return { status: 'Not Configured', color: 'red', action: 'Create App Registration' };
  };

  // Load customers when customer management is opened
  useEffect(() => {
    if (showCustomerManagement) {
      loadCustomers();
    }
  }, [showCustomerManagement]);

  // Pre-load customers when Settings component mounts to improve UX
  useEffect(() => {
    const preloadCustomers = async () => {
      try {
        const customerService = CustomerService.getInstance();
        customerService.prefetchCustomers();
      } catch (error) {
        console.warn('Background customer prefetch failed:', error);
      }
    };
    
    preloadCustomers();
  }, []);

  if (!isAuthenticated) {
    return (
      <div className="authentication-prompt">
        <h2>Authentication Required</h2>
        <p>Please log in to access assessment settings.</p>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1>Security Assessment Settings</h1>
        <p>Configure and run security assessments for your customers</p>
      </div>

      <form className="settings-form" onSubmit={handleAssessmentSubmit}>
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">Assessment started successfully. Redirecting...</div>}

        {/* Customer Selection Section */}
        <div className="form-section">
          <h2>Customer Selection</h2>
          <p>Select an existing customer with configured Azure app registration, or add a new customer.</p>
          
          <div className="customer-selection-container">
            <CustomerSelector
              ref={customerSelectorRef}
              selectedCustomer={selectedCustomer}
              onCustomerSelect={handleCustomerSelect}
              placeholder="Choose a customer to assess..."
              disabled={loading}
            />
            
            <div className="customer-actions">
              <button
                type="button"
                className="add-customer-button"
                onClick={() => {
                  setShowNewCustomerForm(true);
                  customerSelectorRef.current?.closeDropdown();
                }}
                disabled={loading}
              >
                <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                Add New Customer
              </button>
            </div>
          </div>

          {/* New Customer Form */}
          {showNewCustomerForm && (
            <div className="new-customer-form-section">
              <div className="form-header">
                <h3>Add New Customer</h3>
                <button
                  type="button"
                  className="close-form-button"
                  onClick={() => {
                    setShowNewCustomerForm(false);
                    setNewCustomerError(null);
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>

              {newCustomerError && <div className="error-message">{newCustomerError}</div>}

              <div className="customer-creation-form">
                <div className="form-row">
                  <div className="form-field">
                    <label htmlFor="newTenantName">Tenant Name *</label>
                    <input
                      type="text"
                      id="newTenantName"
                      value={newCustomerData.tenantName}
                      onChange={(e) => setNewCustomerData(prev => ({ ...prev, tenantName: e.target.value }))}
                      placeholder="e.g., Contoso Ltd"
                      required
                      disabled={creatingCustomer}
                    />
                  </div>
                  
                  <div className="form-field">
                    <label htmlFor="newTenantDomain">Tenant Domain *</label>
                    <input
                      type="text"
                      id="newTenantDomain"
                      value={newCustomerData.tenantDomain}
                      onChange={(e) => setNewCustomerData(prev => ({ ...prev, tenantDomain: e.target.value }))}
                      placeholder="e.g., contoso.onmicrosoft.com"
                      required
                      disabled={creatingCustomer}
                    />
                  </div>
                  
                  <div className="form-field">
                    <label htmlFor="newTenantId">
                      Tenant ID (GUID) 
                      <span className="field-help"> - Optional, will be resolved from domain if not provided</span>
                    </label>
                    <input
                      type="text"
                      id="newTenantId"
                      value={newCustomerData.tenantId}
                      onChange={(e) => setNewCustomerData(prev => ({ ...prev, tenantId: e.target.value }))}
                      placeholder="e.g., 12345678-1234-1234-1234-123456789012"
                      disabled={creatingCustomer}
                    />
                  </div>
                </div>

                <div className="form-field">
                  <label htmlFor="newContactEmail">Contact Email</label>
                  <input
                    type="email"
                    id="newContactEmail"
                    value={newCustomerData.contactEmail}
                    onChange={(e) => setNewCustomerData(prev => ({ ...prev, contactEmail: e.target.value }))}
                    placeholder="admin@contoso.com"
                    disabled={creatingCustomer}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="newNotes">Notes</label>
                  <textarea
                    id="newNotes"
                    value={newCustomerData.notes}
                    onChange={(e) => setNewCustomerData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Optional notes about this customer..."
                    rows={3}
                    disabled={creatingCustomer}
                  />
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setShowNewCustomerForm(false);
                      setNewCustomerError(null);
                    }}
                    disabled={creatingCustomer}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="primary-button"
                    disabled={creatingCustomer || !newCustomerData.tenantName || !newCustomerData.tenantDomain}
                    onClick={handleCreateNewCustomer}
                  >
                    {creatingCustomer ? 'Creating Customer...' : 'Create Customer'}
                  </button>
                </div>
              </div>

              {/* Improved "What happens next?" section */}
              <div className="azure-app-info-improved">
                <div className="info-header">
                  <h4>What happens when you create a new customer?</h4>
                </div>
                
                <div className="info-grid">
                  <div className="info-step">
                    <div className="step-number">1</div>
                    <div className="step-content">
                      <h5>Customer Record</h5>
                      <p>We'll save the customer information in our system for future assessments and tracking</p>
                    </div>
                  </div>
                  
                  <div className="info-step">
                    <div className="step-number">2</div>
                    <div className="step-content">
                      <h5>App Registration Setup</h5>
                      <p>After creation, you'll need to create an Azure app registration for secure access to the tenant</p>
                    </div>
                  </div>
                  
                  <div className="info-step">
                    <div className="step-number">3</div>
                    <div className="step-content">
                      <h5>Permissions Configuration</h5>
                      <p>Configure the app with read-only security permissions required for comprehensive assessments</p>
                    </div>
                  </div>
                  
                  <div className="info-step">
                    <div className="step-number">4</div>
                    <div className="step-content">
                      <h5>Ready for Assessment</h5>
                      <p>Once setup is complete, you can run comprehensive security assessments for this customer</p>
                    </div>
                  </div>
                </div>
                
                <div className="info-note">
                  <strong>Note:</strong> App registration creation has been moved to the Customer Management section for better control and visibility.
                </div>
              </div>
            </div>
          )}

          {selectedCustomer && (
            <div className="customer-details">
              <div className="customer-detail-item">
                <span className="label">Tenant ID:</span>
                <span className="value">{selectedCustomer.tenantId}</span>
              </div>
              <div className="customer-detail-item">
                <span className="label">Domain:</span>
                <span className="value">{selectedCustomer.tenantDomain}</span>
              </div>
              <div className="customer-detail-item">
                <span className="label">Status:</span>
                <span className={`status ${selectedCustomer.status}`}>{selectedCustomer.status}</span>
              </div>
              <div className="customer-detail-item">
                <span className="label">Previous Assessments:</span>
                <span className="value">{selectedCustomer.totalAssessments}</span>
              </div>
            </div>
          )}
        </div>

        {/* Assessment Configuration Section */}
        {selectedCustomer && (
          <div className="form-section">
            <h2>Assessment Configuration</h2>
            
            <div className="form-field">
              <label htmlFor="assessmentName">Assessment Name</label>
              <input
                type="text"
                id="assessmentName"
                value={formData.assessmentName}
                onChange={(e) => setFormData(prev => ({ ...prev, assessmentName: e.target.value }))}
                disabled={loading}
                placeholder="Security Assessment"
              />
              <small className="field-help">
                The assessment name automatically includes today's date ({new Date().toLocaleDateString('de-DE')})
              </small>
            </div>

            <div className="form-field">
              <label>Security Categories to Include</label>
              <div className="categories-grid">
                {Object.entries(SECURITY_CATEGORIES).map(([key, categoryName]) => (
                  <div
                    key={key}
                    className={`category-checkbox ${formData.includedCategories.includes(key) ? 'selected' : ''}`}
                    onClick={() => handleCategoryToggle(key)}
                  >
                    <input
                      type="checkbox"
                      checked={formData.includedCategories.includes(key)}
                      onChange={() => handleCategoryToggle(key)}
                      disabled={loading}
                    />
                    <div className="category-info">
                      <div className="category-name">{categoryName}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="form-field">
              <label htmlFor="notificationEmail">Notification Email</label>
              <input
                type="email"
                id="notificationEmail"
                value={formData.notificationEmail}
                onChange={(e) => setFormData(prev => ({ ...prev, notificationEmail: e.target.value }))}
                disabled={loading}
                placeholder="admin@example.com"
              />
            </div>

            <div className="schedule-options">
              <div className="checkbox-field">
                <input
                  type="checkbox"
                  id="autoSchedule"
                  checked={formData.autoSchedule}
                  onChange={(e) => setFormData(prev => ({ ...prev, autoSchedule: e.target.checked }))}
                  disabled={loading}
                />
                <label htmlFor="autoSchedule">Enable automatic recurring assessments</label>
              </div>

              {formData.autoSchedule && (
                <div className="form-field">
                  <label htmlFor="scheduleFrequency">Frequency</label>
                  <select
                    id="scheduleFrequency"
                    value={formData.scheduleFrequency}
                    onChange={(e) => setFormData(prev => ({ ...prev, scheduleFrequency: e.target.value }))}
                    disabled={loading}
                  >
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                  </select>
                </div>
              )}
            </div>

            {/* Improved "What happens next?" for assessment */}
            <div className="assessment-next-steps">
              <div className="next-steps-header">
                <h4>What happens next?</h4>
              </div>
              
              <div className="steps-container">
                <div className="assessment-step">
                  <div className="step-text">
                    <strong>Verification:</strong> Verify the selected customer's Azure app registration is still valid
                  </div>
                </div>
                
                <div className="assessment-step">
                  <div className="step-text">
                    <strong>Connection:</strong> Connect using the existing app registration with read-only permissions
                  </div>
                </div>
                
                <div className="assessment-step">
                  <div className="step-text">
                    <strong>Analysis:</strong> Perform comprehensive security analysis across all selected categories
                  </div>
                </div>
                
                <div className="assessment-step">
                  <div className="step-text">
                    <strong>Notification:</strong> Send detailed results to the specified email address
                  </div>
                </div>
              </div>
            </div>

            <div className="form-actions">
              <button
                type="submit"
                className="primary-button submit-button"
                disabled={loading || !selectedCustomer}
              >
                {loading ? 'Starting Assessment...' : 'Start Security Assessment'}
              </button>
            </div>
          </div>
        )}

        {/* Customer Management Section */}
        <div className="form-section">
          <div className="section-header">
            <h2>Customer Management</h2>
            <button
              type="button"
              className="toggle-button"
              onClick={() => setShowCustomerManagement(!showCustomerManagement)}
            >
              {showCustomerManagement ? 'Hide' : 'Manage Customers'}
            </button>
          </div>
          
          {showCustomerManagement && (
            <div className="customer-management-section">
              {customerError && <div className="error-message">{customerError}</div>}
              
              {loadingCustomers ? (
                <div className="loading-message">
                  <span>Loading customers...</span>
                  <small>(First load may take up to 45 seconds due to API cold start)</small>
                </div>
              ) : (
                <div className="customer-list-management">
                  {customers.length === 0 ? (
                    <div className="no-customers-message">
                      <p>No customers found.</p>
                      <small>Create a new customer using the form above.</small>
                    </div>
                  ) : (
                    <>
                      <div className="customer-list-header">
                        <span>Customer ({customers.length})</span>
                        <span>Domain</span>
                        <span>App Registration</span>
                        <span>Assessments</span>
                        <span>Actions</span>
                      </div>
                      
                      <div className="customer-list-items">
                        {customers.map((customer) => {
                          const appRegStatus = getAppRegistrationStatus(customer);
                          return (
                            <div key={customer.id} className="customer-list-item">
                              <div className="customer-info">
                                <div className="customer-name">{customer.tenantName}</div>
                                <div className="customer-email">{customer.contactEmail}</div>
                              </div>
                              <div className="customer-domain">{customer.tenantDomain}</div>
                              <div className="customer-app-registration">
                                <span 
                                  className={`app-status app-status-${appRegStatus.color}`}
                                  title={appRegStatus.status}
                                >
                                  {appRegStatus.status}
                                </span>
                                {appRegStatus.action && (
                                  <button
                                    type="button"
                                    className="app-registration-button"
                                    onClick={() => handleCreateAppRegistration(customer)}
                                    disabled={creatingAppRegistration === customer.id}
                                    title={appRegStatus.action}
                                  >
                                    {creatingAppRegistration === customer.id ? (
                                      <>
                                        <div className="button-spinner"></div>
                                        Creating...
                                      </>
                                    ) : (
                                      <>
                                        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                                          <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                                        </svg>
                                        {appRegStatus.action}
                                      </>
                                    )}
                                  </button>
                                )}
                              </div>
                              <div className="customer-assessments">{customer.totalAssessments || 0}</div>
                              <div className="customer-actions">
                                <button
                                  type="button"
                                  className="delete-button"
                                  onClick={() => handleDeleteCustomer(customer)}
                                  disabled={deletingCustomer}
                                  title="Delete customer"
                                >
                                  <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                  {deletingCustomer ? 'Deleting...' : 'Delete'}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </form>

      {/* Delete Confirmation Modal */}
      {customerToDelete && (
        <div className="modal-overlay" onClick={() => setCustomerToDelete(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete Customer</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setCustomerToDelete(null)}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            
            <div className="modal-body">
              <p>Are you sure you want to delete the customer <strong>{customerToDelete.tenantName}</strong>?</p>
              <p className="warning-text">
                ⚠️ This action cannot be undone. All assessment data for this customer will be preserved,
                but you won't be able to run new assessments until you recreate the customer.
              </p>
              
              <div className="customer-delete-details">
                <div><strong>Tenant:</strong> {customerToDelete.tenantDomain}</div>
                <div><strong>Contact:</strong> {customerToDelete.contactEmail || 'Not specified'}</div>
                <div><strong>Assessments:</strong> {customerToDelete.totalAssessments || 0}</div>
              </div>
            </div>
            
            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setCustomerToDelete(null)}
                disabled={deletingCustomer}
              >
                Cancel
              </button>
              <button
                type="button"
                className="danger-button"
                onClick={confirmDeleteCustomer}
                disabled={deletingCustomer}
              >
                {deletingCustomer ? 'Deleting...' : 'Delete Customer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
