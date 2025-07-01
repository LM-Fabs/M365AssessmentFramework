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

  const handleManualEntry = () => {
    if (manualTenantId.trim()) {
      const mockCustomer: Customer = {
        id: `manual-${Date.now()}`,
        tenantId: manualTenantId.trim(),
        tenantName: manualTenantDomain || `Tenant ${manualTenantId}`,
        tenantDomain: manualTenantDomain || '',
        applicationId: '',
        clientId: '',
        servicePrincipalId: '',
        createdDate: new Date(),
        totalAssessments: 0,
        status: 'active',
        permissions: []
      };
      setSelectedCustomer(mockCustomer);
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
              <h3>Manual Entry</h3>
              <p>For testing or one-time assessments, enter tenant details manually:</p>
              
              <div className="manual-form">
                <div className="form-group">
                  <label htmlFor="tenantId">Tenant ID *</label>
                  <input
                    type="text"
                    id="tenantId"
                    value={manualTenantId}
                    onChange={(e) => setManualTenantId(e.target.value)}
                    placeholder="e.g. contoso.onmicrosoft.com or GUID"
                    className="form-input"
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="tenantDomain">Tenant Domain (optional)</label>
                  <input
                    type="text"
                    id="tenantDomain"
                    value={manualTenantDomain}
                    onChange={(e) => setManualTenantDomain(e.target.value)}
                    placeholder="e.g. contoso.com"
                    className="form-input"
                  />
                </div>

                <button
                  className="btn-primary"
                  onClick={handleManualEntry}
                  disabled={!manualTenantId.trim()}
                >
                  Start Assessment
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
