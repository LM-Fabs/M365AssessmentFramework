import { useState, useCallback } from 'react';
import { Metrics } from '../models/Metrics';
import { AssessmentService } from '../services/assessmentService';

interface UseMetricsReturn {
  metrics: Metrics | null;
  loading: boolean;
  error: string | null;
  fetchMetrics: (tenantId: string) => Promise<void>;
  compareWithBestPractices: () => Promise<void>;
}

export const useMetrics = (): UseMetricsReturn => {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assessmentService = AssessmentService.getInstance();

  const fetchMetrics = useCallback(async (tenantId: string) => {
    setLoading(true);
    setError(null);
    try {
      const fetchedMetrics = await assessmentService.getSecurityMetrics(tenantId);
      setMetrics(fetchedMetrics);
    } catch (error: any) {
      setError(error.message || 'Failed to fetch metrics');
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const compareWithBestPractices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const bestPractices = await assessmentService.getBestPractices();
      // Implement comparison logic here
      return bestPractices;
    } catch (error: any) {
      setError(error.message || 'Failed to compare with best practices');
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    metrics,
    loading,
    error,
    fetchMetrics,
    compareWithBestPractices
  };
};