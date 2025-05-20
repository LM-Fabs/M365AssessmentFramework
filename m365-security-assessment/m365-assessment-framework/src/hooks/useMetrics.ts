import { useState, useCallback } from 'react';
import { Metrics } from '../models/Metrics';
import { AssessmentService } from '../services/assessmentService';
import { GraphService } from '../services/graphService';

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
  const graphService = GraphService.getInstance();

  const fetchMetrics = useCallback(async (tenantId: string) => {
    setLoading(true);
    setError(null);
    try {
      const securityMetrics = await graphService.getSecurityMetrics();
      setMetrics(securityMetrics);
    } catch (error: any) {
      setError(error.message || 'Failed to fetch security metrics');
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const compareWithBestPractices = useCallback(async () => {
    if (!metrics) {
      setError('No metrics available for comparison');
      return;
    }

    try {
      const bestPractices = await assessmentService.getBestPractices();
      // Comparison logic will be implemented here
      // This will calculate gaps and generate recommendations
    } catch (error: any) {
      setError(error.message || 'Failed to compare with best practices');
    }
  }, [metrics]);

  return {
    metrics,
    loading,
    error,
    fetchMetrics,
    compareWithBestPractices
  };
};