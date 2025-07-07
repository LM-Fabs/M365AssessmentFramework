import { Assessment } from '../models/Assessment';
import { SecurityImpact } from '../shared/constants';

interface ComparisonGap {
  category: string;
  metric: string;
  current: number;
  target: number;
  gap: number;
  impact: SecurityImpact;
}

export const compareWithBestPractices = (metrics: Assessment['metrics']): ComparisonGap[] => {
  const gaps: ComparisonGap[] = [];

  // License Utilization Comparison
  if (metrics.score.license < 85) {
    gaps.push({
      category: 'License Management',
      metric: 'License Utilization',
      current: metrics.score.license,
      target: 85,
      gap: 85 - metrics.score.license,
      impact: metrics.score.license < 60 ? SecurityImpact.High : SecurityImpact.Medium
    });
  }

  // Secure Score Comparison
  if (metrics.score.secureScore < 80) {
    gaps.push({
      category: 'Security Posture',
      metric: 'Microsoft Secure Score',
      current: metrics.score.secureScore,
      target: 80,
      gap: 80 - metrics.score.secureScore,
      impact: metrics.score.secureScore < 60 ? SecurityImpact.High : SecurityImpact.Medium
    });
  }

  return gaps;
};

export const compareAssessments = (
  currentAssessment: Assessment,
  previousAssessment: Assessment
): ComparisonGap[] => {
  const gaps: ComparisonGap[] = [];
  const scoreCategories: Array<'license' | 'secureScore'> = ['license', 'secureScore'];

  for (const category of scoreCategories) {
    const currentScore = currentAssessment.metrics.score[category];
    const previousScore = previousAssessment.metrics.score[category];
    const difference = currentScore - previousScore;

    if (Math.abs(difference) >= 10) {
      gaps.push({
        category: category === 'license' ? 'License Management' : 'Security Posture',
        metric: category === 'license' ? 'License Utilization' : 'Microsoft Secure Score',
        current: currentScore,
        target: previousScore,
        gap: difference,
        impact: Math.abs(difference) >= 20 ? SecurityImpact.High :
               Math.abs(difference) >= 15 ? SecurityImpact.Medium :
               SecurityImpact.Low
      });
    }
  }

  return gaps;
};

export const generateRecommendations = (gaps: ComparisonGap[]): Assessment['recommendations'] => {
  return gaps.map(gap => ({
    id: crypto.randomUUID(),
    category: gap.category,
    severity: gap.impact,
    title: `Improve ${gap.metric} in ${gap.category}`,
    description: `Current ${gap.metric} is at ${gap.current}%, which is ${Math.abs(gap.gap)}% ${gap.gap > 0 ? 'above' : 'below'} the ${gap.target}% target.`,
    impact: `${gap.impact} impact on overall security posture`,
    remediation: generateRemediation(gap),
    references: generateReferences(gap)
  }));
};

const generateRemediation = (gap: ComparisonGap): string => {
  const remediations: { [key: string]: string } = {
    'License Utilization': 'Review license assignments and optimize usage. Consider removing unused licenses or purchasing additional ones based on usage trends.',
    'Microsoft Secure Score': 'Implement the recommended security controls from Microsoft Secure Score to improve your security posture. Focus on high-impact controls first.'
  };

  return remediations[gap.metric] || 'Review current configuration and implement security best practices.';
};

const generateReferences = (gap: ComparisonGap): Array<{ title: string, url: string }> => {
  const references: { [key: string]: Array<{ title: string, url: string }> } = {
    'License Utilization': [
      {
        title: 'Manage Microsoft 365 licenses and subscriptions',
        url: 'https://docs.microsoft.com/en-us/microsoft-365/commerce/licenses/buy-licenses'
      }
    ],
    'Microsoft Secure Score': [
      {
        title: 'Microsoft Secure Score',
        url: 'https://docs.microsoft.com/en-us/microsoft-365/security/defender/microsoft-secure-score'
      }
    ]
  };

  return references[gap.metric] || [];
};