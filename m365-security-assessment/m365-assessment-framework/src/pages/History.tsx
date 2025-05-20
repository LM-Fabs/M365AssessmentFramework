// filepath: /m365-assessment-framework/m365-assessment-framework/src/pages/History.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { AssessmentService } from '../services/assessmentService';
import { Assessment } from '../models/Assessment';
import ComparisonView from '../components/ComparisonView';

const History: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAssessments, setSelectedAssessments] = useState<string[]>([]);

  const assessmentService = AssessmentService.getInstance();

  useEffect(() => {
    const fetchAssessments = async () => {
      try {
        const response = await assessmentService.getAssessments();
        setAssessments(response);
      } catch (error: any) {
        setError(error.message || 'Failed to load assessment history');
      } finally {
        setLoading(false);
      }
    };

    if (isAuthenticated) {
      fetchAssessments();
    }
  }, [isAuthenticated]);

  const handleAssessmentSelect = (assessmentId: string) => {
    setSelectedAssessments(prev => {
      if (prev.includes(assessmentId)) {
        return prev.filter(id => id !== assessmentId);
      }
      if (prev.length < 2) {
        return [...prev, assessmentId];
      }
      return [prev[1], assessmentId];
    });
  };

  if (!isAuthenticated) {
    return (
      <div className="authentication-prompt">
        <h2>Authentication Required</h2>
        <p>Please log in to view assessment history.</p>
      </div>
    );
  }

  if (loading) {
    return <div>Loading assessment history...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  return (
    <div className="history-page">
      <div className="history-header">
        <h1>Assessment History</h1>
        <button onClick={() => navigate('/settings')}>New Assessment</button>
      </div>

      <div className="history-grid">
        <div className="assessments-list">
          <h2>Past Assessments</h2>
          {assessments.map(assessment => (
            <div 
              key={assessment.id}
              className={`assessment-card ${selectedAssessments.includes(assessment.id) ? 'selected' : ''}`}
              onClick={() => handleAssessmentSelect(assessment.id)}
            >
              <div className="assessment-header">
                <h3>Assessment {assessment.id.slice(0, 8)}</h3>
                <span className={`status-badge status-${assessment.status}`}>
                  {assessment.status}
                </span>
              </div>
              
              <div className="assessment-info">
                <div className="info-row">
                  <span className="label">Tenant:</span>
                  <span className="value">{assessment.tenantId}</span>
                </div>
                <div className="info-row">
                  <span className="label">Date:</span>
                  <span className="value">
                    {assessment.assessmentDate.toLocaleDateString()}
                  </span>
                </div>
                <div className="info-row">
                  <span className="label">Score:</span>
                  <span className="value">{assessment.metrics.score.overall}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {selectedAssessments.length === 2 && (
          <div className="comparison-view">
            <h2>Assessment Comparison</h2>
            <ComparisonView
              assessment={assessments.find(a => a.id === selectedAssessments[0])!}
              previousAssessmentId={selectedAssessments[1]}
            />
          </div>
        )}
      </div>

      <style>{`
        .history-page {
          padding: 24px;
          max-width: 1400px;
          margin: 0 auto;
        }

        .history-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .history-grid {
          display: grid;
          gap: 24px;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        }

        .assessments-list {
          background: white;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .assessment-card {
          background: #f8f8f8;
          border-radius: 6px;
          padding: 16px;
          margin-bottom: 16px;
          cursor: pointer;
          transition: transform 0.2s ease;
        }

        .assessment-card:hover {
          transform: translateY(-2px);
        }

        .assessment-card.selected {
          border: 2px solid #0078d4;
          background: #f0f7ff;
        }

        .assessment-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .status-badge {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
        }

        .status-draft {
          background: #fff4ce;
          color: #9d5d00;
        }

        .status-completed {
          background: #dff6dd;
          color: #107c10;
        }

        .status-archived {
          background: #f3f2f1;
          color: #666666;
        }

        .assessment-info {
          font-size: 14px;
        }

        .info-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 4px;
        }

        .label {
          color: #666;
        }

        .value {
          font-weight: 500;
          color: #333;
        }

        .comparison-view {
          background: white;
          border-radius: 8px;
          padding: 20px;
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
        }

        .error-message {
          color: #d83b01;
          padding: 16px;
          background: #fed9cc;
          border-radius: 8px;
          margin-bottom: 16px;
        }

        .authentication-prompt {
          text-align: center;
          padding: 48px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
      `}</style>
    </div>
  );
};

export default History;