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

  public async getAssessment(tenantId: string, assessmentId: string): Promise<Assessment> {
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

  public async getSecurityMetrics(tenantId: string): Promise<Metrics> {
    try {
      const response = await axios.get(`${this.baseUrl}/GetMetrics?tenantId=${tenantId}`);
      if (!response.status || response.status !== 200) {
        throw new Error('Failed to fetch security metrics');
      }
      return response.data;
    } catch (error) {
      console.error('Error fetching security metrics:', error);
      throw error;
    }
  }

  public async getAssessments(): Promise<Assessment[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/assessments`);
      return response.data;
    } catch (error) {
      console.error('Error fetching assessments:', error);
      throw error;
    }
  }

  public async createAssessment(data: {
    tenantName: string;
    categories: string[];
    thresholds: Record<string, number>;
    notificationEmail: string;
    scheduling?: {
      enabled: boolean;
      frequency: string;
    };
  }): Promise<Assessment> {
    try {
      const response = await axios.post(`${this.baseUrl}/assessment/create`, data);
      return response.data;
    } catch (error) {
      console.error('Error creating assessment:', error);
      throw error;
    }
  }

  public async saveAssessment(assessment: Assessment): Promise<void> {
    try {
      await axios.post(`${this.baseUrl}/assessment/save`, assessment);
    } catch (error) {
      console.error('Error saving assessment:', error);
      throw error;
    }
  }
}