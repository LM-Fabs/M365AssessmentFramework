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
    // Use the Azure Functions API endpoint
    // In production, this would be your deployed Azure Functions URL
    // For local development with Azure Functions Core Tools, use localhost:7071
    this.baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:7071/api';
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
      const response = await axios.get(`${this.baseUrl}/customers`);
      return response.data.map((customer: any) => ({
        ...customer,
        createdDate: new Date(customer.createdDate),
        lastAssessmentDate: customer.lastAssessmentDate ? new Date(customer.lastAssessmentDate) : undefined
      }));
    } catch (error) {
      console.error('Error fetching customers:', error);
      // In development mode, if API is not available, throw error to trigger mock data
      throw new Error('API not available - using mock data');
    }
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
      // Use the main customers endpoint which handles both GET and POST
      const response = await axios.post(`${this.baseUrl}/customers`, customerData);
      
      // Handle the response from GetCustomers function
      if (response.data.success && response.data.data) {
        const customerResponse = response.data.data.customer;
        return {
          ...customerResponse,
          createdDate: new Date(customerResponse.createdDate),
          lastAssessmentDate: customerResponse.lastAssessmentDate ? new Date(customerResponse.lastAssessmentDate) : undefined
        };
      } else {
        throw new Error(response.data.error || 'Failed to create customer');
      }
    } catch (error) {
      console.error('Error creating customer:', error);
      
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
          throw new Error('Customer with this tenant already exists');
        }
        if (error.response?.data?.error) {
          throw new Error(error.response.data.error);
        }
      }
      throw new Error('Failed to create customer');
    }
  }

  /**
   * Update customer information
   */
  public async updateCustomer(customerId: string, updates: Partial<Customer>): Promise<Customer> {
    try {
      const response = await axios.patch(`${this.baseUrl}/customers/${customerId}`, updates);
      return {
        ...response.data,
        createdDate: new Date(response.data.createdDate),
        lastAssessmentDate: response.data.lastAssessmentDate ? new Date(response.data.lastAssessmentDate) : undefined
      };
    } catch (error) {
      console.error('Error updating customer:', error);
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