import React, { useState } from 'react';
import { AssessmentService } from '../../services/assessmentService';
import { LicenseReport } from '../LicenseReport';
import './BasicAssessment.css';

interface BasicAssessmentProps {
  customerId?: string;
  tenantId: string;
  tenantDomain?: string;
  onAssessmentComplete?: (assessment: any) => void;
}

interface AssessmentStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  result?: any;
}

export const BasicAssessment: React.FC<BasicAssessmentProps> = ({
  customerId,
  tenantId,
  tenantDomain,
  onAssessmentComplete
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [appRegistration, setAppRegistration] = useState<any>(null);
  const [assessmentResult, setAssessmentResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const [steps, setSteps] = useState<AssessmentStep[]>([
    {
      id: 'app-creation',
      title: 'Create Azure App Registration',
      description: 'Creating multi-tenant app for secure authentication',
      status: 'pending'
    },
    {
      id: 'admin-consent',
      title: 'Admin Consent Required',
      description: 'Customer admin must grant permissions to the app',
      status: 'pending'
    },
    {
      id: 'secure-score',
      title: 'Fetch Secure Score',
      description: 'Retrieving Microsoft Secure Score data',
      status: 'pending'
    },
    {
      id: 'license-info',
      title: 'Fetch License Information',
      description: 'Retrieving tenant license and subscription data',
      status: 'pending'
    }
  ]);

  const assessmentService = AssessmentService.getInstance();

  const updateStepStatus = (stepId: string, status: AssessmentStep['status'], result?: any) => {
    setSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, status, result } : step
    ));
  };

  const startAssessment = async () => {
    setIsRunning(true);
    setError(null);
    setCurrentStep(0);

    try {
      // Step 1: Create multi-tenant app registration
      updateStepStatus('app-creation', 'in-progress');
      
      const appData = await assessmentService.createMultiTenantApp({
        targetTenantId: tenantId,
        targetTenantDomain: tenantDomain,
        assessmentName: `Security Assessment - ${tenantDomain || tenantId}`
      });

      setAppRegistration(appData);
      updateStepStatus('app-creation', 'completed', appData);
      setCurrentStep(1);

      // Step 2: Show admin consent requirement
      updateStepStatus('admin-consent', 'in-progress');
      // This step requires manual admin action, so we'll show the consent URL
      updateStepStatus('admin-consent', 'completed', {
        consentUrl: appData.consentUrl,
        clientId: appData.clientId
      });
      setCurrentStep(2);

      // For demo purposes, we'll simulate the assessment steps
      // In production, these would only run after admin consent is granted

      // Step 3: Fetch Secure Score (mock for now)
      updateStepStatus('secure-score', 'in-progress');
      setCurrentStep(3);

      const secureScore = await assessmentService.getSecureScore(tenantId, appData.clientId);
      updateStepStatus('secure-score', 'completed', secureScore);

      // Step 4: Fetch License Info
      updateStepStatus('license-info', 'in-progress');
      setCurrentStep(4);

      const licenseInfo = await assessmentService.getLicenseInfo(tenantId, appData.clientId);
      updateStepStatus('license-info', 'completed', licenseInfo);

      // Complete assessment
      const finalResult = {
        tenantId,
        appRegistration: appData,
        secureScore,
        licenseInfo,
        assessmentDate: new Date(),
        status: 'completed'
      };

      setAssessmentResult(finalResult);
      if (onAssessmentComplete) {
        onAssessmentComplete(finalResult);
      }

    } catch (error: any) {
      console.error('Assessment failed:', error);
      setError(error.message || 'Assessment failed');
      
      // Mark current step as error
      if (currentStep < steps.length) {
        updateStepStatus(steps[currentStep].id, 'error');
      }
    } finally {
      setIsRunning(false);
    }
  };

  const getStepIcon = (status: AssessmentStep['status']) => {
    switch (status) {
      case 'completed':
        return '✅';
      case 'in-progress':
        return '🔄';
      case 'error':
        return '❌';
      default:
        return '⏳';
    }
  };

  const getStatusColor = (status: AssessmentStep['status']) => {
    switch (status) {
      case 'completed':
        return '#22c55e';
      case 'in-progress':
        return '#3b82f6';
      case 'error':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  return (
    <div className="basic-assessment">
      <div className="assessment-header">
        <h2>🛡️ Basic Security Assessment</h2>
        <p>Tenant: <strong>{tenantDomain || tenantId}</strong></p>
      </div>

      {!isRunning && !assessmentResult && (
        <div className="assessment-start">
          <p>This assessment will:</p>
          <ul>
            <li>Create a secure Azure app registration for authentication</li>
            <li>Fetch the current Microsoft Secure Score</li>
            <li>Retrieve license and subscription information</li>
            <li>Generate a basic security overview</li>
          </ul>
          <button 
            className="btn-primary assessment-start-btn"
            onClick={startAssessment}
            disabled={!tenantId}
          >
            Start Assessment
          </button>
        </div>
      )}

      {(isRunning || assessmentResult) && (
        <div className="assessment-progress">
          <h3>Assessment Progress</h3>
          <div className="steps-container">
            {steps.map((step, index) => (
              <div 
                key={step.id} 
                className={`step ${step.status} ${index === currentStep ? 'current' : ''}`}
              >
                <div className="step-header">
                  <span className="step-icon">{getStepIcon(step.status)}</span>
                  <span className="step-title">{step.title}</span>
                  <span 
                    className="step-status"
                    style={{ color: getStatusColor(step.status) }}
                  >
                    {step.status.toUpperCase()}
                  </span>
                </div>
                <div className="step-description">{step.description}</div>
                
                {/* Show special UI for admin consent step */}
                {step.id === 'admin-consent' && step.result && (
                  <div className="admin-consent-info">
                    <div className="consent-warning">
                      ⚠️ <strong>Admin Action Required</strong>
                    </div>
                    <p>The customer's global administrator must grant permissions to proceed:</p>
                    <a 
                      href={step.result.consentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="consent-link"
                    >
                      🔗 Open Admin Consent Page
                    </a>
                    <div className="consent-details">
                      <p><strong>App ID:</strong> {step.result.clientId}</p>
                      <p>After consent is granted, the assessment will continue automatically.</p>
                    </div>
                  </div>
                )}

                {/* Show results for completed steps */}
                {step.status === 'completed' && step.result && step.id !== 'admin-consent' && (
                  <div className="step-result">
                    <details>
                      <summary>View Details</summary>
                      <pre>{JSON.stringify(step.result, null, 2)}</pre>
                    </details>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="assessment-error">
          <h3>❌ Assessment Error</h3>
          <p>{error}</p>
          <button 
            className="btn-secondary"
            onClick={() => {
              setError(null);
              setAssessmentResult(null);
              setAppRegistration(null);
              setSteps(prev => prev.map(step => ({ ...step, status: 'pending' as const })));
            }}
          >
            Reset Assessment
          </button>
        </div>
      )}

      {assessmentResult && !error && (
        <div className="assessment-results">
          <h3>✅ Assessment Complete</h3>
          
          {/* Quick Summary Cards */}
          <div className="results-summary">
            <div className="result-card">
              <h4>🛡️ Secure Score</h4>
              <div className="score-display">
                <span className="score-value">
                  {assessmentResult.secureScore.currentScore}/{assessmentResult.secureScore.maxScore}
                </span>
                <span className="score-percentage">
                  ({assessmentResult.secureScore.percentage}%)
                </span>
              </div>
            </div>

            <div className="result-card">
              <h4>📄 License Summary</h4>
              <div className="license-display">
                <p><strong>Total:</strong> {assessmentResult.licenseInfo.totalLicenses}</p>
                <p><strong>Assigned:</strong> {assessmentResult.licenseInfo.assignedLicenses}</p>
                <p><strong>Available:</strong> {assessmentResult.licenseInfo.availableLicenses}</p>
                <p><strong>Utilization:</strong> {((assessmentResult.licenseInfo.assignedLicenses / assessmentResult.licenseInfo.totalLicenses) * 100).toFixed(1)}%</p>
              </div>
            </div>
          </div>

          {/* Detailed License Report */}
          {assessmentResult.licenseInfo && (
            <div className="detailed-license-section">
              <LicenseReport
                licenseInfo={assessmentResult.licenseInfo}
                tenantName={tenantDomain || tenantId}
                assessmentDate={new Date().toISOString()}
              />
            </div>
          )}

          <div className="assessment-actions">
            <button 
              className="btn-primary"
              onClick={() => window.location.reload()}
            >
              Run New Assessment
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BasicAssessment;
