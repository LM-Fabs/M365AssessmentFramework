// filepath: /m365-assessment-framework/m365-assessment-framework/src/pages/Settings.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthenticatedTemplate, UnauthenticatedTemplate, useMsal } from '@azure/msal-react';
import { AssessmentService } from '../services/assessmentService';
import { SECURITY_CATEGORIES } from '../shared/constants';
import './Settings.css';

const Settings = () => {
  const { accounts } = useMsal();
  const account = accounts[0] || null;
  const navigate = useNavigate();
  const isAuthenticated = account !== null;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    tenantName: '',
    includedCategories: Object.keys(SECURITY_CATEGORIES),
    notificationEmail: account?.username || '',
    autoSchedule: false,
    scheduleFrequency: 'monthly'
  });

  const handleCategoryToggle = (category: string) => {
    setFormData(prev => ({
      ...prev,
      includedCategories: prev.includedCategories.includes(category)
        ? prev.includedCategories.filter(c => c !== category)
        : [...prev.includedCategories, category]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const assessmentService = AssessmentService.getInstance();
      const assessment = await assessmentService.createAssessment({
        tenantName: formData.tenantName,
        categories: formData.includedCategories,
        notificationEmail: formData.notificationEmail,
        scheduling: {
          enabled: formData.autoSchedule,
          frequency: formData.scheduleFrequency
        }
      });

      setSuccess(true);
      setTimeout(() => {
        navigate('/dashboard', { state: { assessment } });
      }, 1500);
    } catch (error: any) {
      setError(error.message || 'Failed to create assessment');
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="authentication-prompt">
        <h2>Authentication Required</h2>
        <p>Please log in to access settings.</p>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1>Assessment Settings</h1>
        <p>Configure parameters for your security assessment</p>
      </div>

      <form className="settings-form" onSubmit={handleSubmit}>
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">Assessment created successfully. Redirecting...</div>}

        <div className="form-section">
          <h2>Basic Information</h2>
          <div className="form-field">
            <label htmlFor="tenantName">Tenant Name</label>
            <input
              type="text"
              id="tenantName"
              value={formData.tenantName}
              onChange={e => setFormData({...formData, tenantName: e.target.value})}
              required
            />
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
          <button type="submit" className="primary-button" disabled={loading}>
            {loading ? 'Creating...' : 'Create Assessment'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default Settings;