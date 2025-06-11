// filepath: /m365-assessment-framework/m365-assessment-framework/src/pages/Settings.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { AssessmentService } from '../services/assessmentService';
import { Customer, CustomerService } from '../services/customerService';
import CustomerSelector from '../components/ui/CustomerSelector';
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
    contactEmail: '',
    notes: ''
  });
  const [newCustomerError, setNewCustomerError] = useState<string | null>(null);
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  
  const [formData, setFormData] = useState({
    assessmentName: 'Security Assessment',
    includedCategories: Object.keys(SECURITY_CATEGORIES),
    notificationEmail: user?.email || '',
    autoSchedule: false,
    scheduleFrequency: 'monthly'
  });

  const handleCustomerSelect = (customer: Customer | null) => {
    setSelectedCustomer(customer);
    setError(null);
    
    // Update assessment name with customer name if selected
    if (customer) {
      setFormData(prev => ({
        ...prev,
        assessmentName: `Security Assessment - ${customer.tenantName}`
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        assessmentName: 'Security Assessment'
      }));
    }
  };

  const handleCustomerCreate = (customer: Customer) => {
    console.log('New customer created:', customer);
    // Customer is automatically selected by the CustomerSelector
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
    
    if (!newCustomerData.tenantName || !newCustomerData.tenantDomain) {
      setNewCustomerError('Tenant Name and Domain are required');
      return;
    }

    setCreatingCustomer(true);
    setNewCustomerError(null);

    try {
      // Use the CustomerService to properly create the customer with Azure app registration
      const customerService = CustomerService.getInstance();
      const newCustomer = await customerService.createCustomer({
        tenantName: newCustomerData.tenantName,
        tenantDomain: newCustomerData.tenantDomain,
        contactEmail: newCustomerData.contactEmail,
        notes: newCustomerData.notes
      });

      console.log('Successfully created new customer:', newCustomer);

      // Auto-select the new customer and reset the form
      setSelectedCustomer(newCustomer);
      setNewCustomerData({
        tenantName: '',
        tenantDomain: '',
        contactEmail: '',
        notes: ''
      });
      setShowNewCustomerForm(false);
      
      // Update the assessment name with the new customer
      setFormData(prev => ({
        ...prev,
        assessmentName: `Security Assessment - ${newCustomer.tenantName}`
      }));

      // Show success message but don't redirect immediately since user might want to configure assessment
      setError(null);
      setSuccess(false); // Don't show success message that redirects
      
    } catch (error: any) {
      setNewCustomerError(error.message || 'Failed to create new customer');
    } finally {
      setCreatingCustomer(false);
    }
  };

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

        <div className="form-section">
          <h2>Customer Selection</h2>
          <p>Select an existing customer with configured Azure app registration, or add a new customer.</p>
          
          <div className="customer-selection-container">
            <CustomerSelector
              selectedCustomer={selectedCustomer}
              onCustomerSelect={handleCustomerSelect}
              onCustomerCreate={handleCustomerCreate}
              placeholder="Choose a customer to assess..."
              disabled={loading}
            />
            
            <div className="customer-actions">
              <button
                type="button"
                className="add-customer-button"
                onClick={() => setShowNewCustomerForm(true)}
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

              <form onSubmit={handleCreateNewCustomer}>
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
                    type="submit"
                    className="primary-button"
                    disabled={creatingCustomer || !newCustomerData.tenantName || !newCustomerData.tenantDomain}
                  >
                    {creatingCustomer ? 'Creating Customer...' : 'Create Customer & Setup Azure App'}
                  </button>
                </div>
              </form>

              <div className="azure-app-info">
                <h4>🔧 What happens when you create a new customer?</h4>
                <ol>
                  <li><strong>Customer Record:</strong> We'll save the customer information in our system</li>
                  <li><strong>Azure App Registration:</strong> An Azure app registration will be created for secure access</li>
                  <li><strong>Permissions Setup:</strong> The app will be configured with read-only security permissions</li>
                  <li><strong>Ready for Assessment:</strong> Once created, you can immediately run security assessments</li>
                </ol>
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

        <div className="form-section">
          <h2>Assessment Configuration</h2>
          
          <div className="form-field">
            <label htmlFor="assessmentName">Assessment Name</label>
            <input
              type="text"
              id="assessmentName"
              value={formData.assessmentName}
              onChange={e => setFormData({...formData, assessmentName: e.target.value})}
              placeholder="Enter a name for this assessment"
              required
              disabled={loading}
            />
            <small>This will be used to identify the assessment in your dashboard</small>
          </div>

          <div className="assessment-info">
            <h3>🚀 What happens next?</h3>
            <div className="process-steps">
              <div className="step">
                <div className="step-number">1</div>
                <div className="step-content">
                  <strong>Customer Verification</strong>
                  <p>Verify the selected customer's Azure app registration is still valid</p>
                </div>
              </div>
              <div className="step">
                <div className="step-number">2</div>
                <div className="step-content">
                  <strong>Secure Connection</strong>
                  <p>Connect using the existing app registration with read-only permissions</p>
                </div>
              </div>
              <div className="step">
                <div className="step-number">3</div>
                <div className="step-content">
                  <strong>Data Collection</strong>
                  <p>Gather security data from the selected Microsoft 365 tenant</p>
                </div>
              </div>
              <div className="step">
                <div className="step-number">4</div>
                <div className="step-content">
                  <strong>Analysis & Report</strong>
                  <p>Generate detailed security insights and actionable recommendations</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="form-section">
          <h2>Assessment Scope</h2>
          <p>Select security categories to include in the assessment</p>
          <div className="categories-grid">
            {Object.entries(SECURITY_CATEGORIES).map(([key, label]) => (
              <label key={key} className={`category-checkbox ${formData.includedCategories.includes(key) ? 'selected' : ''}`}>
                <input
                  type="checkbox"
                  checked={formData.includedCategories.includes(key)}
                  onChange={() => handleCategoryToggle(key)}
                  disabled={loading}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="form-section">
          <h2>Notifications</h2>
          <div className="form-field">
            <label htmlFor="notificationEmail">Notification Email</label>
            <input
              type="email"
              id="notificationEmail"
              value={formData.notificationEmail}
              onChange={e => setFormData({...formData, notificationEmail: e.target.value})}
              required
              disabled={loading}
            />
          </div>
        </div>

        <div className="form-section">
          <h2>Schedule</h2>
          <div className="schedule-options">
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={formData.autoSchedule}
                onChange={e => setFormData({...formData, autoSchedule: e.target.checked})}
                disabled={loading}
              />
              <span>Schedule Recurring Assessments</span>
            </label>

            {formData.autoSchedule && (
              <div className="form-field">
                <label htmlFor="scheduleFrequency">Frequency</label>
                <select
                  id="scheduleFrequency"
                  value={formData.scheduleFrequency}
                  onChange={e => setFormData({...formData, scheduleFrequency: e.target.value})}
                  disabled={loading}
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="form-actions">
          <button 
            type="submit" 
            className="primary-button" 
            disabled={loading || !selectedCustomer}
          >
            {loading ? 'Starting Assessment...' : 'Start Security Assessment'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default Settings;