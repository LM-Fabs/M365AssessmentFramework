import React from 'react';
import './TopRecommendations.css';
import { Assessment } from '../models/Assessment';

interface TopRecommendationsProps {
  assessment: Assessment;
}

const TopRecommendations: React.FC<TopRecommendationsProps> = ({ assessment }) => {
  // In a real app, you would derive these from assessment.recommendations
  // For now, using static data as we update the component
  const recommendations = [
    {
      id: 'rec-1',
      title: 'Enable Multi-Factor Authentication for all admin accounts',
      description: 'Currently only 4 out of 12 admin accounts have MFA enabled.',
      impact: 'high',
      category: 'identity',
      icon: 'shield-check'
    },
    {
      id: 'rec-2',
      title: 'Review high privilege roles',
      description: '8 users with Global Admin role detected. Recommended maximum is 4.',
      impact: 'medium',
      category: 'identity',
      icon: 'users'
    },
    {
      id: 'rec-3',
      title: 'Enable Conditional Access policies',
      description: 'No Conditional Access policies are configured.',
      impact: 'high',
      category: 'access',
      icon: 'lock'
    }
  ];

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
      default:
        return null;
    }
  };
  
  return (
    <div className="top-recommendations">
      <h2>Top Recommendations</h2>
      
      <div className="recommendations-list">
        {recommendations.map(rec => (
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