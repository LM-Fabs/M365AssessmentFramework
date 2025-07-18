import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AssessmentHistoryService } from '../services/assessmentHistoryService';
import './RecentAssessments.css';

interface RecentAssessmentsProps {
  tenantId: string;
  limit?: number;
  customerId?: string;
}

interface AssessmentHistory {
  assessmentId: string;
  tenantId: string;
  date: Date;
  overallScore: number;
  categoryScores: {
    license: number;
    secureScore: number;
  };
}

const RecentAssessments: React.FC<RecentAssessmentsProps> = ({ tenantId, limit = 4, customerId }) => {
  const [assessments, setAssessments] = useState<AssessmentHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

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
        
        console.log('🔍 RecentAssessments: Loading assessments for', customerId ? `customer ${customerId}` : `tenant ${tenantId}`);
        
        // Use customerId if provided, otherwise use tenantId for backward compatibility
        const recentAssessments = customerId 
          ? await historyService.getCustomerAssessments(customerId, limit)
          : await historyService.getRecentAssessments(tenantId, limit);
        
        console.log('📊 RecentAssessments: Received data:', recentAssessments);
        
        // Ensure we have an array
        if (!Array.isArray(recentAssessments)) {
          console.warn('⚠️ RecentAssessments: Expected array but got:', typeof recentAssessments, recentAssessments);
          setAssessments([]);
          return;
        }
        
        // Sort by date (newest first) and limit to the specified number
        const sortedAndLimited = recentAssessments
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, limit)
          .map(assessment => ({
            ...assessment,
            overallScore: typeof assessment.overallScore === 'number' ? assessment.overallScore : 0,
            categoryScores: {
              license: typeof assessment.categoryScores?.license === 'number' ? assessment.categoryScores.license : 0,
              secureScore: typeof assessment.categoryScores?.secureScore === 'number' ? assessment.categoryScores.secureScore : 0
            }
          }));
          
        setAssessments(sortedAndLimited);
        console.log('✅ RecentAssessments: Successfully loaded', sortedAndLimited.length, 'assessments (sorted newest first)');
      } catch (err: any) {
        console.error('❌ RecentAssessments: Error loading recent assessments:', err);
        setError('Failed to load recent assessments');
        setAssessments([]); // Show empty state instead of error
      } finally {
        setLoading(false);
      }
    };

    loadRecentAssessments();
  }, [tenantId, limit, customerId]);

  const getScoreColor = (score: number): string => {
    if (score >= 80) return '#10b981'; // Green
    if (score >= 60) return '#f59e0b'; // Yellow
    return '#ef4444'; // Red
  };

  const formatDate = (date: Date | string): string => {
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      if (!dateObj || isNaN(dateObj.getTime())) {
        return 'Invalid Date';
      }
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(dateObj);
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid Date';
    }
  };

  const handleViewAssessment = (assessmentId: string) => {
    navigate(`/assessment-results/${assessmentId}`);
  };

  const handleViewAllAssessments = () => {
    navigate('/history');
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
          <div 
            key={assessment.assessmentId} 
            className={`assessment-item ${index === 0 ? 'latest' : ''} clickable`}
            onClick={() => handleViewAssessment(assessment.assessmentId)}
            title="Click to view detailed assessment results"
          >
            <div className="assessment-main">
              <div className="assessment-date">
                {formatDate(assessment.date)}
                {index === 0 && <span className="latest-badge">Latest</span>}
              </div>
              <div className="assessment-score">
                <div 
                  className="score-circle" 
                  style={{ 
                    background: `conic-gradient(${getScoreColor(assessment.overallScore || 0)} ${(assessment.overallScore || 0) * 3.6}deg, #e5e7eb 0deg)`
                  }}
                >
                  <span className="score-value">{Math.round(assessment.overallScore || 0)}%</span>
                </div>
              </div>
            </div>
            
            <div className="category-scores-mini">
              <div className="category-mini">
                <span className="category-label">License</span>
                <span className="category-value">{Math.round(assessment.categoryScores?.license || 0)}%</span>
              </div>
              <div className="category-mini">
                <span className="category-label">Score</span>
                <span className="category-value">{Math.round(assessment.categoryScores?.secureScore || 0)}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {assessments.length > 0 && (
        <div className="view-all-link">
          <button className="link-button" onClick={handleViewAllAssessments}>
            View Full History →
          </button>
        </div>
      )}
    </div>
  );
};

export default RecentAssessments;