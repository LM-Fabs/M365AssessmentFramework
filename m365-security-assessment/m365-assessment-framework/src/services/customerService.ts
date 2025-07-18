import axios from 'axios';
import { Assessment } from '../models/Assessment';
import { LocalCustomerService } from './customerService.local';

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
  tenantId?: string;  // Optional tenant ID
  contactEmail?: string;
  notes?: string;
  skipAutoAppRegistration?: boolean;  // Flag to skip automatic app registration
}

export interface CustomerAssessmentSummary {
  customer: Customer;
  recentAssessments: Assessment[];
  lastScore?: number;
}

export class CustomerService {
  private static instance: CustomerService;
  private baseUrl: string;
  private isWarmed = false;
  private localService: LocalCustomerService;
  private useFreeMode = true; // Default to Free tier mode

  // Cache for prefetched data
  private customersCache: Customer[] | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_DURATION = 2 * 60 * 1000; // 2 minutes cache

  private constructor() {
    // Initialize local service for Free tier compatibility
    this.localService = LocalCustomerService.getInstance();
    
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
    
    console.log('🔧 CustomerService: Initialized for Free tier with localStorage');
    console.log('🌍 CustomerService: Environment:', process.env.NODE_ENV);
    
    // Test if we're on Free tier (no managed functions available)
    this.detectTierAndMode();
  }

  /**
   * Detect if we're on Free tier or Standard tier
   */
  private async detectTierAndMode(): Promise<void> {
    try {
      // Test with a real API call that should return JSON, not HTML
      const response = await fetch(`${this.baseUrl}/customers`, { 
        method: 'GET',
        cache: 'no-cache',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      // Check if we get a real API response (JSON) or the static app HTML
      const responseText = await response.text();
      
      // If we get HTML back, we're on Free tier (no managed functions)
      if (responseText.includes('<!doctype html>') || responseText.includes('<html')) {
        this.useFreeMode = true;
        console.log('🆓 CustomerService: Free tier detected - API returns HTML fallback, using localStorage mode');
      } else if (response.ok && (responseText.includes('"success"') || responseText.includes('"data"') || responseText === '[]')) {
        // We got actual API response (JSON)
        this.useFreeMode = false;
        console.log('✅ CustomerService: Standard tier detected - API returns JSON, using managed functions');
      } else {
        // Default to Free tier for any other cases
        this.useFreeMode = true;
        console.log('🆓 CustomerService: Free tier mode - uncertain API response, defaulting to localStorage');
      }
    } catch (error) {
      this.useFreeMode = true;
      console.log('🆓 CustomerService: Free tier mode - API call failed, using localStorage');
    }
  }

  public static getInstance(): CustomerService {
    if (!CustomerService.instance) {
      CustomerService.instance = new CustomerService();
    }
    return CustomerService.instance;
  }

  /**
   * Warm up the API to reduce cold start latency
   */
  private async warmUpAPI(): Promise<void> {
    if (this.isWarmed) return;
    
    try {
      console.log('🔥 CustomerService: Warming up API...');
      // Make a quick HEAD request to wake up the function
      await axios.head(`${this.baseUrl}/customers`, {
        timeout: 5000,
        headers: { 'X-Warmup': 'true' }
      });
      this.isWarmed = true;
      console.log('✅ CustomerService: API warmed up successfully');
    } catch (error) {
      // Warming up failed, but that's OK - the actual request will handle cold start
      console.log('🔥 CustomerService: API warmup failed (expected for cold start)');
    }
  }

  /**
   * Get all registered customers with their Azure app registrations
   */
  public async getCustomers(): Promise<Customer[]> {
    // Use local service for Free tier
    if (this.useFreeMode) {
      return this.localService.getCustomers();
    }

    // Standard tier logic - check cache first
    const cachedCustomers = this.getCachedCustomers();
    if (cachedCustomers) {
      return cachedCustomers;
    }

    try {
      console.log('🔍 CustomerService: Making API call to:', `${this.baseUrl}/customers`);
      
      // Use retry API call for reliable cold start handling
      const response = await this.retryApiCall(() => 
        axios.get(`${this.baseUrl}/customers`, {
          timeout: 45000, // 45 seconds for cold start
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        }),
        3, // Max 3 retries
        true // This is potentially the first call
      );
      
      console.log('📦 CustomerService: Raw API response:', response.data);
      console.log('📊 CustomerService: Response status:', response.status);
      
      // Handle the new API response format from GetCustomers function
      if (response.data.success && Array.isArray(response.data.data)) {
        const customers = response.data.data.map((customer: any) => ({
          ...customer,
          createdDate: new Date(customer.createdDate),
          lastAssessmentDate: customer.lastAssessmentDate ? new Date(customer.lastAssessmentDate) : undefined
        }));
        
        // Update cache
        this.customersCache = customers;
        this.cacheTimestamp = Date.now();
        console.log(`✅ CustomerService: Cached ${customers.length} customers`);
        
        return customers;
      } else if (Array.isArray(response.data)) {
        // Legacy format - direct array response
        const customers = response.data.map((customer: any) => ({
          ...customer,
          createdDate: new Date(customer.createdDate),
          lastAssessmentDate: customer.lastAssessmentDate ? new Date(customer.lastAssessmentDate) : undefined
        }));
        
        // Update cache
        this.customersCache = customers;
        this.cacheTimestamp = Date.now();
        console.log(`✅ CustomerService: Cached ${customers.length} customers (legacy format)`);
        
        return customers;
      } else {
        console.warn('Unexpected API response format:', response.data);
        return [];
      }
    } catch (error: any) {
      console.error('Error fetching customers:', error);
      
      // Always return empty array for customer list failures
      // This allows the UI to show empty state instead of crashing
      console.warn('⚠️ CustomerService: Returning empty array due to error');
      return [];
    }
  }

  /**
   * Prefetch customers data in the background
   */
  public async prefetchCustomers(): Promise<void> {
    // Use local service for Free tier
    if (this.useFreeMode) {
      return this.localService.prefetchCustomers();
    }

    // Standard tier logic
    try {
      console.log('🚀 CustomerService: Prefetching customers in background...');
      const customers = await this.getCustomers();
      this.customersCache = customers;
      this.cacheTimestamp = Date.now();
      console.log(`✅ CustomerService: Prefetched ${customers.length} customers`);
    } catch (error) {
      console.warn('⚠️ CustomerService: Prefetch failed:', error);
    }
  }

  /**
   * Get customers with cache support
   */
  private getCachedCustomers(): Customer[] | null {
    if (!this.customersCache) return null;
    
    const age = Date.now() - this.cacheTimestamp;
    if (age > this.CACHE_DURATION) {
      console.log('🗑️ CustomerService: Cache expired, clearing...');
      this.customersCache = null;
      this.cacheTimestamp = 0;
      return null;
    }
    
    console.log(`✅ CustomerService: Returning cached data (${age}ms old)`);
    return this.customersCache;
  }

  /**
   * Retry API calls with exponential backoff for better reliability
   * Enhanced for Azure Static Web Apps cold start scenarios
   */
  private async retryApiCall<T>(
    apiCall: () => Promise<T>, 
    maxRetries: number = 2, 
    isFirstCall: boolean = false
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 CustomerService: API attempt ${attempt}/${maxRetries}`);
        
        // For Azure Static Web Apps, first attempt might be slow due to cold start
        if (attempt === 1 && isFirstCall) {
          console.log('🧊 CustomerService: First call detected - allowing extra time for potential cold start');
          // Try to warm up the API first if it's not warmed up
          if (!this.isWarmed) {
            await this.warmUpAPI();
          }
        }
        
        return await apiCall();
      } catch (error: any) {
        lastError = error;
        
        // Special handling for timeout errors on first attempt (likely cold start)
        if (attempt === 1 && isFirstCall && (
          error.code === 'ECONNABORTED' || 
          error.message?.includes('timeout') ||
          error.message?.includes('Request timeout')
        )) {
          console.warn('❄️ CustomerService: First request timed out (likely cold start), retrying...');
          // Reset warm-up flag so we can try again
          this.isWarmed = false;
        }
        
        // Don't retry on client errors (4xx) except for 408 (timeout) and 429 (rate limit)
        if (axios.isAxiosError(error) && error.response?.status) {
          const status = error.response.status;
          if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
            console.warn(`🚫 CustomerService: Client error ${status}, not retrying`);
            throw error;
          }
        }
        
        if (attempt === maxRetries) {
          console.error(`❌ CustomerService: All ${maxRetries} attempts failed`);
          throw error;
        }
        
        // Use shorter delay for cold start recovery, longer for other errors
        const delay = isFirstCall && attempt === 1 ? 3000 : Math.pow(2, attempt - 1) * 1000;
        console.log(`⏳ CustomerService: Waiting ${delay}ms before retry ${attempt + 1}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError!;
  }

  /**
   * Get a specific customer by ID
   */
  public async getCustomer(customerId: string): Promise<Customer> {
    // Use local service for Free tier
    if (this.useFreeMode) {
      const customer = await this.localService.getCustomerById(customerId);
      if (!customer) {
        throw new Error('Customer not found');
      }
      return customer;
    }

    // Standard tier logic
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
    console.log('🔧 CustomerService: Create customer called with data:', customerData);
    console.log('🔧 CustomerService: Free mode status:', this.useFreeMode);
    
    // Use local service for Free tier
    if (this.useFreeMode) {
      console.log('🆓 CustomerService: Using LocalCustomerService for Free tier');
      return this.localService.createCustomer(customerData);
    }

    console.log('⚡ CustomerService: Using Standard tier API');
    
    // Standard tier logic
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
        
        // Clear cache since we added a new customer
        this.clearCache();
        
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
    // Use local service for Free tier
    if (this.useFreeMode) {
      return this.localService.deleteCustomer(customerId);
    }

    // Standard tier logic
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
    // Use local service for Free tier
    if (this.useFreeMode) {
      return this.localService.updateCustomer(customerId, updates);
    }

    // Standard tier logic
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
    // Use local service for Free tier
    if (this.useFreeMode) {
      return this.localService.getCustomersWithAssessments();
    }

    // Standard tier logic
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
    // Use local service for Free tier
    if (this.useFreeMode) {
      const customers = await this.localService.getCustomers();
      return customers.filter(customer => 
        customer.tenantName.toLowerCase().includes(query.toLowerCase()) ||
        customer.tenantDomain.toLowerCase().includes(query.toLowerCase())
      );
    }

    // Standard tier logic
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
    // Use local service for Free tier
    if (this.useFreeMode) {
      // In Free tier, we can't validate app registrations server-side
      // but we can check if the customer has the necessary Graph API permissions
      try {
        const customer = await this.localService.getCustomerById(customerId);
        return customer !== null && !!customer.applicationId && !!customer.clientId;
      } catch (error) {
        console.error('Error validating customer app registration in Free tier:', error);
        return false;
      }
    }

    // Standard tier logic
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
    // Use local service for Free tier
    if (this.useFreeMode) {
      // In Free tier, update customer status to inactive
      await this.localService.updateCustomer(customerId, { status: 'inactive' });
      return;
    }

    // Standard tier logic
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
    // Use local service for Free tier
    if (this.useFreeMode) {
      const assessments = await this.localService.getCustomerAssessments(customerId);
      return limit ? assessments.slice(0, limit) : assessments;
    }

    // Standard tier logic
    try {
      const response = await axios.get(`${this.baseUrl}/customers/${customerId}/assessments`, {
        params: limit ? { limit } : undefined
      });
      
      // Handle the structured API response format
      let assessments: any[] = [];
      if (response.data && typeof response.data === 'object') {
        if (Array.isArray(response.data.data)) {
          assessments = response.data.data;
        } else if (Array.isArray(response.data)) {
          assessments = response.data;
        }
      }
      
      return assessments.map((assessment: any) => ({
        ...assessment,
        assessmentDate: new Date(assessment.assessmentDate),
        lastModified: new Date(assessment.lastModified)
      }));
    } catch (error) {
      console.error('Error fetching customer assessments:', error);
      throw new Error('Failed to fetch customer assessments');
    }
  }

  /**
   * Clear the customer cache (called when data changes)
   */
  private clearCache(): void {
    console.log('🗑️ CustomerService: Clearing cache due to data change');
    this.customersCache = null;
    this.cacheTimestamp = 0;
  }
}