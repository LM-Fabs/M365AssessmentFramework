// filepath: /m365-assessment-framework/m365-assessment-framework/api/shared/types.ts

export interface Assessment {
    id: string;
    tenantId: string;
    date: string;
    score: number;
    metrics: Metrics;
    recommendations: string[];
}

export interface Metrics {
    securityBaseline: number;
    complianceScore: number;
    userTraining: number;
    incidentResponse: number;
}

export interface Tenant {
    id: string;
    name: string;
    createdDate: string;
    lastAssessmentDate: string;
    assessments: Assessment[];
}

// Customer management interfaces
export interface Customer {
    id: string;
    tenantId: string;
    tenantName: string;
    tenantDomain: string;
    applicationId: string;
    clientId: string;
    servicePrincipalId: string;
    createdDate: Date;
    lastAssessmentDate?: Date;
    totalAssessments: number;
    status: 'active' | 'inactive' | 'deleted';
    permissions: string[];
    contactEmail?: string;
    notes?: string;
    deletedDate?: Date;
}

export interface CreateCustomerRequest {
    tenantName: string;
    tenantDomain: string;
    tenantId?: string;  // Optional tenant ID
    contactEmail?: string;
    notes?: string;
    skipAutoAppRegistration?: boolean;  // Flag to skip automatic app registration
}

export interface AppRegistrationResult {
    applicationId: string;
    clientId: string;
    servicePrincipalId: string;
    clientSecret: string;
    consentUrl: string;
}

export interface GraphApiError {
    code: string;
    message: string;
    details?: any;
}

// Assessment-related interfaces for Cosmos DB integration
export interface AssessmentDocument {
    id: string;
    customerId: string;
    tenantId: string;
    assessmentName: string;
    createdDate: Date;
    completedDate?: Date;
    status: 'in-progress' | 'completed' | 'failed';
    scores: SecurityScores;
    findings: SecurityFinding[];
    recommendations: Recommendation[];
    metadata: AssessmentMetadata;
}

export interface SecurityScores {
    overall: number;
    identity: number;
    devices: number;
    data: number;
    infrastructure: number;
    apps: number;
}

export interface SecurityFinding {
    id: string;
    category: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    title: string;
    description: string;
    affectedResources: string[];
    remediation: string;
    status: 'open' | 'resolved' | 'acknowledged';
}

export interface Recommendation {
    id: string;
    title: string;
    description: string;
    category: string;
    priority: 'high' | 'medium' | 'low';
    effort: 'low' | 'medium' | 'high';
    impact: string;
    implementationSteps: string[];
    microsoftDocUrl?: string;
}

export interface AssessmentMetadata {
    version: string;
    assessmentType: string;
    dataCollectionDate: Date;
    permissions: string[];
    coverage: {
        identity: boolean;
        devices: boolean;
        data: boolean;
        infrastructure: boolean;
        apps: boolean;
    };
}