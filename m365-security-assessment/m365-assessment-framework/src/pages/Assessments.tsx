import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { CustomerService, Customer } from '../services/customerService';
import CustomerSelector from '../components/ui/CustomerSelector';
import RecentAssessments from '../components/RecentAssessments';
import BasicAssessment from '../components/assessment/BasicAssessment';
import { Card } from '../components/ui/Card';
import { Assessment } from '../models/Assessment';
import './Assessments.css';

const Assessments: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerAssessments, setCustomerAssessments] = useState<Assessment[]>([]);
  const [filteredAssessments, setFilteredAssessments] = useState<Assessment[]>([]);
  const [showNewAssessment, setShowNewAssessment] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const customerService = CustomerService.getInstance();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
  }, [isAuthenticated, navigate]);

  // Load customer assessments when customer is selected
  useEffect(() => {
    const loadCustomerAssessments = async () => {
      if (selectedCustomer) {
        setLoading(true);
        try {
          const assessments = await customerService.getCustomerAssessments(selectedCustomer.id);
          setCustomerAssessments(assessments);
          setFilteredAssessments(assessments);
        } catch (error) {
          console.error('Failed to load customer assessments:', error);
          setError('Failed to load assessments for this customer.');
          setCustomerAssessments([]);
          setFilteredAssessments([]);
        } finally {
          setLoading(false);
        }
      } else {
        setCustomerAssessments([]);
        setFilteredAssessments([]);
      }
    };

    loadCustomerAssessments();
  }, [selectedCustomer]);

  const handleCustomerSelect = (customer: Customer | null) => {
    setSelectedCustomer(customer);
    setError(null);
  };

  const handleNewAssessment = () => {
    setShowNewAssessment(true);
  };

  const handleAssessmentComplete = () => {
    setShowNewAssessment(false);
    // Reload assessments for the selected customer
    if (selectedCustomer) {
      const loadAssessments = async () => {
        try {
          const assessments = await customerService.getCustomerAssessments(selectedCustomer.id);
          setCustomerAssessments(assessments);
          setFilteredAssessments(assessments);
        } catch (error) {
          console.error('Failed to reload assessments:', error);
        }
      };
      loadAssessments();
    }
  };

  const handleAssessmentCancel = () => {
    setShowNewAssessment(false);
  };

  if (showNewAssessment) {
    return (
      <div className="assessments-page">
        <div className="assessment-header">
          <button 
            className="lm-button secondary"
            onClick={handleAssessmentCancel}
          >
            ← Back to Assessments
          </button>
        </div>
        <BasicAssessment 
          customerId={selectedCustomer?.id}
          tenantId={selectedCustomer?.tenantId || ''}
          tenantDomain={selectedCustomer?.tenantDomain}
          onAssessmentComplete={handleAssessmentComplete}
        />
      </div>
    );
  }

  return (
    <div className="assessments-page">
      <div className="assessments-header">
        <h1 className="assessments-title">Security Assessments</h1>
        <p className="assessments-subtitle">
          Create, manage, and view security assessments for your Microsoft 365 tenants.
        </p>
        <div className="assessments-actions">
          <button 
            className="lm-button primary"
            onClick={handleNewAssessment}
            disabled={!selectedCustomer}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="16"></line>
              <line x1="8" y1="12" x2="16" y2="12"></line>
            </svg>
            New Assessment
          </button>
        </div>
      </div>

      <div className="assessments-filters">
        <CustomerSelector
          selectedCustomer={selectedCustomer}
          onCustomerSelect={handleCustomerSelect}
          placeholder="Select a customer to view assessments..."
          showCreateNew={true}
        />
        
        {selectedCustomer && (
          <div className="filter-info">
            <span className="filter-label">Customer:</span>
            <span className="filter-value">{selectedCustomer.tenantName}</span>
            <span className="assessment-count">({filteredAssessments.length} assessments)</span>
          </div>
        )}
      </div>

      {error && (
        <Card
          title="Error"
          className="error-card"
        >
          <div className="error-message">{error}</div>
        </Card>
      )}

      {loading && (
        <div className="loading-container">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span>Loading assessments...</span>
        </div>
      )}

      {!selectedCustomer && !loading && (
        <Card
          title="Select a Customer"
          description="Choose a customer from the dropdown above to view their security assessments, or create a new customer if this is your first time."
        >
          <p className="text-sm text-gray-600">
            Need help getting started? Check out our <a href="/best-practices" className="text-blue-600 hover:underline">best practices guide</a>.
          </p>
        </Card>
      )}

      {selectedCustomer && !loading && filteredAssessments.length === 0 && (
        <Card
          title="No Assessments Found"
          description={`No security assessments found for ${selectedCustomer.tenantName}. Create your first assessment to get started with security analysis.`}
        >
          <button 
            className="lm-button primary" 
            onClick={handleNewAssessment}
          >
            Create First Assessment
          </button>
        </Card>
      )}

      {selectedCustomer && !loading && filteredAssessments.length > 0 && (
        <div className="assessments-content">
          <div className="assessments-section">
            <h2 className="section-title">Assessment History</h2>
            <p className="section-description">
              View and manage all security assessments for {selectedCustomer.tenantName}.
            </p>
            <RecentAssessments 
              tenantId={selectedCustomer.tenantId} 
              customerId={selectedCustomer.id}
              limit={20}
            />
          </div>

          <div className="assessments-stats">
            <div className="stats-grid">
              <div className="stat-card">
                <h3>Total Assessments</h3>
                <p className="stat-number">{filteredAssessments.length}</p>
              </div>
              <div className="stat-card">
                <h3>Latest Assessment</h3>
                <p className="stat-date">
                  {filteredAssessments.length > 0 
                    ? new Date(filteredAssessments[0].lastModified).toLocaleDateString()
                    : 'N/A'
                  }
                </p>
              </div>
              <div className="stat-card">
                <h3>Tenant Domain</h3>
                <p className="stat-text">{selectedCustomer.tenantDomain}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Assessments;
