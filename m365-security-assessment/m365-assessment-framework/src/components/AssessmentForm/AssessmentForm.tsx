import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { createAssessment, getCurrentAssessment } from '../../services/assessmentService';
import { Assessment, AssessmentRequest } from '../../types/assessment';
import { BestPractice } from '../../types/bestPractices';
import { getBestPractices } from '../../services/assessmentService';
import './AssessmentForm.css';

interface AssessmentFormProps {
  onAssessmentCreated?: (assessment: Assessment) => void;
  onCurrentAssessmentLoaded?: (assessment: Assessment) => void;
}

interface FormData {
  organizationName: string;
  contactEmail: string;
  description: string;
  selectedCategories: string[];
}

const AssessmentForm: React.FC<AssessmentFormProps> = ({ 
  onAssessmentCreated, 
  onCurrentAssessmentLoaded 
}) => {
  const { user, isAuthenticated } = useAuth();
  const [formData, setFormData] = useState<FormData>({
    organizationName: '',
    contactEmail: user?.email || '',
    description: '',
    selectedCategories: []
  });
  const [bestPractices, setBestPractices] = useState<BestPractice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentAssessment, setCurrentAssessment] = useState<Assessment | null>(null);

  // Update email when user changes
  useEffect(() => {
    if (user?.email) {
      setFormData(prev => ({ ...prev, contactEmail: user.email }));
    }
  }, [user?.email]);

  // Load best practices on component mount
  useEffect(() => {
    const loadBestPractices = async () => {
      try {
        const practices = await getBestPractices();
        setBestPractices(practices);
      } catch (err) {
        console.error('Failed to load best practices:', err);
        setError('Failed to load assessment categories');
      }
    };

    loadBestPractices();
  }, []);

  // Load current assessment
  useEffect(() => {
    const loadCurrentAssessment = async () => {
      if (!user?.tenantId) return;

      try {
        const assessment = await getCurrentAssessment(user.tenantId);
        if (assessment) {
          setCurrentAssessment(assessment);
          onCurrentAssessmentLoaded?.(assessment);
        }
      } catch (err) {
        console.error('Failed to load current assessment:', err);
      }
    };

    loadCurrentAssessment();
  }, [user?.tenantId, onCurrentAssessmentLoaded]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCategoryChange = (categoryId: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      selectedCategories: checked
        ? [...prev.selectedCategories, categoryId]
        : prev.selectedCategories.filter(id => id !== categoryId)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isAuthenticated || !user) {
      setError('Please log in to create an assessment');
      return;
    }

    if (formData.selectedCategories.length === 0) {
      setError('Please select at least one assessment category');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const assessmentRequest: AssessmentRequest = {
        organizationName: formData.organizationName,
        contactEmail: formData.contactEmail,
        description: formData.description,
        categories: formData.selectedCategories,
        userId: user.id,
        tenantId: user.tenantId || ''
      };

      const newAssessment = await createAssessment(assessmentRequest);
      
      if (onAssessmentCreated) {
        onAssessmentCreated(newAssessment);
      }

      // Reset form
      setFormData({
        organizationName: '',
        contactEmail: user.email,
        description: '',
        selectedCategories: []
      });

    } catch (err) {
      console.error('Failed to create assessment:', err);
      setError(err instanceof Error ? err.message : 'Failed to create assessment');
    } finally {
      setLoading(false);
    }
  };

  const getUniqueCategories = () => {
    const categories = bestPractices.reduce((acc, practice) => {
      if (!acc.find(cat => cat.id === practice.category)) {
        acc.push({
          id: practice.category,
          name: practice.category.replace(/([A-Z])/g, ' $1').trim()
        });
      }
      return acc;
    }, [] as Array<{ id: string; name: string }>);
    
    return categories;
  };

  if (!isAuthenticated) {
    return (
      <div className="assessment-form-container">
        <div className="auth-required">
          <h2>Authentication Required</h2>
          <p>Please log in to create a new security assessment.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="assessment-form-container">
      <form onSubmit={handleSubmit} className="assessment-form">
        <h2>Create New Security Assessment</h2>
        
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {currentAssessment && (
          <div className="current-assessment-notice">
            <h3>Current Assessment</h3>
            <p>You have an ongoing assessment for {currentAssessment.organizationName}</p>
            <p>Status: {currentAssessment.status}</p>
            <p>Created: {new Date(currentAssessment.createdAt).toLocaleDateString()}</p>
          </div>
        )}

        <div className="form-group">
          <label htmlFor="organizationName">Organization Name *</label>
          <input
            type="text"
            id="organizationName"
            name="organizationName"
            value={formData.organizationName}
            onChange={handleInputChange}
            required
            placeholder="Enter your organization name"
          />
        </div>

        <div className="form-group">
          <label htmlFor="contactEmail">Contact Email *</label>
          <input
            type="email"
            id="contactEmail"
            name="contactEmail"
            value={formData.contactEmail}
            onChange={handleInputChange}
            required
            placeholder="Enter contact email"
          />
        </div>

        <div className="form-group">
          <label htmlFor="description">Assessment Description</label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            rows={3}
            placeholder="Describe the purpose and scope of this assessment (optional)"
          />
        </div>

        <div className="form-group">
          <label>Assessment Categories *</label>
          <div className="categories-grid">
            {getUniqueCategories().map(category => (
              <div key={category.id} className="category-checkbox">
                <input
                  type="checkbox"
                  id={category.id}
                  checked={formData.selectedCategories.includes(category.id)}
                  onChange={(e) => handleCategoryChange(category.id, e.target.checked)}
                />
                <label htmlFor={category.id}>{category.name}</label>
              </div>
            ))}
          </div>
          {formData.selectedCategories.length === 0 && (
            <p className="field-hint">Please select at least one category to assess</p>
          )}
        </div>

        <div className="form-actions">
          <button
            type="submit"
            disabled={loading || formData.selectedCategories.length === 0}
            className="submit-button"
          >
            {loading ? 'Creating Assessment...' : 'Create Assessment'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AssessmentForm;