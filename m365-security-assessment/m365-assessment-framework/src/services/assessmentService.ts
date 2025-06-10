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
    notificationEmail: string;
    scheduling?: {
      enabled: boolean;
      frequency: string;
    };
  }): Promise<Assessment> {
    try {
      // First try to access the test endpoint to verify API connectivity
      try {
        await axios.get(`${this.baseUrl}/assessment/test`);
      } catch (testError) {
        console.error('API test endpoint check failed, API connection might be down:', testError);
        // Continue with the creation attempt even if test fails
      }

      console.log('Attempting to create assessment with URL:', `${this.baseUrl}/assessment/create`);
      console.log('Data being sent:', JSON.stringify(data, null, 2));
      
      const response = await axios.post(`${this.baseUrl}/assessment/create`, data);
      console.log('Create assessment response:', response.status, response.statusText);
      return response.data;
    } catch (error: any) {
      console.error('Error creating assessment:', error);
      if (axios.isAxiosError(error)) {
        if (error.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          console.error('Response error data:', error.response.data);
          console.error('Response status:', error.response.status);
          console.error('Response headers:', error.response.headers);
        } else if (error.request) {
          // The request was made but no response was received
          console.error('No response received. Request details:', error.request);
        } else {
          // Something happened in setting up the request that triggered an Error
          console.error('Error message:', error.message);
        }
        console.error('Error config:', error.config);
      }
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

  public async getCurrentAssessment(): Promise<Assessment | null> {
    try {
      const response = await axios.get(`${this.baseUrl}/assessment/current`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        // No current assessment found - this is not an error
        return null;
      }
      console.error('Error fetching current assessment:', error);
      throw error;
    }
  }

  public async createMultiTenantApp(data: {
    targetTenantId: string;
    targetTenantDomain?: string;
    assessmentName?: string;
  }): Promise<any> {
    try {
      console.log('Creating multi-tenant application with URL:', `${this.baseUrl}/enterprise-app/multi-tenant`);
      console.log('Data being sent:', JSON.stringify(data, null, 2));
      
      const response = await axios.post(`${this.baseUrl}/enterprise-app/multi-tenant`, data);
      console.log('Create multi-tenant app response:', response.status, response.statusText);
      return response.data;
    } catch (error: any) {
      console.error('Error creating multi-tenant application:', error);
      if (axios.isAxiosError(error)) {
        if (error.response) {
          console.error('Response error data:', error.response.data);
          console.error('Response status:', error.response.status);
          console.error('Response headers:', error.response.headers);
        } else if (error.request) {
          console.error('No response received. Request details:', error.request);
        } else {
          console.error('Error message:', error.message);
        }
        console.error('Error config:', error.config);
      }
      throw error;
    }
  }
}