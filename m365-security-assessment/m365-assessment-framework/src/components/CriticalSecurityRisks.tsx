import React from 'react';
import './CriticalSecurityRisks.css';
import { Assessment } from '../models/Assessment';

interface CriticalSecurityRisksProps {
  assessment: Assessment;
}

const CriticalSecurityRisks: React.FC<CriticalSecurityRisksProps> = ({ assessment }) => {
  // Extract real security risks from assessment data
  const getSecurityRisksFromAssessment = () => {
    const risks = [];
    
    // If no real data is available, show setup message
    if (!assessment?.metrics?.realData) {
      return [{
        id: 'setup-risk',
        title: 'Assessment Data Not Available',
        description: 'Complete Azure AD app registration to access real-time security risk analysis.',
        severity: 'medium',
        category: 'setup'
      }];
    }

    // Analyze license utilization for risks
    if (assessment.metrics.realData?.licenseInfo) {
      const licenseInfo = assessment.metrics.realData.licenseInfo;
      const utilizationRate = licenseInfo.utilizationRate || 
        (licenseInfo.totalLicenses > 0 ? (licenseInfo.assignedLicenses / licenseInfo.totalLicenses) * 100 : 0);

      if (utilizationRate > 95) {
        risks.push({
          id: 'license-capacity-risk',
          title: 'License capacity at critical level',
          description: `License utilization is ${Math.round(utilizationRate)}%. Risk of service disruption for new users.`,
          severity: 'high',
          category: 'license'
        });
      } else if (utilizationRate < 20) {
        risks.push({
          id: 'license-waste-risk',
          title: 'Significant license under-utilization',
          description: `Only ${Math.round(utilizationRate)}% of licenses are being used. Consider cost optimization.`,
          severity: 'medium',
          category: 'license'
        });
      }
    }

    // Analyze secure score for risks
    if (assessment.metrics.realData?.secureScore) {
      const secureScore = assessment.metrics.realData.secureScore;
      
      if (secureScore.percentage < 40) {
        risks.push({
          id: 'critical-security-risk',
          title: 'Critical security score detected',
          description: `Security score is ${secureScore.percentage}%. Immediate action required to prevent security incidents.`,
          severity: 'high',
          category: 'security'
        });
      } else if (secureScore.percentage < 60) {
        risks.push({
          id: 'low-security-score',
          title: 'Below average security score',
          description: `Security score is ${secureScore.percentage}%. Focus on implementing basic security controls.`,
          severity: 'medium',
          category: 'security'
        });
      }

      // Check for specific control issues
      if (secureScore.controlScores && secureScore.controlScores.length > 0) {
        const failedControls = secureScore.controlScores.filter((control: any) => 
          control.implementationStatus === 'Not Implemented' && 
          (control.controlName?.toLowerCase().includes('mfa') || 
           control.controlName?.toLowerCase().includes('conditional'))
        );

        if (failedControls.length > 0) {
          risks.push({
            id: 'identity-controls-risk',
            title: 'Critical identity controls not implemented',
            description: 'Multi-Factor Authentication or Conditional Access policies are missing.',
            severity: 'high',
            category: 'identity'
          });
        }
      }
    }

    // Default risk if no specific issues found but we have data
    if (risks.length === 0 && assessment.metrics.realData) {
      risks.push({
        id: 'monitoring-risk',
        title: 'Regular security monitoring recommended',
        description: 'Continue regular security assessments to maintain current security posture.',
        severity: 'low',
        category: 'general'
      });
    }

    return risks.slice(0, 3); // Limit to top 3 risks
  };

  const criticalRisks = getSecurityRisksFromAssessment();
  
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
        {criticalRisks.map((risk: any) => (
          <div key={risk.id} className="risk-item">
            <div className="risk-icon">
              {(risk.category === 'identity' || risk.category === 'security') && (
                <svg xmlns="http://www.w3.org/2000/svg" className="risk-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                  <path d="M9 12l2 2 4-4"></path>
                </svg>
              )}
              {risk.category === 'data' && (
                <svg xmlns="http://www.w3.org/2000/svg" className="risk-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
              )}
              {risk.category === 'license' && (
                <svg xmlns="http://www.w3.org/2000/svg" className="risk-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14,2 14,8 20,8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                </svg>
              )}
              {(risk.category === 'setup' || risk.category === 'general') && (
                <svg xmlns="http://www.w3.org/2000/svg" className="risk-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
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
          View all security risks
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default CriticalSecurityRisks;