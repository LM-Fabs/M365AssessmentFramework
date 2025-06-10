// filepath: /m365-assessment-framework/m365-assessment-framework/src/pages/Settings.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { AssessmentService } from '../services/assessmentService';
import { MultiTenantGraphService } from '../services/multiTenantGraphService';
import { SECURITY_CATEGORIES } from '../shared/constants';
import './Settings.css';

interface TenantConfig {
  tenantId: string;
  tenantDomain: string;
  displayName: string;
}

const Settings = () => {
  const { isAuthenticated, account } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [step, setStep] = useState<'start-assessment' | 'tenant-login' | 'assessment-config'>('start-assessment');
  
  // Multi-tenant state
  const [tenantConfig, setTenantConfig] = useState<TenantConfig>({
    tenantId: '',
    tenantDomain: '',
    displayName: ''
  });
  const [appConfig, setAppConfig] = useState<any>(null);
  const [multiTenantService] = useState(() => new MultiTenantGraphService());

  const [formData, setFormData] = useState({
    assessmentName: 'Security Assessment',
    includedCategories: Object.keys(SECURITY_CATEGORIES),
    notificationEmail: account?.username || '',
    autoSchedule: false,
    scheduleFrequency: 'monthly'
  });

  const handleStartAssessment = async () => {
    setLoading(true);
    setError(null);

    try {
      // Create a generic multi-tenant application that can be used for any tenant
      const assessmentService = AssessmentService.getInstance();
      const appResponse = await assessmentService.createMultiTenantApp({
        targetTenantId: 'common', // Use 'common' for multi-tenant endpoint
        assessmentName: formData.assessmentName
      });

      setAppConfig(appResponse);
      
      // Immediately trigger the tenant selection login
      await handleTenantLogin(appResponse.clientId);
      
    } catch (error: any) {
      setError(error.message || 'Failed to initialize assessment application');
      setLoading(false);
    }
  };

  const handleTenantLogin = async (clientId: string) => {
    try {
      // Create a tenant-agnostic login URL that will allow the user to choose their tenant
      const loginUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
        new URLSearchParams({
          client_id: clientId,
          response_type: 'code',
          redirect_uri: window.location.origin + '/auth/callback',
          scope: 'https://graph.microsoft.com/.default',
          prompt: 'select_account', // Force account/tenant selection
          state: 'multi-tenant-assessment'
        }).toString();

      // Open the login in a popup window
      const popup = window.open(
        loginUrl,
        'tenant-login',
        'width=600,height=700,scrollbars=yes,resizable=yes'
      );

      // Listen for the authentication callback
      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed);
          // Handle the case where user closed the popup
          setError('Authentication was cancelled');
          setLoading(false);
        }
      }, 1000);

      // Listen for messages from the popup (if using postMessage pattern)
      const messageListener = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        
        if (event.data.type === 'TENANT_AUTH_SUCCESS') {
          clearInterval(checkClosed);
          popup?.close();
          window.removeEventListener('message', messageListener);
          
          // Extract tenant information from the authentication result
          const { tenantId, tenantDomain, userInfo } = event.data;
          
          setTenantConfig({
            tenantId: tenantId,
            tenantDomain: tenantDomain || `${tenantId}.onmicrosoft.com`,
            displayName: userInfo?.displayName || tenantDomain || tenantId
          });

          // Initialize the assessment context for the selected tenant
          initializeTenantAssessment(tenantId, clientId, tenantDomain);
        } else if (event.data.type === 'TENANT_AUTH_ERROR') {
          clearInterval(checkClosed);
          popup?.close();
          window.removeEventListener('message', messageListener);
          setError(event.data.error || 'Authentication failed');
          setLoading(false);
        }
      };

      window.addEventListener('message', messageListener);

    } catch (error: any) {
      setError(error.message || 'Failed to initiate tenant login');
      setLoading(false);
    }
  };

  const initializeTenantAssessment = async (tenantId: string, clientId: string, tenantDomain?: string) => {
    try {
      // Initialize tenant assessment context
      await multiTenantService.initializeTenantAssessment(
        tenantId,
        clientId,
        tenantDomain
      );

      setStep('assessment-config');
      setLoading(false);
    } catch (error: any) {
      setError(error.message || 'Failed to initialize tenant assessment');
      setLoading(false);
    }
  };

  const handleAssessmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Perform assessment using multi-tenant service
      const assessmentResult = await multiTenantService.performSecurityAssessment();
      
      setSuccess(true);
      setTimeout(() => {
        navigate('/dashboard', { 
          state: { 
            assessment: assessmentResult,
            tenantInfo: tenantConfig
          } 
        });
      }, 1500);
    } catch (error: any) {
      setError(error.message || 'Failed to perform security assessment');
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryToggle = (category: string) => {
    setFormData(prev => ({
      ...prev,
      includedCategories: prev.includedCategories.includes(category)
        ? prev.includedCategories.filter(c => c !== category)
        : [...prev.includedCategories, category]
    }));
  };

  if (!isAuthenticated) {
    return (
      <div className="authentication-prompt">
        <h2>Authentication Required</h2>
        <p>Please log in to access assessment settings.</p>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1>Multi-Tenant Assessment Settings</h1>
        <p>Configure and run security assessments across different Microsoft 365 tenants</p>
      </div>

      {/* Step 1: Start Assessment */}
      {step === 'start-assessment' && (
        <div className="settings-form">
          {error && <div className="error-message">{error}</div>}
          
          <div className="form-section">
            <h2>Start New Assessment</h2>
            <p>Click the button below to select a Microsoft 365 tenant and begin the security assessment process.</p>
            
            <div className="form-field">
              <label htmlFor="assessmentName">Assessment Name</label>
              <input
                type="text"
                id="assessmentName"
                value={formData.assessmentName}
                onChange={e => setFormData({...formData, assessmentName: e.target.value})}
                placeholder="Enter a name for this assessment"
                required
              />
              <small>This will be used to identify the assessment in your dashboard</small>
            </div>

            <div className="assessment-info">
              <h3>What happens next?</h3>
              <ul>
                <li>You'll be prompted to sign in to the Microsoft 365 tenant you want to assess</li>
                <li>The system will create a secure assessment application for that tenant</li>
                <li>You'll configure which security categories to include in the assessment</li>
                <li>The assessment will run and provide detailed security insights</li>
              </ul>
            </div>
          </div>

          <div className="form-actions">
            <button 
              onClick={handleStartAssessment}
              className="primary-button" 
              disabled={loading}
            >
              {loading ? 'Initializing...' : 'Select Tenant & Start Assessment'}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Assessment Configuration */}
      {step === 'assessment-config' && (
        <form className="settings-form" onSubmit={handleAssessmentSubmit}>
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">Assessment completed successfully. Redirecting...</div>}

          <div className="form-section">
            <h2>Assessment Configuration</h2>
            <p>Assessment will be performed for: <strong>{tenantConfig.displayName || tenantConfig.tenantDomain}</strong></p>
            
            <div className="tenant-info">
              <div className="info-item">
                <strong>Tenant ID:</strong> {tenantConfig.tenantId}
              </div>
              <div className="info-item">
                <strong>Domain:</strong> {tenantConfig.tenantDomain}
              </div>
            </div>
          </div>

          <div className="form-section">
            <h2>Assessment Scope</h2>
            <p>Select security categories to include in the assessment</p>
            <div className="categories-grid">
              {Object.entries(SECURITY_CATEGORIES).map(([key, label]) => (
                <label key={key} className={`category-checkbox ${formData.includedCategories.includes(key) ? 'selected' : ''}`}>
                  <input
                    type="checkbox"
                    checked={formData.includedCategories.includes(key)}
                    onChange={() => handleCategoryToggle(key)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="form-section">
            <h2>Notifications</h2>
            <div className="form-field">
              <label htmlFor="notificationEmail">Notification Email</label>
              <input
                type="email"
                id="notificationEmail"
                value={formData.notificationEmail}
                onChange={e => setFormData({...formData, notificationEmail: e.target.value})}
                required
              />
            </div>
          </div>

          <div className="form-section">
            <h2>Schedule</h2>
            <div className="schedule-options">
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={formData.autoSchedule}
                  onChange={e => setFormData({...formData, autoSchedule: e.target.checked})}
                />
                <span>Schedule Recurring Assessments</span>
              </label>

              {formData.autoSchedule && (
                <div className="form-field">
                  <label htmlFor="scheduleFrequency">Frequency</label>
                  <select
                    id="scheduleFrequency"
                    value={formData.scheduleFrequency}
                    onChange={e => setFormData({...formData, scheduleFrequency: e.target.value})}
                  >
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="form-actions">
            <button 
              type="button" 
              onClick={() => setStep('start-assessment')}
              className="secondary-button"
            >
              Start New Assessment
            </button>
            <button type="submit" className="primary-button" disabled={loading}>
              {loading ? 'Running Assessment...' : 'Run Security Assessment'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default Settings;