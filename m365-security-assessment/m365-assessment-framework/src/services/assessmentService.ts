import axios from 'axios';
import { Assessment } from '../models/Assessment';
import { Metrics } from '../models/Metrics';

interface ICreateAppResponse {
  applicationId: string;
  applicationObjectId: string;
  clientId: string;
  servicePrincipalId: string;
  tenantId: string;
}

// Function to fetch assessments from the API
export const fetchAssessments = async (): Promise<Assessment[]> => {
    const response = await fetch('/api/GetAssessment');
    if (!response.ok) {
        throw new Error('Failed to fetch assessments');
    }
    return response.json();
};

// Function to save a new assessment
export const saveAssessment = async (assessment: Assessment): Promise<void> => {
    const response = await fetch('/api/SaveAssessment', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(assessment),
    });
    if (!response.ok) {
        throw new Error('Failed to save assessment');
    }
};

// Function to get security metrics
export const getSecurityMetrics = async (tenantId: string): Promise<Metrics> => {
    const response = await fetch(`/api/GetMetrics?tenantId=${tenantId}`);
    if (!response.ok) {
        throw new Error('Failed to fetch security metrics');
    }
    return response.json();
};

export class AssessmentService {
  private static instance: AssessmentService;
  private baseUrl: string;

  private constructor() {
    this.baseUrl = process.env.REACT_APP_API_URL || '/api';
  }

  public static getInstance(): AssessmentService {
    if (!AssessmentService.instance) {
      AssessmentService.instance = new AssessmentService();
    }
    return AssessmentService.instance;
  }

  public async createEnterpriseApplication(targetTenantId: string): Promise<ICreateAppResponse> {
    try {
      const response = await axios.post(`${this.baseUrl}/enterprise-app`, {
        targetTenantId
      });
      return response.data;
    } catch (error) {
      console.error('Error creating enterprise application:', error);
      throw error;
    }
  }

  public async saveAssessment(assessmentData: any): Promise<void> {
    try {
      await axios.post(`${this.baseUrl}/assessment`, assessmentData);
    } catch (error) {
      console.error('Error saving assessment:', error);
      throw error;
    }
  }

  public async getAssessment(tenantId: string, assessmentId: string): Promise<any> {
    try {
      const response = await axios.get(`${this.baseUrl}/assessment/${tenantId}/${assessmentId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching assessment:', error);
      throw error;
    }
  }

  public async getBestPractices(): Promise<any> {
    try {
      const response = await axios.get(`${this.baseUrl}/best-practices`);
      return response.data;
    } catch (error) {
      console.error('Error fetching best practices:', error);
      throw error;
    }
  }
}