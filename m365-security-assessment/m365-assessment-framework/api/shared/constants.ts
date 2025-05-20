export const API_BASE_URL = process.env.API_BASE_URL || 'https://your-api-url.azurewebsites.net/api';

export const ASSESSMENT_STATUS = {
    PENDING: 'Pending',
    IN_PROGRESS: 'In Progress',
    COMPLETED: 'Completed',
    FAILED: 'Failed',
};

export const METRIC_CATEGORIES = {
    SECURITY: 'Security',
    COMPLIANCE: 'Compliance',
    PERFORMANCE: 'Performance',
};

export const RECOMMENDATION_TYPES = {
    SECURITY: 'Security Recommendation',
    COMPLIANCE: 'Compliance Recommendation',
    PERFORMANCE: 'Performance Recommendation',
};