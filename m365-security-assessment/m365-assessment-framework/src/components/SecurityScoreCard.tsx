import React, { useState, useEffect } from 'react';
import { Assessment } from '../models/Assessment';
import { Tenant } from '../models/Tenant';
import { AssessmentHistoryService } from '../services/assessmentHistoryService';
import CircleProgress from './ui/CircleProgress';
import './SecurityScoreCard.css';

interface SecurityScoreCardProps {
  assessment: Assessment;
  tenant: Tenant;
  onCategoryClick: (category: string) => void;
}

interface ScoreComparison {
  current: number;
  previous: number;
  change: number;
  changePercent: number;
}

const SecurityScoreCard: React.FC<SecurityScoreCardProps> = ({ assessment, tenant, onCategoryClick }) => {
  const [comparison, setComparison] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const historyService = AssessmentHistoryService.getInstance();

  // Load comparison data when component mounts
  useEffect(() => {
    const loadComparison = async () => {
      try {
        setLoading(true);
        const comparisonData = await historyService.compareWithPrevious(assessment);
        setComparison(comparisonData);
      } catch (error) {
        console.error('Error loading assessment comparison:', error);
      } finally {
        setLoading(false);
      }
    };

    loadComparison();
  }, [assessment]);

  // Access the score from the correct path in the Assessment model
  const overallScore = assessment.metrics.score?.overall || 0;
  const metrics = {
    license: assessment.metrics.score?.license || 0,
    secureScore: assessment.metrics.score?.secureScore || 0
  };
  
  const formatScoreChange = (change: number, changePercent: number) => {
    if (change === 0) return 'No change';
    const sign = change > 0 ? '+' : '';
    return `${sign}${change}% (${sign}${changePercent}%)`;
  };

  const getChangeClass = (change: number) => {
    if (change > 0) return 'positive';
    if (change < 0) return 'negative';
    return 'neutral';
  };

  const renderScoreChange = (scoreComparison: ScoreComparison | null, label: string = 'since last assessment') => {
    if (!scoreComparison) {
      return <div className="score-neutral">No previous assessment for comparison</div>;
    }

    const change = scoreComparison.change;
    const changePercent = scoreComparison.changePercent;

    if (change > 0) {
      return (
        <div className="score-improvement">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="18 15 12 9 6 15"></polyline>
          </svg>
          {formatScoreChange(change, changePercent)} {label}
        </div>
      );
    } else if (change < 0) {
      return (
        <div className="score-decline">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
          {formatScoreChange(change, changePercent)} {label}
        </div>
      );
    } else {
      return <div className="score-neutral">No change {label}</div>;
    }
  };

  const renderCategoryChange = (category: string) => {
    if (loading) {
      return <span className="category-change loading">...</span>;
    }
    
    // For now, show "New" since we're migrating to new category structure
    return <span className="category-change neutral">New</span>;
  };

  return (
    <div className="security-score-overview">
      <div className="score-header">
        <h2>Security Score Overview</h2>
        <div className="last-assessment">
          Last assessment: {new Date(assessment.lastModified).toLocaleDateString()}
          {comparison && comparison.timespan && (
            <span> · {comparison.timespan.daysDifference} days ago</span>
          )}
          {comparison && (
            <span className="compare-link" style={{ marginLeft: '10px', cursor: 'pointer' }}>
              Compare with previous
            </span>
          )}
        </div>
      </div>

      <div className="score-cards-container">
        <div className="overall-score-card">
          <div className="circle-progress-container">
            <CircleProgress 
              percentage={overallScore} 
              size={160} 
              strokeWidth={12} 
              circleColor="#007BFF" 
            />
            <div className="overall-score-label">
              <span className="score-value">{overallScore}%</span>
              <span className="score-subtitle">Overall Score</span>
            </div>
          </div>
          <div className="score-change">
            {loading ? (
              <div className="score-neutral">Loading comparison...</div>
            ) : (
              renderScoreChange(comparison?.overall, 'since last assessment')
            )}
          </div>
        </div>

        <div className="category-scores">
          <div className="category-score-card" onClick={() => onCategoryClick('license')}>
            <div className="category-icon license-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14,2 14,8 20,8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10,9 9,9 8,9"></polyline>
              </svg>
            </div>
            <div className="category-details">
              <span className="category-name">License Usage</span>
              <span className="category-score">{Math.round(metrics.license)}%</span>
              {renderCategoryChange('license')}
            </div>
          </div>

          <div className="category-score-card" onClick={() => onCategoryClick('secureScore')}>
            <div className="category-icon securescore-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                <path d="M9 12l2 2 4-4"></path>
              </svg>
            </div>
            <div className="category-details">
              <span className="category-name">Secure Score</span>
              <span className="category-score">{Math.round(metrics.secureScore)}%</span>
              {renderCategoryChange('secureScore')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecurityScoreCard;