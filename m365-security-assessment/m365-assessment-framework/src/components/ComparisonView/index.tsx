import React, { useEffect } from 'react';
import { Assessment } from '../../models/Assessment';
import { useComparison } from '../../hooks/useComparison';

interface ComparisonViewProps {
  assessment: Assessment;
  previousAssessmentId?: string;
  compareToBestPractices?: boolean;
}

const ComparisonView: React.FC<ComparisonViewProps> = ({ 
  assessment, 
  previousAssessmentId,
  compareToBestPractices = true 
}) => {
  const { 
    comparisonResults, 
    loading, 
    error, 
    compareWithBestPractices, 
    compareWithPrevious 
  } = useComparison();

  useEffect(() => {
    const runComparison = async () => {
      if (previousAssessmentId) {
        await compareWithPrevious(assessment, previousAssessmentId);
      } else if (compareToBestPractices) {
        await compareWithBestPractices(assessment);
      }
    };

    runComparison();
  }, [assessment, previousAssessmentId, compareToBestPractices]);

  if (loading) {
    return <div>Loading comparison...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  if (!comparisonResults || comparisonResults.length === 0) {
    return <div>No comparison data available</div>;
  }

  return (
    <div className="comparison-view">
      <h3>
        {previousAssessmentId 
          ? 'Historical Comparison' 
          : 'Best Practices Comparison'
        }
      </h3>

      <div className="comparison-grid">
        {comparisonResults.map((result, index) => (
          <div key={index} className="comparison-item">
            <div className="category-header">
              <h4>{result.category}</h4>
              <span className={`impact-badge impact-${result.impact}`}>
                {result.impact.toUpperCase()}
              </span>
            </div>

            <div className="metric-info">
              <p className="metric-name">{result.metric}</p>
              <div className="metric-values">
                <div className="current-value">
                  <span className="label">Current</span>
                  <span className="value">{Math.round(result.current)}%</span>
                </div>
                <div className="target-value">
                  <span className="label">Target</span>
                  <span className="value">{Math.round(result.target)}%</span>
                </div>
              </div>
              <div className="gap-indicator">
                <div 
                  className="gap-bar"
                  style={{
                    width: `${Math.min(Math.abs(result.gap), 100)}%`,
                    backgroundColor: result.gap > 0 ? '#107C10' : '#D83B01'
                  }}
                />
                <span className="gap-value">
                  {result.gap > 0 ? '+' : ''}{Math.round(result.gap)}%
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .comparison-view {
          padding: 20px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .comparison-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 20px;
          margin-top: 20px;
        }

        .comparison-item {
          background: #f8f8f8;
          border-radius: 6px;
          padding: 16px;
        }

        .category-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .category-header h4 {
          margin: 0;
          color: #333;
        }

        .impact-badge {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: bold;
        }

        .impact-high {
          background: #fed9cc;
          color: #d83b01;
        }

        .impact-medium {
          background: #fff4ce;
          color: #9d5d00;
        }

        .impact-low {
          background: #dff6dd;
          color: #107c10;
        }

        .metric-info {
          margin-top: 12px;
        }

        .metric-name {
          margin: 0 0 8px;
          color: #666;
        }

        .metric-values {
          display: flex;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .current-value,
        .target-value {
          text-align: center;
        }

        .label {
          display: block;
          font-size: 12px;
          color: #666;
        }

        .value {
          font-size: 18px;
          font-weight: bold;
          color: #333;
        }

        .gap-indicator {
          position: relative;
          height: 24px;
          background: #f0f0f0;
          border-radius: 12px;
          overflow: hidden;
        }

        .gap-bar {
          height: 100%;
          transition: width 0.3s ease;
        }

        .gap-value {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 12px;
          font-weight: bold;
          color: #333;
        }

        .error-message {
          color: #d83b01;
          padding: 10px;
          background: #fed9cc;
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
};

export default ComparisonView;