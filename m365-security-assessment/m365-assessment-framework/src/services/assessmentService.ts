import axios from 'axios';
import { Assessment } from '../models/Assessment';
import { Metrics } from '../models/Metrics';

interface ICreateAppResponse {
  applicationId: string;
  applicationObjectId: string;
  clientId: string;
  servicePrincipalId: string;
  tenantId: string;
  consentUrl: string;
  authUrl: string;
  redirectUri: string;
  permissions: string[];
}

interface SecureScoreData {
  currentScore: number;
  maxScore: number;
  percentage: number;
  controlScores: Array<{
    controlName: string;
    category: string;
    currentScore: number;
    maxScore: number;
    implementationStatus: string;
  }>;
  lastUpdated: Date;
}

interface LicenseData {
  totalLicenses: number;
  assignedLicenses: number;
  availableLicenses: number;
  licenseDetails: Array<{
    skuId: string;
    skuPartNumber: string;
    servicePlanName: string;
    totalUnits: number;
    assignedUnits: number;
    consumedUnits: number;
    capabilityStatus: string;
  }>;
}

interface BasicAssessmentData {
  tenantId: string;
  tenantDisplayName: string;
  assessmentDate: Date;
  secureScore: SecureScoreData;
  licenses: LicenseData;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
}

export class AssessmentService {
  private static instance: AssessmentService;
  private baseUrl: string;
  private isWarmed = false;

  private constructor() {
    // Use Azure Static Web Apps integrated API for production
    // This ensures we use the same-origin API endpoints that are part of the Static Web App
    if (process.env.NODE_ENV === 'development') {
      this.baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:7072/api';
    } else {
      this.baseUrl = '/api';
    }
    console.log('🔧 AssessmentService: Using API base URL:', this.baseUrl);
    console.log('🌍 AssessmentService: Environment:', process.env.NODE_ENV);
    
    // Warm up the API in production to reduce cold start impact
    if (process.env.NODE_ENV === 'production') {
      this.warmUpAPI();
    }
  }

  public static getInstance(): AssessmentService {
    if (!AssessmentService.instance) {
      AssessmentService.instance = new AssessmentService();
    }
    return AssessmentService.instance;
  }

  /**
   * Warm up the API to reduce cold start latency
   */
  private async warmUpAPI(): Promise<void> {
    if (this.isWarmed) return;
    
    try {
      console.log('🔥 AssessmentService: Warming up API...');
      await axios.head(`${this.baseUrl}/assessment/status`, {
        timeout: 5000,
        headers: { 'X-Warmup': 'true' }
      });
      this.isWarmed = true;
      console.log('✅ AssessmentService: API warmed up successfully');
    } catch (error) {
      console.log('🔥 AssessmentService: API warmup failed (expected for cold start)');
    }
  }

  /**
   * Create a multi-tenant Azure app registration for customer tenant authentication
   * This creates an app that can be consented to in the customer's tenant
   */
  public async createMultiTenantApp(data: {
    targetTenantId: string;
    targetTenantDomain?: string;
    assessmentName?: string;
  }): Promise<ICreateAppResponse> {
    try {
      console.log('🏢 AssessmentService: Creating multi-tenant app for tenant:', data.targetTenantId);
      
      const response = await this.retryApiCall(() =>
        axios.post(`${this.baseUrl}/enterprise-app/multi-tenant`, {
          targetTenantId: data.targetTenantId,
          targetTenantDomain: data.targetTenantDomain,
          assessmentName: data.assessmentName || 'M365 Security Assessment',
          requiredPermissions: [
            // Security assessment read permissions only
            'Organization.Read.All',          // Basic organization info
            'Reports.Read.All',              // Security reports
            'Directory.Read.All',            // User and group info  
            'Policy.Read.All',               // Security policies
            'SecurityEvents.Read.All',       // Security events
            'IdentityRiskyUser.Read.All',    // Risky users
            'DeviceManagementManagedDevices.Read.All', // Device compliance
            'AuditLog.Read.All',             // Audit logs
            'ThreatIndicators.Read.All'      // Threat intelligence
          ]
        }, {
          timeout: 30000,
          headers: { 'Content-Type': 'application/json' }
        })
      );

      console.log('✅ AssessmentService: Multi-tenant app created successfully');
      return response.data;
    } catch (error: any) {
      console.error('❌ AssessmentService: Error creating multi-tenant app:', error);
      
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 403) {
          throw new Error('Insufficient permissions to create Azure app registration. Admin consent required.');
        }
        if (error.response?.status === 409) {
          throw new Error('An app registration with this name already exists for this tenant.');
        }
        if (error.response?.data?.error) {
          throw new Error(error.response.data.error);
        }
      }
      
      throw new Error('Failed to create multi-tenant app registration');
    }
  }

  /**
   * Get the admin consent URL for the customer to approve the app
   */
  public getConsentUrl(clientId: string, tenantId: string, redirectUri?: string): string {
    const baseConsentUrl = 'https://login.microsoftonline.com';
    const scope = [
      'https://graph.microsoft.com/Organization.Read.All',
      'https://graph.microsoft.com/Reports.Read.All',
      'https://graph.microsoft.com/Directory.Read.All',
      'https://graph.microsoft.com/Policy.Read.All',
      'https://graph.microsoft.com/SecurityEvents.Read.All',
      'https://graph.microsoft.com/IdentityRiskyUser.Read.All',
      'https://graph.microsoft.com/DeviceManagementManagedDevices.Read.All',
      'https://graph.microsoft.com/AuditLog.Read.All',
      'https://graph.microsoft.com/ThreatIndicators.Read.All'
    ].join(' ');
    
    const consentUrl = `${baseConsentUrl}/${tenantId}/adminconsent` +
      `?client_id=${clientId}` +
      `&scope=${encodeURIComponent(scope)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri || window.location.origin + '/auth/consent-callback')}`;
    
    return consentUrl;
  }

  /**
   * Perform basic security assessment: Secure Score + License Information
   * This is the starting point for our assessments
   */
  public async performBasicAssessment(data: {
    customerId: string;
    tenantId: string;
    assessmentName: string;
    clientId: string;
    clientSecret?: string;
  }): Promise<BasicAssessmentData> {
    try {
      console.log('🔍 AssessmentService: Starting basic assessment for tenant:', data.tenantId);
      
      const response = await this.retryApiCall(() =>
        axios.post(`${this.baseUrl}/assessment/basic`, {
          customerId: data.customerId,
          tenantId: data.tenantId,
          assessmentName: data.assessmentName,
          clientId: data.clientId,
          clientSecret: data.clientSecret,
          assessmentScope: ['secureScore', 'licenses']
        }, {
          timeout: 60000, // 60 seconds for assessment
          headers: { 'Content-Type': 'application/json' }
        })
      );

      console.log('✅ AssessmentService: Basic assessment completed');
      
      const assessmentData: BasicAssessmentData = {
        ...response.data,
        assessmentDate: new Date(response.data.assessmentDate)
      };
      
      return assessmentData;
    } catch (error: any) {
      console.error('❌ AssessmentService: Error performing basic assessment:', error);
      
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          throw new Error('Authentication failed. Please ensure admin consent has been granted.');
        }
        if (error.response?.status === 403) {
          throw new Error('Insufficient permissions. Please grant the required Graph API permissions.');
        }
        if (error.response?.data?.error) {
          throw new Error(error.response.data.error);
        }
      }
      
      throw new Error('Failed to perform basic security assessment');
    }
  }

  /**
   * Get secure score details for a tenant
   */
  public async getSecureScore(tenantId: string, clientId: string): Promise<SecureScoreData> {
    try {
      console.log('🛡️ AssessmentService: Fetching secure score for tenant:', tenantId);
      
      const response = await this.retryApiCall(() =>
        axios.get(`${this.baseUrl}/assessment/${tenantId}/secure-score`, {
          params: { clientId },
          timeout: 30000
        })
      );

      return {
        ...response.data,
        lastUpdated: new Date(response.data.lastUpdated)
      };
    } catch (error: any) {
      console.error('❌ AssessmentService: Error fetching secure score:', error);
      throw new Error('Failed to fetch secure score data');
    }
  }

  /**
   * Get license information for a tenant
   */
  public async getLicenseInfo(tenantId: string, clientId: string): Promise<LicenseData> {
    try {
      console.log('📄 AssessmentService: Fetching license info for tenant:', tenantId);
      
      const response = await this.retryApiCall(() =>
        axios.get(`${this.baseUrl}/assessment/${tenantId}/licenses`, {
          params: { clientId },
          timeout: 30000
        })
      );

      return response.data;
    } catch (error: any) {
      console.error('❌ AssessmentService: Error fetching license info:', error);
      throw new Error('Failed to fetch license information');
    }
  }

  /**
   * Retry API calls with exponential backoff for better reliability
   */
  private async retryApiCall<T>(
    apiCall: () => Promise<T>, 
    maxRetries: number = 3, 
    isFirstCall: boolean = false
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 AssessmentService: API attempt ${attempt}/${maxRetries}`);
        
        if (attempt === 1 && isFirstCall && !this.isWarmed) {
          await this.warmUpAPI();
        }
        
        return await apiCall();
      } catch (error: any) {
        lastError = error;
        
        // Don't retry on client errors (4xx) except for 408 (timeout) and 429 (rate limit)
        if (axios.isAxiosError(error) && error.response?.status) {
          const status = error.response.status;
          if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
            console.warn(`🚫 AssessmentService: Client error ${status}, not retrying`);
            throw error;
          }
        }
        
        if (attempt === maxRetries) {
          console.error(`❌ AssessmentService: All ${maxRetries} attempts failed`);
          throw error;
        }
        
        const delay = Math.pow(2, attempt - 1) * 1000; // Exponential backoff
        console.log(`⏳ AssessmentService: Waiting ${delay}ms before retry ${attempt + 1}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError!;
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
      
      // Handle the structured API response format
      if (response.data && typeof response.data === 'object') {
        if (Array.isArray(response.data.data)) {
          return response.data.data;
        } else if (Array.isArray(response.data)) {
          return response.data;
        }
      }
      
      // Fallback to empty array if response is unexpected
      console.warn('AssessmentService: Unexpected response format from /assessments:', response.data);
      return [];
    } catch (error) {
      console.error('Error fetching assessments:', error);
      return []; // Return empty array instead of throwing to prevent UI crashes
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
      
      // Handle the structured API response format
      if (response.data && typeof response.data === 'object') {
        if (response.data.success && response.data.data !== undefined) {
          return response.data.data;
        } else if (response.data.data !== undefined) {
          return response.data.data;
        }
      }
      
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        // No current assessment found - this is not an error
        return null;
      }
      console.error('Error fetching current assessment:', error);
      return null; // Return null instead of throwing to prevent UI crashes
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
      console.log('Creating assessment for customer with URL:', `${this.baseUrl}/assessment/create`);
      console.log('Data being sent:', JSON.stringify(data, null, 2));
      
      const response = await axios.post(`${this.baseUrl}/assessment/create`, data);
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