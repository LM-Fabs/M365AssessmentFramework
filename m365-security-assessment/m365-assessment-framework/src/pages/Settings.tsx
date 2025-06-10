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
  const [step, setStep] = useState<'tenant-selection' | 'app-creation' | 'consent' | 'assessment-config'>('tenant-selection');
  
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

  const handleTenantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantConfig.tenantId || !tenantConfig.tenantDomain) {
      setError('Please provide both Tenant ID and Domain');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create multi-tenant application
      const assessmentService = AssessmentService.getInstance();
      const appResponse = await assessmentService.createMultiTenantApp({
        targetTenantId: tenantConfig.tenantId,
        targetTenantDomain: tenantConfig.tenantDomain,
        assessmentName: formData.assessmentName
      });

      setAppConfig(appResponse);
      setStep('consent');
    } catch (error: any) {
      setError(error.message || 'Failed to create multi-tenant application');
    } finally {
      setLoading(false);
    }
  };

  const handleConsentComplete = async () => {
    setLoading(true);
    try {
      // Initialize tenant assessment context
      await multiTenantService.initializeTenantAssessment(
        tenantConfig.tenantId,
        appConfig.clientId,
        tenantConfig.tenantDomain
      );

      setStep('assessment-config');
    } catch (error: any) {
      setError(error.message || 'Failed to initialize tenant assessment');
    } finally {
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

      {/* Step 1: Tenant Selection */}
      {step === 'tenant-selection' && (
        <form className="settings-form" onSubmit={handleTenantSubmit}>
          {error && <div className="error-message">{error}</div>}
          
          <div className="form-section">
            <h2>Target Tenant Configuration</h2>
            <p>Specify the Microsoft 365 tenant you want to assess</p>
            
            <div className="form-field">
              <label htmlFor="tenantId">Target Tenant ID</label>
              <input
                type="text"
                id="tenantId"
                value={tenantConfig.tenantId}
                onChange={e => setTenantConfig({...tenantConfig, tenantId: e.target.value})}
                placeholder="e.g., 12345678-1234-1234-1234-123456789abc"
                required
              />
              <small>The Azure AD Tenant ID of the organization to assess</small>
            </div>

            <div className="form-field">
              <label htmlFor="tenantDomain">Target Tenant Domain</label>
              <input
                type="text"
                id="tenantDomain"
                value={tenantConfig.tenantDomain}
                onChange={e => setTenantConfig({...tenantConfig, tenantDomain: e.target.value})}
                placeholder="e.g., contoso.onmicrosoft.com"
                required
              />
              <small>The primary domain of the target tenant</small>
            </div>

            <div className="form-field">
              <label htmlFor="displayName">Assessment Display Name</label>
              <input
                type="text"
                id="displayName"
                value={tenantConfig.displayName}
                onChange={e => setTenantConfig({...tenantConfig, displayName: e.target.value})}
                placeholder="e.g., Contoso Security Assessment"
              />
            </div>

            <div className="form-field">
              <label htmlFor="assessmentName">Assessment Name</label>
              <input
                type="text"
                id="assessmentName"
                value={formData.assessmentName}
                onChange={e => setFormData({...formData, assessmentName: e.target.value})}
                required
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="primary-button" disabled={loading}>
              {loading ? 'Creating Application...' : 'Create Assessment Application'}
            </button>
          </div>
        </form>
      )}

      {/* Step 2: Admin Consent */}
      {step === 'consent' && appConfig && (
        <div className="settings-form">
          <div className="form-section">
            <h2>Administrator Consent Required</h2>
            <p>An application has been created for tenant assessment. Administrative consent is required to proceed.</p>
            
            <div className="consent-info">
              <h3>Application Details</h3>
              <ul>
                <li><strong>Application ID:</strong> {appConfig.clientId}</li>
                <li><strong>Target Tenant:</strong> {tenantConfig.tenantDomain}</li>
                <li><strong>Required Permissions:</strong> Security data read access</li>
              </ul>
            </div>

            <div className="consent-actions">
              <a 
                href={appConfig.consentUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="primary-button"
              >
                Grant Admin Consent
              </a>
              <button 
                onClick={handleConsentComplete}
                className="secondary-button"
                disabled={loading}
              >
                {loading ? 'Initializing...' : 'Continue After Consent'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Assessment Configuration */}
      {step === 'assessment-config' && (
        <form className="settings-form" onSubmit={handleAssessmentSubmit}>
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">Assessment completed successfully. Redirecting...</div>}

          <div className="form-section">
            <h2>Assessment Scope</h2>
            <p>Select security categories to include in the assessment for {tenantConfig.tenantDomain}</p>
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
              onClick={() => setStep('tenant-selection')}
              className="secondary-button"
            >
              Back to Tenant Selection
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