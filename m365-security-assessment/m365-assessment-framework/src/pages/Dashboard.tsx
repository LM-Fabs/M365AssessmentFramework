import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useAssessment } from '../hooks/useAssessment';
import SecurityScoreCard from '../components/SecurityScoreCard';
import TopRecommendations from '../components/TopRecommendations';
import CriticalSecurityRisks from '../components/CriticalSecurityRisks';
import RecentAssessments from '../components/RecentAssessments';
import { Card } from '../components/ui/Card';
import { Metrics } from '../models/Metrics';
import './Dashboard.css';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { assessment, loading, error } = useAssessment();
  const [selectedCategory, setSelectedCategory] = useState<keyof Metrics | undefined>();

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

  if (!assessment) {
    return (
      <div className="dashboard">
        <Card
          title="No Active Assessment"
          description="Start a new assessment to view security metrics and recommendations."
          footer={
            <button 
              className="lm-button" 
              onClick={() => navigate('/settings')}
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
    id: assessment.tenantId,
    name: assessment.tenantId,
    securityScore: assessment.metrics.score?.overall || 0,
    metrics: assessment.metrics || {},
    lastAssessmentDate: new Date(assessment.lastModified),
    recommendations: assessment.recommendations?.map(rec => rec.id) || []
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1 className="dashboard-title">Dashboard</h1>
        <div className="dashboard-actions">
          <button className="lm-button secondary">Compare with previous</button>
          <button className="lm-button primary">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="16"></line>
              <line x1="8" y1="12" x2="16" y2="12"></line>
            </svg>
            New Assessment
          </button>
        </div>
      </div>

      <div className="last-assessment-info">
        Last assessment: {new Date(assessment.lastModified).toLocaleDateString()} 
      </div>

      <div className="dashboard-grid">
        <div className="security-score-section">
          <SecurityScoreCard 
            assessment={assessment}
            tenant={tenant}
            onCategoryClick={handleCategoryClick}
          />
        </div>

        <div className="dashboard-columns">
          <div className="dashboard-column">
            <TopRecommendations assessment={assessment} />
            {/* Add Recent Assessments section */}
            <RecentAssessments 
              tenantId={assessment.tenantId} 
              limit={5} 
            />
          </div>

          <div className="dashboard-column">
            <CriticalSecurityRisks assessment={assessment} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;