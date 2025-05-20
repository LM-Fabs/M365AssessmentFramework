import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useAssessment } from '../hooks/useAssessment';
import SecurityScoreCard from '../components/SecurityScoreCard';
import MetricsDisplay from '../components/MetricsDisplay';
import ComparisonView from '../components/ComparisonView';
import RecommendationsList from '../components/RecommendationsList';
import { Metrics } from '../models/Metrics';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { assessment, loading, error } = useAssessment();
  const [selectedCategory, setSelectedCategory] = useState<keyof Metrics | undefined>();

  if (!isAuthenticated) {
    return (
      <div className="authentication-prompt">
        <h2>Authentication Required</h2>
        <p>Please log in to view the dashboard.</p>
      </div>
    );
  }

  if (loading) {
    return <div>Loading dashboard...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  if (!assessment) {
    return (
      <div className="no-assessment">
        <h2>No Active Assessment</h2>
        <p>Start a new assessment to view security metrics and recommendations.</p>
        <button onClick={() => navigate('/settings')}>
          Create New Assessment
        </button>
      </div>
    );
  }

  const handleCategoryClick = (category: string) => {
    setSelectedCategory(category as keyof Metrics);
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Security Assessment Dashboard</h1>
        <div className="tenant-info">
          <span>Tenant ID: {assessment.tenantId}</span>
          <span>Last Updated: {assessment.lastModified.toLocaleDateString()}</span>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="score-section">
          <SecurityScoreCard 
            assessment={assessment}
            onCategoryClick={handleCategoryClick}
          />
        </div>

        <div className="metrics-section">
          <h2>Security Metrics {selectedCategory ? `- ${selectedCategory}` : ''}</h2>
          <MetricsDisplay 
            assessment={assessment}
            selectedCategory={selectedCategory}
          />
        </div>

        <div className="comparison-section">
          <h2>Comparison with Best Practices</h2>
          <ComparisonView 
            assessment={assessment}
            compareToBestPractices
          />
        </div>

        <div className="recommendations-section">
          <h2>Security Recommendations</h2>
          <RecommendationsList 
            assessment={assessment}
            onRecommendationClick={(recommendation) => {
              // Handle recommendation click, e.g., show details modal
              console.log('Recommendation clicked:', recommendation);
            }}
          />
        </div>
      </div>

      <style>{`
        .dashboard {
          padding: 24px;
          max-width: 1400px;
          margin: 0 auto;
        }

        .dashboard-header {
          margin-bottom: 24px;
        }

        .tenant-info {
          display: flex;
          gap: 16px;
          color: #666;
          font-size: 14px;
        }

        .dashboard-grid {
          display: grid;
          gap: 24px;
          grid-template-columns: repeat(2, 1fr);
          grid-template-areas:
            "score metrics"
            "comparison comparison"
            "recommendations recommendations";
        }

        .score-section {
          grid-area: score;
        }

        .metrics-section {
          grid-area: metrics;
        }

        .comparison-section {
          grid-area: comparison;
        }

        .recommendations-section {
          grid-area: recommendations;
        }

        h1 {
          margin: 0 0 16px;
          color: #333;
        }

        h2 {
          margin: 0 0 16px;
          color: #333;
        }

        .error-message {
          color: #d83b01;
          padding: 16px;
          background: #fed9cc;
          border-radius: 8px;
          margin-bottom: 16px;
        }

        .authentication-prompt,
        .no-assessment {
          text-align: center;
          padding: 48px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        button {
          background: #0078d4;
          color: white;
          padding: 10px 20px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 16px;
          margin-top: 16px;
        }

        @media (max-width: 1200px) {
          .dashboard-grid {
            grid-template-columns: 1fr;
            grid-template-areas:
              "score"
              "metrics"
              "comparison"
              "recommendations";
          }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;