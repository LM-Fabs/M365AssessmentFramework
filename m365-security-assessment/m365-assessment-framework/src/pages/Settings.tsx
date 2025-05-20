// filepath: /m365-assessment-framework/m365-assessment-framework/src/pages/Settings.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { AssessmentService } from '../services/assessmentService';
import { Assessment } from '../models/Assessment';
import { SECURITY_CATEGORIES } from '../shared/constants';

const Settings: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, account } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    tenantName: '',
    includedCategories: Object.keys(SECURITY_CATEGORIES),
    customThresholds: {
      identity: 90,
      dataProtection: 85,
      endpoint: 85,
      cloudApps: 85,
      informationProtection: 85,
      threatProtection: 90
    },
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

  const handleThresholdChange = (category: string, value: number) => {
    setFormData(prev => ({
      ...prev,
      customThresholds: {
        ...prev.customThresholds,
        [category]: value
      }
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
        thresholds: formData.customThresholds,
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
        {success && (
          <div className="success-message">
            Assessment created successfully! Redirecting to dashboard...
          </div>
        )}

        <div className="form-section">
          <h2>Tenant Information</h2>
          <div className="form-field">
            <label htmlFor="tenantName">Tenant Name</label>
            <input
              type="text"
              id="tenantName"
              value={formData.tenantName}
              onChange={e => setFormData(prev => ({ ...prev, tenantName: e.target.value }))}
              required
            />
          </div>
        </div>

        <div className="form-section">
          <h2>Assessment Scope</h2>
          <div className="categories-grid">
            {Object.entries(SECURITY_CATEGORIES).map(([key, label]) => (
              <div key={key} className="category-toggle">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.includedCategories.includes(key)}
                    onChange={() => handleCategoryToggle(key)}
                  />
                  <span>{label}</span>
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="form-section">
          <h2>Security Thresholds</h2>
          <div className="thresholds-grid">
            {Object.entries(formData.customThresholds).map(([category, value]) => (
              <div key={category} className="threshold-field">
                <label htmlFor={`threshold-${category}`}>
                  {SECURITY_CATEGORIES[category as keyof typeof SECURITY_CATEGORIES]}
                </label>
                <div className="threshold-input">
                  <input
                    type="range"
                    id={`threshold-${category}`}
                    min="0"
                    max="100"
                    value={value}
                    onChange={e => handleThresholdChange(category, parseInt(e.target.value))}
                  />
                  <span>{value}%</span>
                </div>
              </div>
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
              onChange={e => setFormData(prev => ({ ...prev, notificationEmail: e.target.value }))}
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
                onChange={e => setFormData(prev => ({ ...prev, autoSchedule: e.target.checked }))}
              />
              <span>Enable automatic assessments</span>
            </label>

            {formData.autoSchedule && (
              <div className="form-field">
                <label htmlFor="scheduleFrequency">Assessment Frequency</label>
                <select
                  id="scheduleFrequency"
                  value={formData.scheduleFrequency}
                  onChange={e => setFormData(prev => ({ ...prev, scheduleFrequency: e.target.value }))}
                >
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" disabled={loading}>
            {loading ? 'Creating Assessment...' : 'Start Assessment'}
          </button>
        </div>
      </form>

      <style>{`
        .settings-page {
          max-width: 800px;
          margin: 0 auto;
          padding: 24px;
        }

        .settings-header {
          margin-bottom: 32px;
        }

        .settings-header h1 {
          margin: 0 0 8px;
          color: #333;
        }

        .settings-header p {
          color: #666;
          font-size: 16px;
        }

        .settings-form {
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          padding: 24px;
        }

        .form-section {
          margin-bottom: 32px;
        }

        .form-section h2 {
          font-size: 18px;
          color: #333;
          margin: 0 0 16px;
        }

        .form-field {
          margin-bottom: 16px;
        }

        .form-field label {
          display: block;
          margin-bottom: 8px;
          color: #666;
        }

        input[type="text"],
        input[type="email"],
        select {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
        }

        .categories-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
        }

        .category-toggle label {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
        }

        .thresholds-grid {
          display: grid;
          gap: 16px;
        }

        .threshold-field label {
          display: block;
          margin-bottom: 8px;
          color: #666;
        }

        .threshold-input {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .threshold-input input[type="range"] {
          flex: 1;
        }

        .threshold-input span {
          min-width: 48px;
          text-align: right;
          color: #333;
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
          background: #dff6dd;
          color: #107c10;
          padding: 12px;
          border-radius: 4px;
          margin-bottom: 16px;
        }

        button[type="submit"] {
          background: #0078d4;
          color: white;
          padding: 12px 24px;
          border: none;
          border-radius: 4px;
          font-size: 16px;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        button[type="submit"]:hover {
          background: #006cbe;
        }

        button[type="submit"]:disabled {
          background: #ccc;
          cursor: not-allowed;
        }

        @media (max-width: 768px) {
          .settings-page {
            padding: 16px;
          }

          .categories-grid {
            grid-template-columns: 1fr;
          }

          .threshold-input {
            flex-direction: column;
            align-items: stretch;
          }

          .threshold-input span {
            text-align: left;
          }
        }
      `}</style>
    </div>
  );
};

export default Settings;