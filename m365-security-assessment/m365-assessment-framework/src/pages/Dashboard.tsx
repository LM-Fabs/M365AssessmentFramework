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
          <span>Last Updated: {new Date(assessment.lastModified).toLocaleDateString()}</span>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="score-section">
          <SecurityScoreCard 
            assessment={assessment}
            tenant={{ id: assessment.tenantId, name: assessment.tenantId }}
            onCategoryClick={handleCategoryClick}
          />
        </div>

        <div className="metrics-section">
          <MetricsDisplay 
            assessment={assessment}
          />
        </div>

        <div className="recommendations-section">
          <RecommendationsList 
            assessment={assessment}
            selectedCategory={selectedCategory || undefined}
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
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .dashboard-header h1 {
          margin: 0;
          color: #333;
        }

        .tenant-info {
          color: #666;
          font-size: 14px;
        }

        .dashboard-grid {
          display: grid;
          gap: 24px;
          grid-template-columns: 1fr;
        }

        .no-assessment {
          text-align: center;
          padding: 48px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .no-assessment h2 {
          margin: 0 0 16px;
          color: #333;
        }

        .no-assessment p {
          margin: 0 0 24px;
          color: #666;
        }

        .no-assessment button {
          padding: 12px 24px;
          background: #0078d4;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 16px;
          font-weight: 500;
          transition: background 0.2s;
        }

        .no-assessment button:hover {
          background: #006abc;
        }

        .error-message {
          color: #d83b01;
          padding: 10px;
          background: #fed9cc;
          border-radius: 4px;
        }

        @media (min-width: 768px) {
          .dashboard-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .score-section {
            grid-column: 1 / -1;
          }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;