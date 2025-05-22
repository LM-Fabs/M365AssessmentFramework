import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useAssessment } from '../hooks/useAssessment';
import SecurityScoreCard from '../components/SecurityScoreCard';
import MetricsDisplay from '../components/MetricsDisplay';
import ComparisonView from '../components/ComparisonView';
import RecommendationsList from '../components/RecommendationsList';
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

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1 className="dashboard-title">Security Assessment Dashboard</h1>
        <div className="tenant-info">
          <span>Last Updated: {new Date(assessment.lastModified).toLocaleDateString()}</span>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="score-section">
          <Card 
            title="Overall Security Score" 
            description="Summary of your Microsoft 365 security posture"
            className="score-card card-primary"
          >
            <SecurityScoreCard 
              assessment={assessment}
              tenant={{ id: assessment.tenantId, name: assessment.tenantId }}
              onCategoryClick={handleCategoryClick}
            />
          </Card>
        </div>

        <div className="metrics-section">
          <Card 
            title="Security Metrics" 
            description="Key security metrics across categories"
            className="metrics-card"
          >
            <MetricsDisplay 
              assessment={assessment}
            />
          </Card>
        </div>

        <div className="recommendations-section">
          <Card 
            title="Recommendations" 
            description={selectedCategory ? `Recommendations for ${selectedCategory}` : "Top recommendations to improve security"}
            className="recommendations-card card-secondary"
          >
            <RecommendationsList 
              assessment={assessment}
              selectedCategory={selectedCategory || undefined}
            />
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;