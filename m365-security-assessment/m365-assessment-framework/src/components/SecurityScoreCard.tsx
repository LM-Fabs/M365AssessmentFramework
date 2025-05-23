import React from 'react';
import { Assessment } from '../models/Assessment';
import { Tenant } from '../models/Tenant';
import CircleProgress from './ui/CircleProgress';
import './SecurityScoreCard.css';

interface SecurityScoreCardProps {
  assessment: Assessment;
  tenant: Tenant;
  onCategoryClick: (category: string) => void;
}

const SecurityScoreCard: React.FC<SecurityScoreCardProps> = ({ assessment, tenant, onCategoryClick }) => {
  // Fix: Access the score from the correct path in the Assessment model
  const overallScore = assessment.metrics.score?.overall || 0;
  const metrics = {
    identity: assessment.metrics.score?.identity || 0,
    data: assessment.metrics.score?.dataProtection || 0,
    devices: assessment.metrics.score?.endpoint || 0,
    infrastructure: assessment.metrics.score?.cloudApps || 0
  };
  
  const formatScoreChange = (change: number) => {
    if (change > 0) return `+${change}%`;
    if (change < 0) return `${change}%`;
    return 'No change';
  };

  // Get score change - in a real app this would come from your assessment data
  const scoreChange = 5; // Example: 5% improvement

  return (
    <div className="security-score-overview">
      <div className="score-header">
        <h2>Security Score Overview</h2>
        <div className="last-assessment">
          Last assessment: {new Date(assessment.lastModified).toLocaleDateString()} · 
          <span className="compare-link">Compare with previous</span>
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
            {scoreChange > 0 ? (
              <div className="score-improvement">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="18 15 12 9 6 15"></polyline>
                </svg>
                {formatScoreChange(scoreChange)} since last assessment
              </div>
            ) : scoreChange < 0 ? (
              <div className="score-decline">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
                {formatScoreChange(scoreChange)} since last assessment
              </div>
            ) : (
              <div className="score-neutral">No change since last assessment</div>
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
              <span className="category-change positive">+12%</span>
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
              <span className="category-change positive">+8%</span>
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
              <span className="category-change positive">+3%</span>
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
              <span className="category-change positive">+5%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecurityScoreCard;