import React from 'react';
import './CriticalSecurityRisks.css';
import { Assessment } from '../models/Assessment';

interface CriticalSecurityRisksProps {
  assessment: Assessment;
}

const CriticalSecurityRisks: React.FC<CriticalSecurityRisksProps> = ({ assessment }) => {
  // This would normally come from your assessment data
  const criticalRisks = [
    {
      id: 'risk-1',
      title: 'Legacy authentication is enabled',
      description: 'Legacy authentication protocols don\'t support MFA and are commonly used in attacks.',
      severity: 'high',
      category: 'identity'
    },
    {
      id: 'risk-2',
      title: 'Self-service password reset not enabled',
      description: 'Users cannot reset their passwords, increasing helpdesk load and security risks.',
      severity: 'medium',
      category: 'identity'
    },
    {
      id: 'risk-3',
      title: 'External sharing enabled for all domains',
      description: 'SharePoint and OneDrive content can be shared with any external domain.',
      severity: 'high',
      category: 'data'
    }
  ];
  
  const renderSeverityBadge = (severity: string) => {
    switch(severity) {
      case 'high':
        return <span className="severity-badge high">High Risk</span>;
      case 'medium':
        return <span className="severity-badge medium">Medium Risk</span>;
      case 'low':
        return <span className="severity-badge low">Low Risk</span>;
      default:
        return null;
    }
  };
  
  return (
    <div className="critical-security-risks">
      <h2>Critical Security Risks</h2>
      
      <div className="risks-list">
        {criticalRisks.map(risk => (
          <div key={risk.id} className="risk-item">
            <div className="risk-icon">
              {risk.category === 'identity' && (
                <svg xmlns="http://www.w3.org/2000/svg" className="risk-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 17.5l4 4 6-6.5M4.12 3.29L1 6.41a2 2 0 0 0 0 2.83L12.59 21a2 2 0 0 0 2.83 0l9.9-9.9a2 2 0 0 0 0-2.83L13 5.94"></path>
                </svg>
              )}
              {risk.category === 'data' && (
                <svg xmlns="http://www.w3.org/2000/svg" className="risk-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
              )}
            </div>
            <div className="risk-content">
              <div className="risk-header">
                <h3>{risk.title}</h3>
                {renderSeverityBadge(risk.severity)}
              </div>
              <p className="risk-description">{risk.description}</p>
              <div className="risk-actions">
                <button className="details-button">View details</button>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="view-all-risks">
        <button className="view-all-button">
          View all 8 security risks
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default CriticalSecurityRisks;