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
      const results: ComparisonResult[] = [];

      // Compare license utilization
      results.push({
        category: 'License',
        metric: 'License Utilization',
        current: assessment.metrics.score.license,
        target: 85, // Target 85% utilization
        gap: Math.max(0, 85 - assessment.metrics.score.license),
        impact: assessment.metrics.score.license < 60 ? 'high' : 
                assessment.metrics.score.license < 80 ? 'medium' : 'low'
      });

      // Compare secure score
      results.push({
        category: 'Secure Score',
        metric: 'Security Score',
        current: assessment.metrics.score.secureScore,
        target: 80, // Target 80% secure score
        gap: Math.max(0, 80 - assessment.metrics.score.secureScore),
        impact: assessment.metrics.score.secureScore < 60 ? 'high' : 
                assessment.metrics.score.secureScore < 75 ? 'medium' : 'low'
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