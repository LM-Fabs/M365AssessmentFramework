import React, { useState, useEffect } from 'react';
import { AssessmentHistoryService } from '../services/assessmentHistoryService';
import './RecentAssessments.css';

interface RecentAssessmentsProps {
  tenantId: string;
  limit?: number;
}

interface AssessmentHistory {
  assessmentId: string;
  tenantId: string;
  date: Date;
  overallScore: number;
  categoryScores: {
    identity: number;
    dataProtection: number;
    endpoint: number;
    cloudApps: number;
  };
}

const RecentAssessments: React.FC<RecentAssessmentsProps> = ({ tenantId, limit = 5 }) => {
  const [assessments, setAssessments] = useState<AssessmentHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const historyService = AssessmentHistoryService.getInstance();

  useEffect(() => {
    const loadRecentAssessments = async () => {
      if (!tenantId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const recentAssessments = await historyService.getRecentAssessments(tenantId, limit);
        setAssessments(recentAssessments);
      } catch (err: any) {
        console.error('Error loading recent assessments:', err);
        setError('Failed to load recent assessments');
        setAssessments([]); // Show empty state instead of error
      } finally {
        setLoading(false);
      }
    };

    loadRecentAssessments();
  }, [tenantId, limit]);

  const getScoreColor = (score: number): string => {
    if (score >= 80) return '#10b981'; // Green
    if (score >= 60) return '#f59e0b'; // Yellow
    return '#ef4444'; // Red
  };

  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const calculateTrend = (assessments: AssessmentHistory[]): { direction: 'up' | 'down' | 'stable', change: number } => {
    if (assessments.length < 2) {
      return { direction: 'stable', change: 0 };
    }

    const latest = assessments[0].overallScore;
    const previous = assessments[1].overallScore;
    const change = latest - previous;

    if (Math.abs(change) < 2) {
      return { direction: 'stable', change };
    }

    return {
      direction: change > 0 ? 'up' : 'down',
      change: Math.round(change)
    };
  };

  if (loading) {
    return (
      <div className="recent-assessments">
        <div className="section-header">
          <h3>Recent Assessments</h3>
        </div>
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <span>Loading recent assessments...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="recent-assessments">
        <div className="section-header">
          <h3>Recent Assessments</h3>
        </div>
        <div className="error-state">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (assessments.length === 0) {
    return (
      <div className="recent-assessments">
        <div className="section-header">
          <h3>Recent Assessments</h3>
        </div>
        <div className="empty-state">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14,2 14,8 20,8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10,9 9,9 8,9"></polyline>
          </svg>
          <h4>No Assessment History</h4>
          <p>Run your first assessment to see historical data and trends.</p>
        </div>
      </div>
    );
  }

  const trend = calculateTrend(assessments);

  return (
    <div className="recent-assessments">
      <div className="section-header">
        <h3>Recent Assessments</h3>
        <div className="trend-indicator">
          <div className={`trend-icon ${trend.direction}`}>
            {trend.direction === 'up' && (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="18 15 12 9 6 15"></polyline>
              </svg>
            )}
            {trend.direction === 'down' && (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            )}
            {trend.direction === 'stable' && (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            )}
          </div>
          <span className="trend-text">
            {trend.direction === 'stable' ? 'Stable' : `${Math.abs(trend.change)}% ${trend.direction === 'up' ? 'improvement' : 'decline'}`}
          </span>
        </div>
      </div>

      <div className="assessments-list">
        {assessments.map((assessment, index) => (
          <div key={assessment.assessmentId} className={`assessment-item ${index === 0 ? 'latest' : ''}`}>
            <div className="assessment-main">
              <div className="assessment-date">
                {formatDate(assessment.date)}
                {index === 0 && <span className="latest-badge">Latest</span>}
              </div>
              <div className="assessment-score">
                <div 
                  className="score-circle" 
                  style={{ 
                    background: `conic-gradient(${getScoreColor(assessment.overallScore)} ${assessment.overallScore * 3.6}deg, #e5e7eb 0deg)`
                  }}
                >
                  <span className="score-value">{assessment.overallScore}%</span>
                </div>
              </div>
            </div>
            
            <div className="category-scores-mini">
              <div className="category-mini">
                <span className="category-label">ID</span>
                <span className="category-value">{assessment.categoryScores.identity}%</span>
              </div>
              <div className="category-mini">
                <span className="category-label">Data</span>
                <span className="category-value">{assessment.categoryScores.dataProtection}%</span>
              </div>
              <div className="category-mini">
                <span className="category-label">EP</span>
                <span className="category-value">{assessment.categoryScores.endpoint}%</span>
              </div>
              <div className="category-mini">
                <span className="category-label">Cloud</span>
                <span className="category-value">{assessment.categoryScores.cloudApps}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {assessments.length > 0 && (
        <div className="view-all-link">
          <button className="link-button">
            View Full History →
          </button>
        </div>
      )}
    </div>
  );
};

export default RecentAssessments;