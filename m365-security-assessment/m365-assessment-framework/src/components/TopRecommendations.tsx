import React from 'react';
import './TopRecommendations.css';
import { Assessment } from '../models/Assessment';

interface TopRecommendationsProps {
  assessment: Assessment;
}

const TopRecommendations: React.FC<TopRecommendationsProps> = ({ assessment }) => {
  // Extract real recommendations from assessment data
  const getRecommendationsFromAssessment = () => {
    const recommendations = [];
    
    // Get recommendations from assessment metrics if available
    if (assessment?.metrics?.recommendations && assessment.metrics.recommendations.length > 0) {
      // Use real recommendations from the assessment
      return assessment.metrics.recommendations.slice(0, 3).map((rec, index) => ({
        id: `real-rec-${index}`,
        title: getRecommendationTitle(rec),
        description: rec,
        impact: getRecommendationImpact(rec),
        category: getRecommendationCategory(rec),
        icon: getRecommendationIcon(rec)
      }));
    }

    // If no real recommendations, show message about needing real data
    if (!assessment?.metrics?.realData) {
      return [{
        id: 'setup-rec',
        title: 'Complete Customer Setup',
        description: 'Set up Azure AD app registration and tenant connection to get personalized recommendations.',
        impact: 'high',
        category: 'setup',
        icon: 'setup'
      }];
    }

    // Generate recommendations based on available real data
    if (assessment.metrics.realData?.licenseInfo) {
      const licenseInfo = assessment.metrics.realData.licenseInfo;
      const utilizationRate = licenseInfo.utilizationRate || 
        (licenseInfo.totalLicenses > 0 ? (licenseInfo.assignedLicenses / licenseInfo.totalLicenses) * 100 : 0);

      if (utilizationRate < 40) {
        recommendations.push({
          id: 'license-optimization',
          title: 'Optimize License Usage',
          description: `License utilization is ${Math.round(utilizationRate)}%. Consider reducing unused licenses to optimize costs.`,
          impact: 'medium',
          category: 'license',
          icon: 'license'
        });
      } else if (utilizationRate > 90) {
        recommendations.push({
          id: 'license-capacity',
          title: 'Increase License Capacity',
          description: `License utilization is ${Math.round(utilizationRate)}%. Consider purchasing additional licenses.`,
          impact: 'high',
          category: 'license',
          icon: 'license'
        });
      }
    }

    if (assessment.metrics.realData?.secureScore) {
      const secureScore = assessment.metrics.realData.secureScore;
      if (secureScore.percentage < 70) {
        recommendations.push({
          id: 'security-improvement',
          title: 'Improve Security Score',
          description: `Current security score is ${secureScore.percentage}%. Focus on implementing high-impact security controls.`,
          impact: 'high',
          category: 'security',
          icon: 'shield-check'
        });
      }
    }

    // Default recommendation if no specific issues found
    if (recommendations.length === 0) {
      recommendations.push({
        id: 'general-rec',
        title: 'Regular Security Review',
        description: 'Conduct regular security assessments to maintain optimal security posture.',
        impact: 'medium',
        category: 'security',
        icon: 'shield-check'
      });
    }

    return recommendations.slice(0, 3); // Limit to top 3
  };

  const getRecommendationTitle = (recommendation: string): string => {
    if (recommendation.includes('license')) return 'License Optimization';
    if (recommendation.includes('MFA') || recommendation.includes('Multi-Factor')) return 'Enable Multi-Factor Authentication';
    if (recommendation.includes('Conditional Access')) return 'Configure Conditional Access';
    if (recommendation.includes('Secure Score')) return 'Improve Security Score';
    return 'Security Improvement';
  };

  const getRecommendationImpact = (recommendation: string): string => {
    if (recommendation.includes('Immediate action') || recommendation.includes('Critical')) return 'high';
    if (recommendation.includes('moderate') || recommendation.includes('Consider')) return 'medium';
    return 'medium';
  };

  const getRecommendationCategory = (recommendation: string): string => {
    if (recommendation.includes('license')) return 'license';
    if (recommendation.includes('MFA') || recommendation.includes('Identity') || recommendation.includes('Conditional')) return 'identity';
    if (recommendation.includes('Secure Score') || recommendation.includes('security')) return 'security';
    return 'general';
  };

  const getRecommendationIcon = (recommendation: string): string => {
    if (recommendation.includes('license')) return 'license';
    if (recommendation.includes('MFA') || recommendation.includes('Identity')) return 'shield-check';
    if (recommendation.includes('Conditional')) return 'lock';
    if (recommendation.includes('setup') || recommendation.includes('Complete')) return 'setup';
    return 'shield-check';
  };

  const recommendations = getRecommendationsFromAssessment();

  const renderIcon = (icon: string) => {
    switch(icon) {
      case 'shield-check':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            <path d="M9 12l2 2 4-4"></path>
          </svg>
        );
      case 'users':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
        );
      case 'lock':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
        );
      case 'license':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14,2 14,8 20,8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
          </svg>
        );
      case 'setup':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1m15.5-6.5l-4.2 4.2m-6.6 0L1.5 5.5m17 13l-4.2-4.2m-6.6 0L1.5 18.5"></path>
          </svg>
        );
      default:
        return null;
    }
  };
  
  return (
    <div className="top-recommendations">
      <h2>Top Recommendations</h2>
      
      <div className="recommendations-list">
        {recommendations.map((rec: any) => (
          <div key={rec.id} className="recommendation-item">
            <div className={`recommendation-icon ${rec.category}-icon`}>
              {renderIcon(rec.icon)}
            </div>
            <div className="recommendation-content">
              <h3>{rec.title}</h3>
              <p>{rec.description}</p>
              <button className="view-details-button">View details</button>
            </div>
          </div>
        ))}
      </div>
      
      <div className="view-all-recommendations">
        <button className="view-all-button">
          View all recommendations
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default TopRecommendations;