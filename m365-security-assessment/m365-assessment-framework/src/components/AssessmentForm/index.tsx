import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useAssessment } from '../../hooks/useAssessment';
import { Assessment } from '../../models/Assessment';
import { Tenant } from '../../models/Tenant';
import { SECURITY_CATEGORIES } from '../../shared/constants';

interface AssessmentFormProps {
  tenantId: string;
  assessmentId?: string;
  onComplete?: (assessment: Assessment) => void;
  tenant?: Tenant;
  loading?: boolean;
}

const AssessmentForm: React.FC<AssessmentFormProps> = ({ 
  tenantId, 
  assessmentId, 
  onComplete,
  tenant,
  loading = false 
}) => {
  const { user } = useAuth();
  const { 
    assessment, 
    error, 
    createAssessment, 
    saveAssessment, 
    loadAssessment 
  } = useAssessment();

  const [isSaving, setIsSaving] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    Object.keys(SECURITY_CATEGORIES)
  );
  const [customScopes, setCustomScopes] = useState<string[]>([]);
  const [newScope, setNewScope] = useState('');

  useEffect(() => {
    const initializeAssessment = async () => {
      if (assessmentId) {
        await loadAssessment(tenantId, assessmentId);
      } else {
        await createAssessment(tenantId);
      }
    };

    initializeAssessment();
  }, [tenantId, assessmentId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assessment) return;

    setIsSaving(true);
    try {
      await saveAssessment();
      if (onComplete) {
        onComplete(assessment);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const newAssessment: Partial<Assessment> = {
      id: crypto.randomUUID(),
      tenantId: tenant?.id,
      assessmentDate: new Date(),
      assessor: {
        id: user?.id || '',
        name: user?.displayName || 'Unknown User',
        email: user?.email || ''
      },
      status: 'draft',
      lastModified: new Date(),
      recommendations: [],
      metrics: {
        identity: {
          mfaAdoption: 0,
          conditionalAccessPolicies: 0,
          passwordPolicies: {
            complexity: false,
            expiration: false,
            mfaRequired: false
          },
          adminAccounts: {
            total: 0,
            protected: 0
          },
          guestAccess: {
            total: 0,
            reviewed: 0
          }
        },
        dataProtection: {
          sensitivityLabels: {
            total: 0,
            inUse: 0
          },
          dlpPolicies: {
            total: 0,
            active: 0
          },
          sharingSettings: {
            external: false,
            anonymous: false,
            restrictions: []
          }
        },
        endpoint: {
          deviceCompliance: {
            total: 0,
            compliant: 0
          },
          defenderStatus: {
            enabled: false,
            upToDate: false
          },
          updateCompliance: 0
        },
        cloudApps: {
          securityPolicies: {
            total: 0,
            active: 0
          },
          oauthApps: {
            total: 0,
            reviewed: 0,
            highRisk: 0
          }
        },
        informationProtection: {
          aipLabels: {
            total: 0,
            applied: 0
          },
          encryption: {
            enabled: false,
            usage: 0
          }
        },
        threatProtection: {
          alerts: {
            high: 0,
            medium: 0,
            low: 0,
            resolved: 0
          },
          incidentResponse: {
            meanTimeToRespond: 0,
            openIncidents: 0
          }
        },
        score: {
          overall: 0,
          identity: 0,
          dataProtection: 0,
          endpoint: 0,
          cloudApps: 0,
          informationProtection: 0,
          threatProtection: 0
        },
        lastUpdated: new Date()
      }
    };

    try {
      setIsSaving(true);
      await saveAssessment();
      if (onComplete) {
        onComplete(newAssessment as Assessment);
      }
    } catch (error) {
      console.error('Failed to submit assessment:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCategoryToggle = (category: string) => {
    setSelectedCategories(prev => 
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const handleAddScope = () => {
    if (newScope && !customScopes.includes(newScope)) {
      setCustomScopes(prev => [...prev, newScope]);
      setNewScope('');
    }
  };

  const handleRemoveScope = (scope: string) => {
    setCustomScopes(prev => prev.filter(s => s !== scope));
  };

  if (loading) {
    return <div>Loading assessment...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  if (!assessment) {
    return <div>No assessment data available</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="assessment-form">
      <div className="form-section">
        <h3>Assessment Scope</h3>
        <p className="section-description">
          Select which security categories to include in the assessment
        </p>

        <div className="categories-grid">
          {Object.entries(SECURITY_CATEGORIES).map(([key, label]) => (
            <label key={key} className="category-checkbox">
              <input
                type="checkbox"
                checked={selectedCategories.includes(key)}
                onChange={() => handleCategoryToggle(key)}
                disabled={loading}
              />
              <span className="checkbox-label">{label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="form-section">
        <h3>Custom Scopes</h3>
        <p className="section-description">
          Add custom assessment scopes if needed
        </p>

        <div className="scope-input">
          <input
            type="text"
            value={newScope}
            onChange={(e) => setNewScope(e.target.value)}
            placeholder="Enter custom scope"
            disabled={loading}
          />
          <button
            type="button"
            onClick={handleAddScope}
            disabled={!newScope || loading}
            className="add-scope-btn"
          >
            Add
          </button>
        </div>

        {customScopes.length > 0 && (
          <div className="custom-scopes">
            {customScopes.map(scope => (
              <div key={scope} className="scope-tag">
                {scope}
                <button
                  type="button"
                  onClick={() => handleRemoveScope(scope)}
                  className="remove-scope"
                  disabled={loading}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {tenant && (
        <div className="form-section">
          <h3>Tenant Information</h3>
          <div className="tenant-info">
            <div className="tenant-detail">
              <span className="label">Name:</span>
              <span className="value">{tenant.name}</span>
            </div>
            <div className="tenant-detail">
              <span className="label">Security Score:</span>
              <span className="value">{tenant.securityScore}%</span>
            </div>
            <div className="tenant-detail">
              <span className="label">Last Assessment:</span>
              <span className="value">{tenant.lastAssessmentDate.toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      )}

      <div className="form-actions">
        <button 
          type="submit" 
          className="submit-btn"
          disabled={loading || selectedCategories.length === 0}
        >
          {loading ? 'Starting Assessment...' : 'Start Assessment'}
        </button>
      </div>

      <style>{`
        .assessment-form {
          background: white;
          border-radius: 8px;
          padding: 24px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .form-section {
          margin-bottom: 32px;
        }

        .form-section h3 {
          margin: 0 0 8px;
          color: #333;
        }

        .section-description {
          color: #666;
          margin: 0 0 16px;
          font-size: 14px;
        }

        .categories-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 16px;
        }

        .category-checkbox {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
        }

        .checkbox-label {
          color: #333;
        }

        .scope-input {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
        }

        .scope-input input {
          flex: 1;
          padding: 8px 12px;
          border: 1px solid #ccc;
          border-radius: 4px;
          font-size: 14px;
        }

        .add-scope-btn {
          padding: 8px 16px;
          background: #0078d4;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }

        .add-scope-btn:disabled {
          background: #ccc;
          cursor: not-allowed;
        }

        .custom-scopes {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .scope-tag {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          background: #f0f0f0;
          border-radius: 4px;
          font-size: 14px;
        }

        .remove-scope {
          background: none;
          border: none;
          color: #666;
          cursor: pointer;
          padding: 0 4px;
          font-size: 16px;
        }

        .tenant-info {
          background: #f8f8f8;
          padding: 16px;
          border-radius: 4px;
        }

        .tenant-detail {
          display: flex;
          margin-bottom: 8px;
        }

        .tenant-detail:last-child {
          margin-bottom: 0;
        }

        .tenant-detail .label {
          width: 100px;
          color: #666;
        }

        .tenant-detail .value {
          color: #333;
          font-weight: 500;
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
        }

        .submit-btn {
          padding: 12px 24px;
          background: #0078d4;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 16px;
          font-weight: 500;
          transition: background 0.2s;
        }

        .submit-btn:hover {
          background: #006abc;
        }

        .submit-btn:disabled {
          background: #ccc;
          cursor: not-allowed;
        }

        .error-message {
          color: #d83b01;
          padding: 10px;
          background: #fed9cc;
          border-radius: 4px;
          margin-bottom: 16px;
        }

        @media (max-width: 768px) {
          .assessment-form {
            padding: 16px;
          }

          .categories-grid {
            grid-template-columns: 1fr;
          }

          .scope-input {
            flex-direction: column;
          }

          .add-scope-btn {
            align-self: flex-start;
          }
        }
      `}</style>
    </form>
  );
};

export default AssessmentForm;