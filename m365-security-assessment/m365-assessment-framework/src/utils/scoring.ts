import { Metrics } from '../models/Metrics';
import { METRIC_WEIGHTS } from '../shared/constants';

export const calculateOverallScore = (metrics: Metrics): number => {
  const scores = {
    license: metrics.score.license,
    secureScore: metrics.score.secureScore
  };

  return Object.entries(scores).reduce((total, [category, score]) => {
    return total + score * METRIC_WEIGHTS[category as keyof typeof METRIC_WEIGHTS];
  }, 0);
};

export const calculateScoresFromMetrics = (metrics: Metrics): { overall: number; license: number; secureScore: number; } => {
  return {
    overall: calculateOverallScore(metrics),
    license: metrics.score.license,
    secureScore: metrics.score.secureScore
  };
};

export const getScoreColor = (score: number): string => {
  if (score >= 90) return '#107C10'; // Green
  if (score >= 70) return '#FFB900'; // Yellow
  return '#D83B01'; // Red
};

export const getScoreLabel = (score: number): string => {
  if (score >= 90) return 'Good';
  if (score >= 70) return 'Needs Attention';
  return 'Critical'
};