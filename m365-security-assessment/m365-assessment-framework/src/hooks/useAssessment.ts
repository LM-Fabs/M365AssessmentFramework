import { useState, useCallback, useEffect } from 'react';
import { Assessment } from '../models/Assessment';
import { AssessmentService } from '../services/assessmentService';
import { useMetrics } from './useMetrics';

interface UseAssessmentReturn {
  assessment: Assessment | null;
  loading: boolean;
  error: string | null;
  createAssessment: (tenantId: string) => Promise<void>;
  saveAssessment: () => Promise<void>;
  loadAssessment: (tenantId: string, assessmentId: string) => Promise<void>;
}

export const useAssessment = (): UseAssessmentReturn => {
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { fetchMetrics } = useMetrics();
  const assessmentService = AssessmentService.getInstance();

  const createAssessment = useCallback(async (tenantId: string) => {
    setLoading(true);
    setError(null);
    try {
      // Fetch initial metrics
      await fetchMetrics(tenantId);

      const newAssessment: Assessment = {
        id: crypto.randomUUID(),
        tenantId,
        assessmentDate: new Date(),
        assessor: {
          id: '', // Will be populated from authenticated user
          name: '',
          email: ''
        },
        metrics: await assessmentService.getSecurityMetrics(tenantId),
        recommendations: [],
        status: 'draft',
        lastModified: new Date()
      };

      setAssessment(newAssessment);
    } catch (error: any) {
      setError(error.message || 'Failed to create assessment');
    } finally {
      setLoading(false);
    }
  }, [fetchMetrics]);

  const saveAssessment = useCallback(async () => {
    if (!assessment) {
      setError('No assessment to save');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await assessmentService.saveAssessment(assessment);
      setAssessment({
        ...assessment,
        lastModified: new Date()
      });
    } catch (error: any) {
      setError(error.message || 'Failed to save assessment');
    } finally {
      setLoading(false);
    }
  }, [assessment]);

  const loadAssessment = useCallback(async (tenantId: string, assessmentId: string) => {
    setLoading(true);
    setError(null);
    try {
      const loadedAssessment = await assessmentService.getAssessment(tenantId, assessmentId);
      setAssessment(loadedAssessment);
    } catch (error: any) {
      setError(error.message || 'Failed to load assessment');
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    assessment,
    loading,
    error,
    createAssessment,
    saveAssessment,
    loadAssessment
  };
};