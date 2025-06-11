import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useAssessment } from '../hooks/useAssessment';
import { CustomerService, Customer } from '../services/customerService';
import CustomerSelector from '../components/ui/CustomerSelector';
import SecurityScoreCard from '../components/SecurityScoreCard';
import TopRecommendations from '../components/TopRecommendations';
import CriticalSecurityRisks from '../components/CriticalSecurityRisks';
import RecentAssessments from '../components/RecentAssessments';
import { Card } from '../components/ui/Card';
import { Metrics } from '../models/Metrics';
import { Assessment } from '../models/Assessment';
import './Dashboard.css';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { assessment, loading, error } = useAssessment();
  const [selectedCategory, setSelectedCategory] = useState<keyof Metrics | undefined>();
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [filteredAssessments, setFilteredAssessments] = useState<Assessment[]>([]);
  const [customerAssessments, setCustomerAssessments] = useState<Assessment[]>([]);
  
  const customerService = CustomerService.getInstance();

  // Load customer assessments when customer is selected
  useEffect(() => {
    const loadCustomerAssessments = async () => {
      if (selectedCustomer) {
        try {
          const assessments = await customerService.getCustomerAssessments(selectedCustomer.id);
          setCustomerAssessments(assessments);
          setFilteredAssessments(assessments);
        } catch (error) {
          console.error('Failed to load customer assessments:', error);
          setCustomerAssessments([]);
          setFilteredAssessments([]);
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
  };

  const handleNewAssessment = () => {
    navigate('/settings');
  };

  const handleCompareAssessments = () => {
    if (filteredAssessments.length >= 2) {
      navigate('/compare', { 
        state: { 
          assessments: filteredAssessments.slice(0, 2),
          customer: selectedCustomer 
        } 
      });
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="dashboard">
        <Card 
          title="Authentication Required"
          className="authentication-card"
        >
          <p className="card-message">Please log in to view the dashboard.</p>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="dashboard">
        <Card className="loading-card">
          <div className="loading-indicator">
            <div className="spinner"></div>
            <span>Loading dashboard...</span>
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard">
        <Card 
          title="Error" 
          className="error-card"
        >
          <div className="error-message">{error}</div>
        </Card>
      </div>
    );
  }

  const currentAssessment = selectedCustomer && filteredAssessments.length > 0 
    ? filteredAssessments[0] // Most recent assessment for selected customer
    : assessment; // Default assessment if no customer selected

  if (!currentAssessment) {
    return (
      <div className="dashboard">
        <div className="dashboard-header">
          <h1 className="dashboard-title">Dashboard</h1>
          <div className="dashboard-actions">
            <button 
              className="lm-button primary"
              onClick={handleNewAssessment}
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

        <div className="dashboard-filters">
          <CustomerSelector
            selectedCustomer={selectedCustomer}
            onCustomerSelect={handleCustomerSelect}
            placeholder="Filter by customer..."
            showCreateNew={false}
          />
        </div>

        <Card
          title="No Assessment Data"
          description={selectedCustomer 
            ? `No assessments found for ${selectedCustomer.tenantName}. Start a new assessment to view security metrics.`
            : "Start a new assessment to view security metrics and recommendations."
          }
          footer={
            <button 
              className="lm-button" 
              onClick={handleNewAssessment}
            >
              Create New Assessment
            </button>
          }
          className="no-assessment-card"
        >
          <div className="empty-state">
            <svg xmlns="http://www.w3.org/2000/svg" className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            <p>No assessment data available</p>
          </div>
        </Card>
      </div>
    );
  }

  const handleCategoryClick = (category: string) => {
    setSelectedCategory(category as keyof Metrics);
  };

  // Create a tenant object with all required properties from the assessment
  const tenant = {
    id: currentAssessment.tenantId,
    name: selectedCustomer?.tenantName || currentAssessment.tenantId,
    securityScore: currentAssessment.metrics.score?.overall || 0,
    metrics: currentAssessment.metrics || {},
    lastAssessmentDate: new Date(currentAssessment.lastModified),
    recommendations: currentAssessment.recommendations?.map(rec => rec.id) || []
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1 className="dashboard-title">Dashboard</h1>
        <div className="dashboard-actions">
          <button 
            className="lm-button secondary"
            onClick={handleCompareAssessments}
            disabled={filteredAssessments.length < 2}
            title={filteredAssessments.length < 2 ? "Need at least 2 assessments to compare" : "Compare assessments"}
          >
            Compare Assessments
          </button>
          <button 
            className="lm-button primary"
            onClick={handleNewAssessment}
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

      <div className="dashboard-filters">
        <CustomerSelector
          selectedCustomer={selectedCustomer}
          onCustomerSelect={handleCustomerSelect}
          placeholder="Filter by customer..."
          showCreateNew={false}
        />
        
        {selectedCustomer && (
          <div className="filter-info">
            <span className="filter-label">Showing assessments for:</span>
            <span className="filter-value">{selectedCustomer.tenantName}</span>
            <span className="assessment-count">({filteredAssessments.length} assessments)</span>
          </div>
        )}
      </div>

      <div className="last-assessment-info">
        Last assessment: {new Date(currentAssessment.lastModified).toLocaleDateString()}
        {selectedCustomer && (
          <span className="tenant-info"> • {selectedCustomer.tenantDomain}</span>
        )}
      </div>

      <div className="dashboard-grid">
        <div className="security-score-section">
          <SecurityScoreCard 
            assessment={currentAssessment}
            tenant={tenant}
            onCategoryClick={handleCategoryClick}
          />
        </div>

        <div className="dashboard-columns">
          <div className="dashboard-column">
            <TopRecommendations assessment={currentAssessment} />
            <RecentAssessments 
              tenantId={currentAssessment.tenantId} 
              limit={5}
              customerId={selectedCustomer?.id}
            />
          </div>

          <div className="dashboard-column">
            <CriticalSecurityRisks assessment={currentAssessment} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;