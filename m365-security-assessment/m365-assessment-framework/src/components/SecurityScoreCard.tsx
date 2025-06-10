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
    identity: assessment.metrics.score?.identity || 0,
    data: assessment.metrics.score?.dataProtection || 0,
    devices: assessment.metrics.score?.endpoint || 0,
    infrastructure: assessment.metrics.score?.cloudApps || 0
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

  const renderCategoryChange = (category: keyof typeof comparison.categories) => {
    if (loading) {
      return <span className="category-change loading">...</span>;
    }
    
    if (!comparison || !comparison.categories[category]) {
      return <span className="category-change neutral">New</span>;
    }

    const categoryComparison = comparison.categories[category];
    const change = categoryComparison.change;
    const changePercent = categoryComparison.changePercent;
    
    if (change === 0) {
      return <span className="category-change neutral">0%</span>;
    }

    const sign = change > 0 ? '+' : '';
    const className = `category-change ${getChangeClass(change)}`;
    
    return (
      <span className={className}>
        {sign}{change}%
      </span>
    );
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
          <div className="category-score-card" onClick={() => onCategoryClick('identity')}>
            <div className="category-icon identity-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </div>
            <div className="category-details">
              <span className="category-name">Identity</span>
              <span className="category-score">{metrics.identity}%</span>
              {renderCategoryChange('identity')}
            </div>
          </div>

          <div className="category-score-card" onClick={() => onCategoryClick('data')}>
            <div className="category-icon data-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                <path d="M2 17l10 5 10-5"></path>
                <path d="M2 12l10 5 10-5"></path>
              </svg>
            </div>
            <div className="category-details">
              <span className="category-name">Data</span>
              <span className="category-score">{metrics.data}%</span>
              {renderCategoryChange('dataProtection')}
            </div>
          </div>

          <div className="category-score-card" onClick={() => onCategoryClick('devices')}>
            <div className="category-icon devices-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                <line x1="8" y1="21" x2="16" y2="21"></line>
                <line x1="12" y1="17" x2="12" y2="21"></line>
              </svg>
            </div>
            <div className="category-details">
              <span className="category-name">Devices</span>
              <span className="category-score">{metrics.devices}%</span>
              {renderCategoryChange('endpoint')}
            </div>
          </div>

          <div className="category-score-card" onClick={() => onCategoryClick('infrastructure')}>
            <div className="category-icon infrastructure-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
                <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
                <line x1="6" y1="6" x2="6.01" y2="6"></line>
                <line x1="6" y1="18" x2="6.01" y2="18"></line>
              </svg>
            </div>
            <div className="category-details">
              <span className="category-name">Infrastructure</span>
              <span className="category-score">{metrics.infrastructure}%</span>
              {renderCategoryChange('cloudApps')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecurityScoreCard;