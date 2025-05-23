// filepath: /m365-assessment-framework/m365-assessment-framework/src/pages/Settings.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthenticatedTemplate, UnauthenticatedTemplate, useMsal } from '@azure/msal-react';
import { AssessmentService } from '../services/assessmentService';
import { SECURITY_CATEGORIES } from '../shared/constants';

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

      <style jsx>{`
        .settings-page {
          max-width: 800px;
          margin: 0 auto;
          padding: 2rem;
        }

        .settings-header {
          margin-bottom: 2rem;
          text-align: center;
        }

        .settings-header h1 {
          margin-bottom: 0.5rem;
          color: #1e293b;
        }

        .settings-header p {
          color: #64748b;
        }

        .settings-form {
          background-color: #fff;
          border-radius: 8px;
          padding: 2rem;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .form-section {
          margin-bottom: 2rem;
          padding-bottom: 2rem;
          border-bottom: 1px solid #e2e8f0;
        }

        .form-section:last-child {
          margin-bottom: 0;
          padding-bottom: 0;
          border-bottom: none;
        }

        .form-section h2 {
          font-size: 1.25rem;
          font-weight: 600;
          margin-bottom: 1.25rem;
          color: #1e293b;
        }

        .form-field {
          margin-bottom: 1.25rem;
        }

        .form-field label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 500;
          color: #475569;
        }

        .form-field input,
        .form-field select {
          width: 100%;
          padding: 0.625rem;
          border: 1px solid #cbd5e1;
          border-radius: 4px;
          font-size: 1rem;
        }

        .categories-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 1rem;
        }

        .category-checkbox {
          display: flex;
          align-items: center;
          padding: 0.75rem;
          border: 1px solid #cbd5e1;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .category-checkbox.selected {
          border-color: #3b82f6;
          background-color: #eff6ff;
        }

        .category-checkbox input {
          margin-right: 0.5rem;
        }

        .schedule-options {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .checkbox-field {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
        }

        .form-actions {
          margin-top: 32px;
          text-align: right;
        }

        .error-message {
          background: #fed9cc;
          color: #d83b01;
          padding: 12px;
          border-radius: 4px;
          margin-bottom: 16px;
        }

        .success-message {
          background: #d4edda;
          color: #155724;
          padding: 12px;
          border-radius: 4px;
          margin-bottom: 16px;
        }

        .primary-button {
          background-color: #3b82f6;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 10px 24px;
          font-size: 16px;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .primary-button:hover {
          background-color: #2563eb;
        }

        .primary-button:disabled {
          background-color: #94a3b8;
          cursor: not-allowed;
        }

        .authentication-prompt {
          text-align: center;
          margin: 4rem auto;
          max-width: 500px;
          padding: 2rem;
          background-color: #fff;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
      `}</style>
    </div>
  );
};

export default Settings;