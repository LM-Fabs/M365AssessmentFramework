import { useState, useCallback } from 'react';
import { Assessment } from '../models/Assessment';
import { AssessmentService } from '../services/assessmentService';

interface ComparisonResult {
  category: string;
  metric: string;
  current: number;
  target: number;
  gap: number;
  impact: 'high' | 'medium' | 'low';
}

interface UseComparisonReturn {
  comparisonResults: ComparisonResult[] | null;
  loading: boolean;
  error: string | null;
  compareWithBestPractices: (assessment: Assessment) => Promise<void>;
  compareWithPrevious: (assessment: Assessment, previousAssessmentId: string) => Promise<void>;
}

export const useComparison = (): UseComparisonReturn => {
  const [comparisonResults, setComparisonResults] = useState<ComparisonResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assessmentService = AssessmentService.getInstance();

  const compareWithBestPractices = useCallback(async (assessment: Assessment) => {
    setLoading(true);
    setError(null);
    try {
      const bestPractices = await assessmentService.getBestPractices();
      const results: ComparisonResult[] = [];

      // Compare identity metrics
      results.push({
        category: 'Identity',
        metric: 'MFA Adoption',
        current: assessment.metrics.identity.mfaAdoption,
        target: bestPractices.identity.mfaAdoption,
        gap: bestPractices.identity.mfaAdoption - assessment.metrics.identity.mfaAdoption,
        impact: 'high'
      });

      // Compare data protection metrics
      results.push({
        category: 'Data Protection',
        metric: 'DLP Policies',
        current: assessment.metrics.dataProtection.dlpPolicies.active,
        target: bestPractices.dataProtection.dlpPolicies.minimum,
        gap: bestPractices.dataProtection.dlpPolicies.minimum - assessment.metrics.dataProtection.dlpPolicies.active,
        impact: 'high'
      });

      // Compare endpoint security metrics
      results.push({
        category: 'Endpoint Security',
        metric: 'Device Compliance',
        current: (assessment.metrics.endpoint.deviceCompliance.compliant / assessment.metrics.endpoint.deviceCompliance.total) * 100,
        target: 95, // Best practice target percentage
        gap: 95 - (assessment.metrics.endpoint.deviceCompliance.compliant / assessment.metrics.endpoint.deviceCompliance.total) * 100,
        impact: 'medium'
      });

      setComparisonResults(results);
    } catch (error: any) {
      setError(error.message || 'Failed to compare with best practices');
    } finally {
      setLoading(false);
    }
  }, []);

  const compareWithPrevious = useCallback(async (assessment: Assessment, previousAssessmentId: string) => {
    setLoading(true);
    setError(null);
    try {
      const previousAssessment = await assessmentService.getAssessment(assessment.tenantId, previousAssessmentId);
      const results: ComparisonResult[] = [];

      // Compare scores
      Object.entries(assessment.metrics.score).forEach(([category, score]) => {
        const previousScore = previousAssessment.metrics.score[category as keyof typeof previousAssessment.metrics.score];
        results.push({
          category: category.charAt(0).toUpperCase() + category.slice(1),
          metric: 'Score',
          current: score,
          target: previousScore,
          gap: score - previousScore,
          impact: Math.abs(score - previousScore) > 20 ? 'high' : 
                 Math.abs(score - previousScore) > 10 ? 'medium' : 'low'
        });
      });

      setComparisonResults(results);
    } catch (error: any) {
      setError(error.message || 'Failed to compare with previous assessment');
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    comparisonResults,
    loading,
    error,
    compareWithBestPractices,
    compareWithPrevious
  };
};