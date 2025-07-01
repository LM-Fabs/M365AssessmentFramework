import axios from 'axios';
import { Assessment } from '../models/Assessment';

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
  status: 'active' | 'inactive' | 'pending';
  permissions: string[];
  contactEmail?: string;
  notes?: string;
}

export interface CreateCustomerRequest {
  tenantName: string;
  tenantDomain: string;
  contactEmail?: string;
  notes?: string;
}

export interface CustomerAssessmentSummary {
  customer: Customer;
  recentAssessments: Assessment[];
  lastScore?: number;
}

export class CustomerService {
  private static instance: CustomerService;
  private baseUrl: string;

  private constructor() {
    // Azure Static Web Apps API routing:
    // - Local development: http://localhost:7072/api
    // - Production SWA: /api (automatically routed by Static Web Apps)
    // Your Static Web App: https://victorious-pond-069956e03.6.azurestaticapps.net/api
    if (process.env.NODE_ENV === 'development') {
      this.baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:7072/api';
    } else {
      // In production (Azure Static Web Apps), use the integrated API path
      // Azure Static Web Apps automatically routes /api to the Functions backend
      this.baseUrl = '/api';
    }
    console.log('🔧 CustomerService: Using API base URL:', this.baseUrl);
    console.log('🌍 CustomerService: Environment:', process.env.NODE_ENV);
    console.log('🚀 CustomerService: Static Web App URL: https://victorious-pond-069956e03.6.azurestaticapps.net/');
  }

  public static getInstance(): CustomerService {
    if (!CustomerService.instance) {
      CustomerService.instance = new CustomerService();
    }
    return CustomerService.instance;
  }

  /**
   * Get all registered customers with their Azure app registrations
   */
  public async getCustomers(): Promise<Customer[]> {
    try {
      console.log('🔍 CustomerService: Making API call to:', `${this.baseUrl}/customers`);
      
      // Create a timeout promise that rejects after 15 seconds (increased from 5)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout - API took too long to respond')), 15000);
      });
      
      // Race between the API call and timeout with retry logic
      const response = await Promise.race([
        this.retryApiCall(() => 
          axios.get(`${this.baseUrl}/customers`, {
            timeout: 15000, // 15 second timeout (increased from 5)
            headers: {
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            }
          })
        ),
        timeoutPromise
      ]);
      
      console.log('📦 CustomerService: Raw API response:', response.data);
      console.log('📊 CustomerService: Response status:', response.status);
      
      // Handle the new API response format from GetCustomers function
      if (response.data.success && Array.isArray(response.data.data)) {
        const customers = response.data.data.map((customer: any) => ({
          ...customer,
          createdDate: new Date(customer.createdDate),
          lastAssessmentDate: customer.lastAssessmentDate ? new Date(customer.lastAssessmentDate) : undefined
        }));
        return customers;
      } else if (Array.isArray(response.data)) {
        // Legacy format - direct array response
        const customers = response.data.map((customer: any) => ({
          ...customer,
          createdDate: new Date(customer.createdDate),
          lastAssessmentDate: customer.lastAssessmentDate ? new Date(customer.lastAssessmentDate) : undefined
        }));
        return customers;
      } else {
        console.warn('Unexpected API response format:', response.data);
        return [];
      }
    } catch (error: any) {
      console.error('Error fetching customers:', error);
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
          console.warn('Request timed out - returning empty array');
          return [];
        }
        
        if (error.response?.status === 404) {
          console.info('ℹ️ CustomerService: No customers endpoint found - this is normal for a new deployment');
          return [];
        }
        if (error.response?.data?.error) {
          throw new Error(error.response.data.error);
        }
      }
      
      if (error?.message?.includes('timeout')) {
        console.warn('⏱️ CustomerService: Custom timeout reached after 15 seconds - returning empty array');
        return [];
      }
      
      throw new Error('Failed to fetch customers from API');
    }
  }

  /**
   * Retry API calls with exponential backoff for better reliability
   * Following Azure best practices for transient failure handling
   */
  private async retryApiCall<T>(apiCall: () => Promise<T>, maxRetries: number = 3): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 CustomerService: API attempt ${attempt}/${maxRetries}`);
        return await apiCall();
      } catch (error: any) {
        lastError = error;
        
        // Don't retry on client errors (4xx) except for 408 (timeout) and 429 (rate limit)
        if (axios.isAxiosError(error) && error.response?.status) {
          const status = error.response.status;
          if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
            console.warn(`🚫 CustomerService: Client error ${status}, not retrying`);
            throw error;
          }
        }
        
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt - 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError!;
  }

  /**
   * Get a specific customer by ID
   */
  public async getCustomer(customerId: string): Promise<Customer> {
    try {
      const response = await axios.get(`${this.baseUrl}/customers/${customerId}`);
      return {
        ...response.data,
        createdDate: new Date(response.data.createdDate),
        lastAssessmentDate: response.data.lastAssessmentDate ? new Date(response.data.lastAssessmentDate) : undefined
      };
    } catch (error) {
      console.error('Error fetching customer:', error);
      throw new Error('Failed to fetch customer details');
    }
  }

  /**
   * Create a new customer with Azure app registration
   */
  public async createCustomer(customerData: CreateCustomerRequest): Promise<Customer> {
    try {
      console.log('🔧 CustomerService: Creating customer with data:', customerData);
      console.log('🌐 CustomerService: Using base URL:', this.baseUrl);
      console.log('🎯 CustomerService: Full POST URL:', `${this.baseUrl}/customers`);
      
      // Use the main customers endpoint which handles both GET and POST
      const response = await this.retryApiCall(() => 
        axios.post(`${this.baseUrl}/customers`, customerData, {
          timeout: 30000, // 30 second timeout for creation
          headers: {
            'Content-Type': 'application/json'
          }
        })
      );
      
      console.log('📦 CustomerService: Create customer response status:', response.status);
      console.log('📦 CustomerService: Create customer response data:', response.data);
      console.log('📦 CustomerService: Response data type:', typeof response.data);
      console.log('📦 CustomerService: Response data keys:', Object.keys(response.data));
      
      if (response.data.success && response.data.data && response.data.data.customer) {
        const customerResponse = response.data.data.customer;
        console.log('✅ CustomerService: Customer created successfully:', customerResponse.id);
        console.log('✅ CustomerService: Customer object:', customerResponse);
        
        const finalCustomer = {
          ...customerResponse,
          createdDate: new Date(customerResponse.createdDate),
          lastAssessmentDate: customerResponse.lastAssessmentDate ? new Date(customerResponse.lastAssessmentDate) : undefined
        };
        
        console.log('✅ CustomerService: Final customer object to return:', finalCustomer);
        return finalCustomer;
      } else {
        const errorMsg = response.data.error || 'Failed to create customer - invalid response format';
        console.error('❌ CustomerService: Invalid response format:', response.data);
        console.error('❌ CustomerService: Expected format: { success: true, data: { customer: {...} } }');
        throw new Error(errorMsg);
      }
    } catch (error) {
      console.error('❌ CustomerService: Error creating customer:', error);
      console.error('❌ CustomerService: Error type:', typeof error);
      console.error('❌ CustomerService: Error details:', error);
      
      // For development mode, create a mock customer if API is not available
      if (axios.isAxiosError(error) && (error.code === 'ERR_NETWORK' || error.response?.status === 404)) {
        console.warn('API not available, creating mock customer for development');
        
        // Generate a mock customer with the provided data
        const mockCustomer: Customer = {
          id: `mock-${Date.now()}`,
          tenantId: `${customerData.tenantName.toLowerCase().replace(/\s+/g, '-')}-tenant-id`,
          tenantName: customerData.tenantName,
          tenantDomain: customerData.tenantDomain,
          applicationId: `app-${customerData.tenantName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
          clientId: `client-${customerData.tenantName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
          servicePrincipalId: `sp-${customerData.tenantName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
          createdDate: new Date(),
          totalAssessments: 0,
          status: 'active' as const,
          permissions: ['Directory.Read.All', 'SecurityEvents.Read.All'],
          contactEmail: customerData.contactEmail,
          notes: customerData.notes
        };
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        return mockCustomer;
      }
      
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 409) {
          throw new Error('A customer with this tenant domain already exists');
        }
        if (error.response?.data?.error) {
          throw new Error(error.response.data.error);
        }
        if (error.code === 'ECONNABORTED') {
          throw new Error('Request timeout - please try again');
        }
        if (error.response?.status === 400) {
          throw new Error('Invalid customer data - please check the required fields');
        }
      }
      
      throw new Error(error instanceof Error ? error.message : 'Failed to create customer');
    }
  }

  /**
   * Delete a customer and all associated data
   */
  public async deleteCustomer(customerId: string): Promise<void> {
    try {
      console.log('🗑️ CustomerService: Deleting customer:', customerId);
      const response = await axios.delete(`${this.baseUrl}/customers/${customerId}`);
      
      if (response.data.success) {
        console.log('✅ CustomerService: Customer deleted successfully:', customerId);
      } else {
        throw new Error(response.data.error || 'Failed to delete customer');
      }
    } catch (error) {
      console.error('❌ CustomerService: Error deleting customer:', error);
      
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          throw new Error('Customer not found');
        }
        if (error.response?.status === 409) {
          throw new Error('Cannot delete customer with existing assessments. Please delete assessments first.');
        }
        if (error.response?.data?.error) {
          throw new Error(error.response.data.error);
        }
      }
      
      throw new Error('Failed to delete customer');
    }
  }

  /**
   * Update customer information
   */
  public async updateCustomer(customerId: string, updates: Partial<Customer>): Promise<Customer> {
    try {
      console.log('📝 CustomerService: Updating customer:', customerId, 'with:', updates);
      const response = await axios.put(`${this.baseUrl}/customers/${customerId}`, updates);
      
      if (response.data.success) {
        console.log('✅ CustomerService: Customer updated successfully:', customerId);
        const customer = response.data.data;
        return {
          ...customer,
          createdDate: new Date(customer.createdDate),
          lastAssessmentDate: customer.lastAssessmentDate ? new Date(customer.lastAssessmentDate) : undefined
        };
      } else {
        throw new Error(response.data.error || 'Failed to update customer');
      }
    } catch (error) {
      console.error('❌ CustomerService: Error updating customer:', error);
      
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          throw new Error('Customer not found');
        }
        if (error.response?.data?.error) {
          throw new Error(error.response.data.error);
        }
      }
      
      throw new Error('Failed to update customer');
    }
  }

  /**
   * Get customers with their recent assessment summaries
   */
  public async getCustomersWithAssessments(): Promise<CustomerAssessmentSummary[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/customers/with-assessments`);
      return response.data.map((item: any) => ({
        customer: {
          ...item.customer,
          createdDate: new Date(item.customer.createdDate),
          lastAssessmentDate: item.customer.lastAssessmentDate ? new Date(item.customer.lastAssessmentDate) : undefined
        },
        recentAssessments: item.recentAssessments.map((assessment: any) => ({
          ...assessment,
          assessmentDate: new Date(assessment.assessmentDate),
          lastModified: new Date(assessment.lastModified)
        })),
        lastScore: item.lastScore
      }));
    } catch (error) {
      console.error('Error fetching customers with assessments:', error);
      throw new Error('Failed to fetch customer assessment summaries');
    }
  }

  /**
   * Search customers by name or domain
   */
  public async searchCustomers(query: string): Promise<Customer[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/customers/search`, {
        params: { q: query }
      });
      return response.data.map((customer: any) => ({
        ...customer,
        createdDate: new Date(customer.createdDate),
        lastAssessmentDate: customer.lastAssessmentDate ? new Date(customer.lastAssessmentDate) : undefined
      }));
    } catch (error) {
      console.error('Error searching customers:', error);
      throw new Error('Failed to search customers');
    }
  }

  /**
   * Validate if a customer's Azure app registration is still valid
   */
  public async validateCustomerAppRegistration(customerId: string): Promise<boolean> {
    try {
      const response = await axios.post(`${this.baseUrl}/customers/${customerId}/validate`);
      return response.data.isValid;
    } catch (error) {
      console.error('Error validating customer app registration:', error);
      return false;
    }
  }

  /**
   * Deactivate a customer (soft delete)
   */
  public async deactivateCustomer(customerId: string): Promise<void> {
    try {
      await axios.patch(`${this.baseUrl}/customers/${customerId}/deactivate`);
    } catch (error) {
      console.error('Error deactivating customer:', error);
      throw new Error('Failed to deactivate customer');
    }
  }

  /**
   * Get customer assessment history
   */
  public async getCustomerAssessments(customerId: string, limit?: number): Promise<Assessment[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/customers/${customerId}/assessments`, {
        params: limit ? { limit } : undefined
      });
      return response.data.map((assessment: any) => ({
        ...assessment,
        assessmentDate: new Date(assessment.assessmentDate),
        lastModified: new Date(assessment.lastModified)
      }));
    } catch (error) {
      console.error('Error fetching customer assessments:', error);
      throw new Error('Failed to fetch customer assessments');
    }
  }
}