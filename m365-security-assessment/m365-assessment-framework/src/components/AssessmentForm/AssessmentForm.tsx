import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { AssessmentService } from '../../services/assessmentService';
import { Assessment } from '../../models/Assessment';
import { BestPractice } from '../../types/bestPractices';
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

  // Get service instance
  const assessmentService = AssessmentService.getInstance();

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
        const practices = await assessmentService.getBestPractices();
        setBestPractices(practices);
      } catch (err) {
        console.error('Failed to load best practices:', err);
        setError('Failed to load assessment categories');
      }
    };

    loadBestPractices();
  }, [assessmentService]);

  // Load current assessment
  useEffect(() => {
    const loadCurrentAssessment = async () => {
      if (!user?.tenantId) return;

      try {
        const assessment = await assessmentService.getCurrentAssessment();
        if (assessment) {
          setCurrentAssessment(assessment);
          onCurrentAssessmentLoaded?.(assessment);
        }
      } catch (err) {
        console.error('Failed to load current assessment:', err);
      }
    };

    loadCurrentAssessment();
  }, [user?.tenantId, onCurrentAssessmentLoaded, assessmentService]);

  const handleCategoryToggle = (category: string) => {
    setFormData(prev => {
      const isSelected = prev.selectedCategories.includes(category);
      const selectedCategories = isSelected 
        ? prev.selectedCategories.filter(c => c !== category) 
        : [...prev.selectedCategories, category];

      return { ...prev, selectedCategories };
    });
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
      // Map form data to the service's expected format
      const assessmentData = {
        tenantName: formData.organizationName,
        categories: formData.selectedCategories,
        notificationEmail: formData.contactEmail,
        scheduling: {
          enabled: false,
          frequency: 'manual'
        }
      };

      const newAssessment = await assessmentService.createAssessment(assessmentData);
      
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

  return (
    <div className="assessment-form">
      <h2>Create New Assessment</h2>
      {error && <div className="error-message">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="organizationName">Organization Name</label>
          <input 
            type="text" 
            id="organizationName" 
            value={formData.organizationName} 
            onChange={e => setFormData({ ...formData, organizationName: e.target.value })} 
            required 
          />
        </div>
        <div className="form-group">
          <label htmlFor="contactEmail">Contact Email</label>
          <input 
            type="email" 
            id="contactEmail" 
            value={formData.contactEmail} 
            onChange={e => setFormData({ ...formData, contactEmail: e.target.value })} 
            required 
          />
        </div>
        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea 
            id="description" 
            value={formData.description} 
            onChange={e => setFormData({ ...formData, description: e.target.value })} 
          />
        </div>
        <div className="form-group">
          <label>Assessment Categories</label>
          <div className="category-list">
            {bestPractices.map(practice => (
              <div key={practice.category} className="category-item">
                <input 
                  type="checkbox" 
                  id={`category-${practice.category}`} 
                  checked={formData.selectedCategories.includes(practice.category)} 
                  onChange={() => handleCategoryToggle(practice.category)} 
                />
                <label htmlFor={`category-${practice.category}`}>{practice.title}</label>
              </div>
            ))}
          </div>
        </div>
        <button type="submit" className="submit-button" disabled={loading}>
          {loading ? 'Creating Assessment...' : 'Create Assessment'}
        </button>
      </form>
    </div>
  );
};

export default AssessmentForm;