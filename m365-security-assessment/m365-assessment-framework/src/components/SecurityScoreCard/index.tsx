import React from 'react';
import { Assessment } from '../../models/Assessment';
import { SECURITY_CATEGORIES } from '../../shared/constants';

interface SecurityScoreCardProps {
  assessment: Assessment;
  tenant?: {
    id: string;
    name: string;
  };
  onCategoryClick?: (category: string) => void;
}

const SecurityScoreCard: React.FC<SecurityScoreCardProps> = ({ 
  assessment,
  tenant,
  onCategoryClick 
}) => {
  const metrics = assessment.metrics;

  const getScoreColor = (score: number) => {
    if (score >= 90) return '#107c10';
    if (score >= 70) return '#ff8c00';
    return '#d13438';
  };

  return (
    <div className="security-score-card">
      <div className="overall-score">
        <h2>Overall Security Score</h2>
        <div className="score-gauge">
          <div 
            className="gauge-background"
            style={{ backgroundColor: getScoreColor(metrics.score.overall) }}
          />
          <div className="gauge-value">
            {Math.round(metrics.score.overall)}%
          </div>
        </div>
      </div>

      <div className="category-scores">
        {Object.entries(metrics.score)
          .filter(([category]) => category !== 'overall')
          .map(([category, score]) => {
            const displayName = SECURITY_CATEGORIES[category as keyof typeof SECURITY_CATEGORIES];
            return (
              <div 
                key={category}
                className="category-score"
                onClick={() => onCategoryClick?.(category)}
                style={{ cursor: onCategoryClick ? 'pointer' : 'default' }}
              >
                <div className="category-label">{displayName}</div>
                <div 
                  className="score-bar"
                  style={{ 
                    width: `${score}%`,
                    backgroundColor: getScoreColor(score)
                  }}
                >
                  <span className="score-value">{Math.round(score)}%</span>
                </div>
              </div>
            );
          })}
      </div>

      <div className="assessment-info">
        <div>Last updated: {new Date(metrics.lastUpdated).toLocaleString()}</div>
        {tenant && <div>Tenant: {tenant.name}</div>}
      </div>

      <style>{`
        .security-score-card {
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          padding: 24px;
        }

        .overall-score {
          text-align: center;
          margin-bottom: 32px;
        }

        .overall-score h2 {
          margin: 0 0 16px;
          color: #333;
        }

        .score-gauge {
          width: 200px;
          height: 100px;
          margin: 0 auto;
          position: relative;
          overflow: hidden;
        }

        .gauge-background {
          width: 200px;
          height: 200px;
          border-radius: 50%;
          position: relative;
          background: #f0f0f0;
          overflow: hidden;
        }

        .gauge-fill {
          position: absolute;
          top: 0;
          left: 0;
          width: 50%;
          height: 100%;
          transform-origin: 100% 50%;
          transition: transform 0.5s ease-out;
        }

        .gauge-center {
          position: absolute;
          top: 50%;
          left: 0;
          right: 0;
          transform: translateY(-50%);
          text-align: center;
        }

        .score-value {
          font-size: 36px;
          font-weight: bold;
          line-height: 1;
          margin-bottom: 4px;
        }

        .score-label {
          font-size: 14px;
          color: #666;
        }

        .category-scores {
          display: grid;
          gap: 16px;
        }

        .category-score {
          cursor: pointer;
          padding: 16px;
          border-radius: 4px;
          background: #f8f8f8;
          transition: background-color 0.2s;
        }

        .category-score:hover {
          background: #f0f0f0;
        }

        .category-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .category-header h3 {
          margin: 0;
          font-size: 16px;
          color: #333;
        }

        .score-badge {
          padding: 4px 8px;
          border-radius: 12px;
          color: white;
          font-size: 14px;
          font-weight: bold;
        }

        .score-bar-container {
          height: 4px;
          background: #e0e0e0;
          border-radius: 2px;
          overflow: hidden;
        }

        .score-bar {
          height: 100%;
          transition: width 0.5s ease-out;
        }

        .assessment-info {
          margin-top: 24px;
          padding-top: 16px;
          border-top: 1px solid #eee;
          font-size: 14px;
          color: #666;
        }

        .assessment-info > div {
          margin-bottom: 4px;
        }

        @media (max-width: 768px) {
          .security-score-card {
            padding: 16px;
          }

          .score-gauge {
            width: 160px;
            height: 80px;
          }

          .gauge-background {
            width: 160px;
            height: 160px;
          }

          .score-value {
            font-size: 28px;
          }

          .category-score {
            padding: 12px;
          }
        }
      `}</style>
    </div>
  );
};

export default SecurityScoreCard;