// filepath: /m365-assessment-framework/m365-assessment-framework/src/pages/Settings.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { AssessmentService } from '../services/assessmentService';
import { Customer } from '../services/customerService';
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
          
          <CustomerSelector
            selectedCustomer={selectedCustomer}
            onCustomerSelect={handleCustomerSelect}
            onCustomerCreate={handleCustomerCreate}
            placeholder="Choose a customer to assess..."
            disabled={loading}
          />

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