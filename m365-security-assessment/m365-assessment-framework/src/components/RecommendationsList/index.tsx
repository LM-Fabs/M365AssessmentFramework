import React, { useState } from 'react';
import { Assessment } from '../../models/Assessment';
import { SECURITY_CATEGORIES } from '../../shared/constants';

interface Recommendation {
  id: string;
  category: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'high' | 'medium' | 'low';
  steps: string[];
  references: { title: string; url: string }[];
}

interface RecommendationsListProps {
  assessment: Assessment;
  selectedCategory?: string;
}

const RecommendationsList: React.FC<RecommendationsListProps> = ({ 
  assessment, 
  selectedCategory 
}) => {
  const [filter, setFilter] = useState({
    impact: [] as string[],
    effort: [] as string[],
    implemented: false
  });

  const getRecommendations = (): Recommendation[] => {
    // In a real implementation, this would analyze the assessment metrics
    // and generate relevant recommendations based on scores and settings
    const recommendations: Recommendation[] = [
      {
        id: 'rec1',
        category: 'identity',
        title: 'Enable MFA for all users',
        description: 'Multi-factor authentication significantly improves account security by requiring multiple forms of verification.',
        impact: 'high',
        effort: 'medium',
        steps: [
          'Navigate to Azure AD Security settings',
          'Enable Security Defaults or create Conditional Access policies',
          'Configure MFA settings for all users',
          'Plan user communication and rollout strategy'
        ],
        references: [
          {
            title: 'Microsoft MFA Documentation',
            url: 'https://docs.microsoft.com/azure/active-directory/authentication/concept-mfa-howitworks'
          }
        ]
      },
      // Add more recommendations based on assessment metrics
    ];

    return recommendations.filter(rec => {
      if (selectedCategory && rec.category !== selectedCategory) return false;
      if (filter.impact.length && !filter.impact.includes(rec.impact)) return false;
      if (filter.effort.length && !filter.effort.includes(rec.effort)) return false;
      return true;
    });
  };

  const recommendations = getRecommendations();

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high':
        return '#d13438';
      case 'medium':
        return '#ff8c00';
      case 'low':
        return '#107c10';
      default:
        return '#666666';
    }
  };

  const getEffortColor = (effort: string) => {
    switch (effort) {
      case 'high':
        return '#107c10';
      case 'medium':
        return '#ff8c00';
      case 'low':
        return '#d13438';
      default:
        return '#666666';
    }
  };

  const handleFilterChange = (type: string, value: string) => {
    setFilter(prev => ({
      ...prev,
      [type]: prev[type as keyof typeof prev].includes(value)
        ? (prev[type as keyof typeof prev] as string[]).filter(v => v !== value)
        : [...(prev[type as keyof typeof prev] as string[]), value]
    }));
  };

  return (
    <div className="recommendations-list">
      <div className="filters">
        <div className="filter-group">
          <h3>Impact</h3>
          {['high', 'medium', 'low'].map(impact => (
            <label key={impact} className="filter-option">
              <input
                type="checkbox"
                checked={filter.impact.includes(impact)}
                onChange={() => handleFilterChange('impact', impact)}
              />
              <span className="filter-label" style={{ color: getImpactColor(impact) }}>
                {impact.charAt(0).toUpperCase() + impact.slice(1)}
              </span>
            </label>
          ))}
        </div>

        <div className="filter-group">
          <h3>Effort</h3>
          {['high', 'medium', 'low'].map(effort => (
            <label key={effort} className="filter-option">
              <input
                type="checkbox"
                checked={filter.effort.includes(effort)}
                onChange={() => handleFilterChange('effort', effort)}
              />
              <span className="filter-label" style={{ color: getEffortColor(effort) }}>
                {effort.charAt(0).toUpperCase() + effort.slice(1)}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="recommendations">
        {recommendations.map(rec => (
          <div key={rec.id} className="recommendation-card">
            <div className="recommendation-header">
              <h3>{rec.title}</h3>
              <div className="recommendation-tags">
                <span 
                  className="tag impact" 
                  style={{ backgroundColor: getImpactColor(rec.impact) }}
                >
                  Impact: {rec.impact}
                </span>
                <span 
                  className="tag effort"
                  style={{ backgroundColor: getEffortColor(rec.effort) }}
                >
                  Effort: {rec.effort}
                </span>
              </div>
            </div>

            <div className="recommendation-category">
              {SECURITY_CATEGORIES[rec.category as keyof typeof SECURITY_CATEGORIES]}
            </div>

            <p className="recommendation-description">{rec.description}</p>

            <div className="implementation-steps">
              <h4>Implementation Steps</h4>
              <ol>
                {rec.steps.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
            </div>

            {rec.references.length > 0 && (
              <div className="references">
                <h4>References</h4>
                <ul>
                  {rec.references.map((ref, index) => (
                    <li key={index}>
                      <a href={ref.url} target="_blank" rel="noopener noreferrer">
                        {ref.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}

        {recommendations.length === 0 && (
          <div className="no-recommendations">
            <p>No recommendations found for the selected filters.</p>
          </div>
        )}
      </div>

      <style>{`
        .recommendations-list {
          display: grid;
          grid-template-columns: 250px 1fr;
          gap: 24px;
        }

        .filters {
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          padding: 16px;
          position: sticky;
          top: 24px;
          height: fit-content;
        }

        .filter-group {
          margin-bottom: 24px;
        }

        .filter-group h3 {
          margin: 0 0 12px;
          font-size: 16px;
          color: #333;
        }

        .filter-option {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
          cursor: pointer;
        }

        .filter-label {
          font-size: 14px;
        }

        .recommendations {
          display: grid;
          gap: 16px;
        }

        .recommendation-card {
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          padding: 20px;
        }

        .recommendation-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 12px;
        }

        .recommendation-header h3 {
          margin: 0;
          font-size: 18px;
          color: #333;
        }

        .recommendation-tags {
          display: flex;
          gap: 8px;
        }

        .tag {
          padding: 4px 8px;
          border-radius: 4px;
          color: white;
          font-size: 12px;
          font-weight: 500;
        }

        .recommendation-category {
          color: #666;
          font-size: 14px;
          margin-bottom: 12px;
        }

        .recommendation-description {
          color: #333;
          margin-bottom: 20px;
          line-height: 1.5;
        }

        .implementation-steps {
          margin-bottom: 20px;
        }

        .implementation-steps h4,
        .references h4 {
          margin: 0 0 12px;
          font-size: 16px;
          color: #333;
        }

        .implementation-steps ol {
          margin: 0;
          padding-left: 20px;
        }

        .implementation-steps li {
          margin-bottom: 8px;
          color: #333;
        }

        .references ul {
          margin: 0;
          padding-left: 20px;
          list-style-type: none;
        }

        .references li {
          margin-bottom: 8px;
        }

        .references a {
          color: #0078d4;
          text-decoration: none;
        }

        .references a:hover {
          text-decoration: underline;
        }

        .no-recommendations {
          text-align: center;
          padding: 48px;
          background: white;
          border-radius: 8px;
          color: #666;
        }

        @media (max-width: 768px) {
          .recommendations-list {
            grid-template-columns: 1fr;
          }

          .filters {
            position: static;
            margin-bottom: 16px;
          }

          .recommendation-header {
            flex-direction: column;
            gap: 12px;
          }

          .recommendation-tags {
            width: 100%;
            justify-content: flex-start;
          }
        }
      `}</style>
    </div>
  );
};

export default RecommendationsList;