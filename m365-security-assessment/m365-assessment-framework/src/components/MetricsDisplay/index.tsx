import React from 'react';
import { Assessment } from '../../models/Assessment';
import { SECURITY_CATEGORIES } from '../../shared/constants';

interface MetricsDisplayProps {
  assessment: Assessment;
  historicalData?: Assessment[];
}

const MetricsDisplay: React.FC<MetricsDisplayProps> = ({ 
  assessment,
  historicalData = []
}) => {
  const renderMetricCard = (category: string, score: number) => {
    const trend = historicalData.length > 0
      ? score - (historicalData[0].metrics.score[category as keyof typeof historicalData[0].metrics.score] || 0)
      : 0;

    const getScoreColor = (value: number) => {
      if (value >= 90) return '#107c10';
      if (value >= 70) return '#ff8c00';
      return '#d13438';
    };

    const getTrendColor = (value: number) => {
      if (value > 0) return '#107c10';
      if (value < 0) return '#d13438';
      return '#666666';
    };

    const getTrendIcon = (value: number) => {
      if (value > 0) return '↑';
      if (value < 0) return '↓';
      return '→';
    };

    return (
      <div className="metric-card">
        <div className="metric-header">
          <h3>{SECURITY_CATEGORIES[category as keyof typeof SECURITY_CATEGORIES]}</h3>
          <div 
            className="score" 
            style={{ color: getScoreColor(score) }}
          >
            {Math.round(score)}%
          </div>
        </div>

        {trend !== 0 && (
          <div 
            className="trend"
            style={{ color: getTrendColor(trend) }}
          >
            {getTrendIcon(trend)} {Math.abs(trend).toFixed(1)}%
          </div>
        )}

        <div className="score-bar">
          <div 
            className="score-fill"
            style={{ 
              width: `${score}%`,
              backgroundColor: getScoreColor(score)
            }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="metrics-display">
      <div className="metrics-header">
        <h2>Security Metrics</h2>
        <div className="last-updated">
          Last updated: {new Date(assessment.metrics.lastUpdated).toLocaleDateString()}
        </div>
      </div>

      <div className="metrics-grid">
        <div className="overall-metric">
          {renderMetricCard('overall', assessment.metrics.score.overall)}
        </div>
        
        {Object.entries(assessment.metrics.score)
          .filter(([category]) => category !== 'overall')
          .map(([category, score]) => (
            <div key={category} className="category-metric">
              {renderMetricCard(category, score)}
            </div>
          ))}
      </div>

      <style>{`
        .metrics-display {
          padding: 24px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .metrics-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .metrics-header h2 {
          margin: 0;
          color: #333;
        }

        .last-updated {
          color: #666;
          font-size: 14px;
        }

        .metrics-grid {
          display: grid;
          gap: 16px;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        }

        .overall-metric {
          grid-column: 1 / -1;
        }

        .metric-card {
          padding: 16px;
          background: #f8f8f8;
          border-radius: 8px;
          transition: transform 0.2s;
        }

        .metric-card:hover {
          transform: translateY(-2px);
        }

        .metric-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .metric-header h3 {
          margin: 0;
          font-size: 16px;
          color: #333;
        }

        .score {
          font-size: 24px;
          font-weight: bold;
        }

        .trend {
          font-size: 14px;
          margin-bottom: 8px;
        }

        .score-bar {
          height: 4px;
          background: #e0e0e0;
          border-radius: 2px;
          overflow: hidden;
        }

        .score-fill {
          height: 100%;
          transition: width 0.5s ease-out;
        }

        @media (max-width: 768px) {
          .metrics-display {
            padding: 16px;
          }

          .metrics-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
          }

          .metrics-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default MetricsDisplay;