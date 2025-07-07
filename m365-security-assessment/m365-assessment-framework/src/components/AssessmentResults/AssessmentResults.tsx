import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AssessmentService } from '../../services/assessmentService';
import { LicenseReport } from '../LicenseReport';
import './AssessmentResults.css';

interface AssessmentData {
  id: string;
  tenantId: string;
  tenantName?: string;
  assessmentDate: string;
  status: string;
  metrics: {
    score: {
      overall: number;
      license: number;
      secureScore: number;
    };
    realData?: {
      licenseInfo?: any;
      secureScore?: any;
      dataSource?: string;
      lastUpdated?: string;
    };
    recommendations?: string[];
  };
  customerId?: string;
}

export const AssessmentResults: React.FC = () => {
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const navigate = useNavigate();
  const [assessment, setAssessment] = useState<AssessmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const assessmentService = AssessmentService.getInstance();

  useEffect(() => {
    const loadAssessment = async () => {
      if (!assessmentId) {
        setError('Assessment ID is required');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Fetch the specific assessment by ID
        const response = await fetch(`/api/assessment/${assessmentId}`);
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to load assessment');
        }

        if (!result.success || !result.data) {
          throw new Error('Assessment not found');
        }

        setAssessment(result.data);
      } catch (err: any) {
        console.error('Failed to load assessment:', err);
        setError(err.message || 'Failed to load assessment results');
      } finally {
        setLoading(false);
      }
    };

    loadAssessment();
  }, [assessmentId]);

  const handleBackToDashboard = () => {
    navigate('/dashboard');
  };

  const handlePrintReport = () => {
    window.print();
  };

  const handleExportReport = () => {
    // Create a simple CSV export of the license data
    if (!assessment?.metrics?.realData?.licenseInfo) {
      alert('No license data available for export');
      return;
    }

    const licenseInfo = assessment.metrics.realData.licenseInfo;
    const csvData = [
      ['License Type', 'SKU', 'Total Units', 'Assigned Units', 'Available Units', 'Utilization %', 'Status'],
      ...licenseInfo.licenseDetails.map((license: any) => [
        license.servicePlanName || license.skuPartNumber,
        license.skuPartNumber,
        license.totalUnits,
        license.assignedUnits,
        license.totalUnits - license.assignedUnits,
        license.totalUnits > 0 ? ((license.assignedUnits / license.totalUnits) * 100).toFixed(1) + '%' : '0%',
        license.capabilityStatus
      ])
    ];

    const csvContent = csvData.map(row => row.map((cell: any) => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `license-report-${assessment.tenantId}-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="assessment-results-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading assessment results...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="assessment-results-page">
        <div className="error-container">
          <div className="error-icon">⚠️</div>
          <h2>Error Loading Assessment</h2>
          <p>{error}</p>
          <button className="btn-primary" onClick={handleBackToDashboard}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="assessment-results-page">
        <div className="error-container">
          <div className="error-icon">📄</div>
          <h2>Assessment Not Found</h2>
          <p>The requested assessment could not be found.</p>
          <button className="btn-primary" onClick={handleBackToDashboard}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const hasLicenseData = assessment.metrics?.realData?.licenseInfo && 
                        assessment.metrics.realData.licenseInfo.licenseDetails &&
                        assessment.metrics.realData.licenseInfo.licenseDetails.length > 0;

  const hasSecureScoreData = assessment.metrics?.realData?.secureScore;

  return (
    <div className="assessment-results-page">
      <div className="results-header">
        <div className="header-content">
          <h1>📊 Assessment Results</h1>
          <div className="assessment-meta">
            <div className="meta-item">
              <strong>Assessment ID:</strong> {assessment.id}
            </div>
            <div className="meta-item">
              <strong>Tenant:</strong> {assessment.tenantName || assessment.tenantId}
            </div>
            <div className="meta-item">
              <strong>Date:</strong> {new Date(assessment.assessmentDate).toLocaleDateString()}
            </div>
            <div className="meta-item">
              <strong>Status:</strong> 
              <span className={`status-badge ${assessment.status}`}>
                {assessment.status}
              </span>
            </div>
          </div>
        </div>
        
        <div className="header-actions">
          <button className="btn-secondary" onClick={handleBackToDashboard}>
            ← Back to Dashboard
          </button>
          <button className="btn-secondary" onClick={handlePrintReport}>
            🖨️ Print Report
          </button>
          {hasLicenseData && (
            <button className="btn-secondary" onClick={handleExportReport}>
              📤 Export CSV
            </button>
          )}
        </div>
      </div>

      <div className="results-content">
        {/* Executive Summary */}
        <div className="executive-summary">
          <h2>Executive Summary</h2>
          <div className="summary-grid">
            <div className="summary-card overall">
              <div className="card-header">
                <h3>Overall Score</h3>
                <div className="score-circle">
                  <span className="score-value">{assessment.metrics.score.overall}%</span>
                </div>
              </div>
            </div>
            
            {hasLicenseData && (
              <div className="summary-card license">
                <div className="card-header">
                  <h3>License Utilization</h3>
                  <div className="score-circle">
                    <span className="score-value">{assessment.metrics.score.license}%</span>
                  </div>
                </div>
              </div>
            )}
            
            {hasSecureScoreData && (
              <div className="summary-card security">
                <div className="card-header">
                  <h3>Security Score</h3>
                  <div className="score-circle">
                    <span className="score-value">{assessment.metrics.score.secureScore}%</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* License Report */}
        {hasLicenseData && assessment.metrics.realData && (
          <div className="license-section">
            <LicenseReport
              licenseInfo={assessment.metrics.realData.licenseInfo}
              tenantName={assessment.tenantName || assessment.tenantId}
              assessmentDate={assessment.assessmentDate}
            />
          </div>
        )}

        {/* Security Score Section */}
        {hasSecureScoreData && assessment.metrics.realData && (
          <div className="security-section">
            <h2>🛡️ Security Score Analysis</h2>
            <div className="security-content">
              <div className="security-summary">
                <div className="security-score-display">
                  <span className="current-score">
                    {assessment.metrics.realData.secureScore.currentScore}
                  </span>
                  <span className="separator">/</span>
                  <span className="max-score">
                    {assessment.metrics.realData.secureScore.maxScore}
                  </span>
                  <span className="percentage">
                    ({assessment.metrics.realData.secureScore.percentage}%)
                  </span>
                </div>
                {assessment.metrics.realData.secureScore.summary && (
                  <p className="security-summary-text">
                    {assessment.metrics.realData.secureScore.summary}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Recommendations */}
        {assessment.metrics.recommendations && assessment.metrics.recommendations.length > 0 && (
          <div className="recommendations-section">
            <h2>💡 Recommendations</h2>
            <div className="recommendations-list">
              {assessment.metrics.recommendations.map((recommendation, index) => (
                <div key={index} className="recommendation-item">
                  <div className="recommendation-icon">💡</div>
                  <div className="recommendation-content">
                    <p>{recommendation}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Data Source Information */}
        {assessment.metrics.realData && (
          <div className="data-source-section">
            <h3>📋 Assessment Information</h3>
            <div className="data-source-info">
              <div className="info-item">
                <strong>Data Source:</strong> {assessment.metrics.realData.dataSource || 'Microsoft Graph API'}
              </div>
              {assessment.metrics.realData.lastUpdated && (
                <div className="info-item">
                  <strong>Data Last Updated:</strong> {new Date(assessment.metrics.realData.lastUpdated).toLocaleString()}
                </div>
              )}
              <div className="info-item">
                <strong>Assessment Type:</strong> Real-time data from Microsoft 365 tenant
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AssessmentResults;
