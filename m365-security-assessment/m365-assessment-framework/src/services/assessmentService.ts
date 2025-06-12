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
    // Use Azure Static Web Apps integrated API for production
    // This ensures we use the same-origin API endpoints that are part of the Static Web App
    this.baseUrl = process.env.REACT_APP_API_URL || '/api';
    console.log('🔧 AssessmentService: Using API base URL:', this.baseUrl);
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

  /**
   * Save assessment and store in history
   */
  public async saveAssessment(assessment: Assessment): Promise<Assessment> {
    try {
      const response = await fetch(`${this.baseUrl}/save-assessment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders()
        },
        body: JSON.stringify(assessment)
      });

      if (!response.ok) {
        throw new Error(`Failed to save assessment: ${response.statusText}`);
      }

      const savedAssessment = await response.json();

      // Store in assessment history for future comparisons
      try {
        const { AssessmentHistoryService } = await import('./assessmentHistoryService');
        const historyService = AssessmentHistoryService.getInstance();
        await historyService.storeAssessmentHistory(savedAssessment);
      } catch (historyError) {
        console.warn('Failed to store assessment history:', historyError);
        // Don't fail the save operation if history storage fails
      }

      return savedAssessment;
    } catch (error: any) {
      console.error('Error saving assessment:', error);
      throw new Error(error.message || 'Failed to save assessment');
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

  /**
   * Create assessment for an existing customer using their saved Azure app registration
   */
  public async createAssessmentForCustomer(data: {
    customerId: string;
    tenantId: string;
    assessmentName: string;
    includedCategories: string[];
    notificationEmail: string;
    autoSchedule: boolean;
    scheduleFrequency: string;
  }): Promise<Assessment> {
    try {
      console.log('Creating assessment for customer with URL:', `${this.baseUrl}/assessment/customer`);
      console.log('Data being sent:', JSON.stringify(data, null, 2));
      
      const response = await axios.post(`${this.baseUrl}/assessment/customer`, data);
      console.log('Create customer assessment response:', response.status, response.statusText);
      
      const assessment = response.data;

      // Store in assessment history for future comparisons
      try {
        const { AssessmentHistoryService } = await import('./assessmentHistoryService');
        const historyService = AssessmentHistoryService.getInstance();
        await historyService.storeAssessmentHistory(assessment);
      } catch (historyError) {
        console.warn('Failed to store assessment history:', historyError);
        // Don't fail the assessment creation if history storage fails
      }

      return assessment;
    } catch (error: any) {
      console.error('Error creating customer assessment:', error);
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

  private getAuthHeaders(): Record<string, string> {
    // Add authentication headers if available
    const token = localStorage.getItem('access_token');
    if (token) {
      return {
        'Authorization': `Bearer ${token}`
      };
    }
    return {};
  }
}