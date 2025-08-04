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

  // Enhanced cache for optimized performance
  private customersCache: Customer[] | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_DURATION = 10 * 60 * 1000; // 10 minutes cache for better UX
  private prefetchPromise: Promise<void> | null = null;
  
  // Performance optimization: lazy loading with pagination
  private lazyCache: Map<string, Customer> = new Map();
  private isInitializing = false;
  private initPromise: Promise<Customer[]> | null = null;
  
  // Fast initial load with minimal data
  private quickCache: Partial<Customer>[] | null = null;
  private quickCacheTimestamp: number = 0;
  
  // Assessment caching to avoid repeated API calls
  private assessmentCache: Map<string, any[]> = new Map();
  private assessmentCacheTimestamps: Map<string, number> = new Map();
  private readonly ASSESSMENT_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes for assessments
  private assessmentRequests: Map<string, Promise<any[]>> = new Map(); // Deduplication

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
    
    console.log('🔧 CustomerService: Initialized for Standard tier');
    console.log('🌍 CustomerService: Environment:', process.env.NODE_ENV);
  }

  public static getInstance(): CustomerService {
    if (!CustomerService.instance) {
      CustomerService.instance = new CustomerService();
    }
    return CustomerService.instance;
  }

  /**
   * Get all registered customers with optimized performance
   * Fast initial load with progressive enhancement
   */
  public async getCustomers(): Promise<Customer[]> {
    // Fast path: return cached data immediately if available
    const cachedCustomers = this.getCachedCustomers();
    if (cachedCustomers) {
      // Start background refresh if cache is getting stale (50% of cache duration)
      const cacheAge = Date.now() - this.cacheTimestamp;
      if (cacheAge > this.CACHE_DURATION * 0.5 && !this.prefetchPromise) {
        this.prefetchPromise = this.backgroundPrefetch();
      }
      return cachedCustomers;
    }

    // Prevent multiple simultaneous initialization calls
    if (this.isInitializing && this.initPromise) {
      console.log('� CustomerService: Waiting for existing initialization...');
      return await this.initPromise;
    }

    this.isInitializing = true;
    this.initPromise = this.fetchCustomersOptimized();
    
    try {
      const customers = await this.initPromise;
      return customers;
    } finally {
      this.isInitializing = false;
      this.initPromise = null;
    }
  }

  /**
   * Optimized customer fetching with progressive loading
   */
  private async fetchCustomersOptimized(): Promise<Customer[]> {
    try {
      console.log('🚀 CustomerService: Starting optimized fetch...');
      
      // Use optimized retry settings for faster response
      const response = await this.retryApiCall(() => 
        axios.get(`${this.baseUrl}/customers`, {
          timeout: 15000, // Reduced timeout for faster failures
          headers: {
            'Cache-Control': 'max-age=60', // Allow some caching
            'Accept': 'application/json',
            // Remove Accept-Encoding - browser handles this automatically
          },
          validateStatus: (status) => status < 500, // Accept all non-server errors
          // Disable axios compression handling to avoid conflicts
          decompress: false,
        }),
        2, // Reduce retries for faster response
        true // This is potentially the first call
      );
      
      console.log('� CustomerService: Response received, processing...');
      
      // Handle API response efficiently
      let customers: Customer[] = [];
      
      if (response.data?.success && Array.isArray(response.data.data)) {
        customers = this.processCustomerData(response.data.data);
      } else if (Array.isArray(response.data)) {
        customers = this.processCustomerData(response.data);
      } else {
        console.warn('⚠️ CustomerService: Unexpected response format, returning empty array');
        return [];
      }
      
      // Update all caches efficiently
      this.updateCaches(customers);
      
      console.log(`✅ CustomerService: Successfully loaded ${customers.length} customers`);
      return customers;
      
    } catch (error: any) {
      console.error('❌ CustomerService: Optimized fetch failed:', error);
      
      // Try a simple fallback request without any special headers
      if (error.code === 'ERR_NETWORK' || error.message?.includes('decoding')) {
        console.log('🔄 CustomerService: Trying fallback request...');
        try {
          const fallbackResponse = await axios.get(`${this.baseUrl}/customers`, {
            timeout: 10000,
            headers: { 'Accept': 'application/json' }
          });
          
          let customers: Customer[] = [];
          if (fallbackResponse.data?.success && Array.isArray(fallbackResponse.data.data)) {
            customers = this.processCustomerData(fallbackResponse.data.data);
            this.updateCaches(customers);
            console.log(`✅ CustomerService: Fallback successful (${customers.length} customers)`);
            return customers;
          }
        } catch (fallbackError) {
          console.warn('⚠️ CustomerService: Fallback also failed:', fallbackError);
        }
      }
      
      // Fast error handling - don't log excessive details in production
      if (process.env.NODE_ENV === 'development') {
        this.logDetailedError(error);
      }
      
      // Return empty array for graceful degradation
      return [];
    }
  }

  /**
   * Process customer data efficiently
   */
  private processCustomerData(rawData: any[]): Customer[] {
    return rawData.map((customer: any) => ({
      ...customer,
      createdDate: new Date(customer.createdDate),
      lastAssessmentDate: customer.lastAssessmentDate ? new Date(customer.lastAssessmentDate) : undefined
    }));
  }

  /**
   * Update all caches efficiently
   */
  private updateCaches(customers: Customer[]): void {
    // Main cache
    this.customersCache = customers;
    this.cacheTimestamp = Date.now();
    
    // Lazy cache for individual lookups
    this.lazyCache.clear();
    customers.forEach(customer => {
      this.lazyCache.set(customer.id, customer);
    });
    
    // Quick cache for minimal data
    this.quickCache = customers.map(c => ({
      id: c.id,
      tenantName: c.tenantName,
      tenantDomain: c.tenantDomain,
      status: c.status,
      totalAssessments: c.totalAssessments
    }));
    this.quickCacheTimestamp = Date.now();
  }

  /**
   * Detailed error logging for development
   */
  private logDetailedError(error: any): void {
    if (error.response) {
      console.error('Response Error:', {
        status: error.response.status,
        statusText: error.response.statusText,
        url: error.config?.url,
        data: error.response.data
      });
    } else if (error.request) {
      console.error('Network Error:', error.message);
    } else {
      console.error('Request Setup Error:', error.message);
    }
  }

  /**
   * Fast prefetch customers data in the background
   * Optimized for minimal impact on UI
   */
  public async prefetchCustomers(): Promise<void> {
    if (this.customersCache && (Date.now() - this.cacheTimestamp) < this.CACHE_DURATION * 0.5) {
      console.log('⚡ CustomerService: Skip prefetch - cache is fresh');
      return;
    }

    try {
      console.log('🚀 CustomerService: Starting background prefetch...');
      const customers = await this.fetchCustomersOptimized();
      console.log(`✅ CustomerService: Prefetched ${customers.length} customers`);
    } catch (error) {
      console.warn('⚠️ CustomerService: Background prefetch failed, will retry later:', error);
    }
  }

  /**
   * Optimized background prefetch with shorter timeout
   */
  private async backgroundPrefetch(): Promise<void> {
    try {
      console.log('🔄 CustomerService: Background refresh started...');
      
      const response = await axios.get(`${this.baseUrl}/customers`, {
        timeout: 8000, // Very short timeout for background refresh
        headers: {
          'Cache-Control': 'max-age=300', // Allow 5-minute cache
          // Remove Accept-Encoding - browser handles this automatically
        },
      });

      let customers: Customer[] = [];
      if (response.data?.success && Array.isArray(response.data.data)) {
        customers = this.processCustomerData(response.data.data);
      } else if (Array.isArray(response.data)) {
        customers = this.processCustomerData(response.data);
      }
      
      if (customers.length > 0) {
        this.updateCaches(customers);
        console.log(`✅ CustomerService: Background refresh completed (${customers.length} customers)`);
      }
    } catch (error) {
      console.warn('⚠️ CustomerService: Background refresh failed, will retry later:', error);
    } finally {
      this.prefetchPromise = null;
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
   * Optimized retry API calls with faster failure detection
   */
  private async retryApiCall<T>(
    apiCall: () => Promise<T>, 
    maxRetries: number = 2, 
    isFirstCall: boolean = false
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 1) {
          console.log(`🔄 CustomerService: Retry attempt ${attempt}/${maxRetries}`);
        }
        
        return await apiCall();
      } catch (error: any) {
        lastError = error;
        
        // Fast failure for client errors - don't waste time retrying
        if (axios.isAxiosError(error) && error.response?.status) {
          const status = error.response.status;
          if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
            console.warn(`🚫 CustomerService: Client error ${status}, failing fast`);
            throw error;
          }
        }
        
        // Handle content decoding errors specifically
        if (error.code === 'ERR_NETWORK' || error.message?.includes('ERR_CONTENT_DECODING_FAILED')) {
          console.warn('🔧 CustomerService: Content decoding error, trying without compression headers');
          // Don't retry decoding errors immediately - they usually won't resolve
          if (attempt === 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
            continue;
          }
        }
        
        if (attempt === maxRetries) {
          console.error(`❌ CustomerService: All ${maxRetries} attempts failed`);
          throw error;
        }
        
        // Optimized delay strategy - much faster for better UX
        let delay: number;
        if (isFirstCall && attempt === 1) {
          delay = 1500; // Shorter cold start delay
        } else {
          delay = Math.min(1000 * attempt, 3000); // Cap at 3s max
        }
        
        console.log(`⏳ CustomerService: Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError!;
  }

  /**
   * Get a specific customer by ID with optimized caching
   */
  public async getCustomer(customerId: string): Promise<Customer> {
    // Check lazy cache first for instant response
    if (this.lazyCache.has(customerId)) {
      console.log('⚡ CustomerService: Customer found in lazy cache');
      return this.lazyCache.get(customerId)!;
    }

    // Check main cache
    if (this.customersCache) {
      const customer = this.customersCache.find(c => c.id === customerId);
      if (customer) {
        this.lazyCache.set(customerId, customer);
        return customer;
      }
    }

    // Fallback to API call
    try {
      const response = await axios.get(`${this.baseUrl}/customers/${customerId}`, {
        timeout: 10000, // Shorter timeout for individual customer
      });
      
      const customer = {
        ...response.data,
        createdDate: new Date(response.data.createdDate),
        lastAssessmentDate: response.data.lastAssessmentDate ? new Date(response.data.lastAssessmentDate) : undefined
      };
      
      // Cache for future use
      this.lazyCache.set(customerId, customer);
      return customer;
    } catch (error) {
      console.error('❌ CustomerService: Error fetching customer:', error);
      throw new Error('Failed to fetch customer details');
    }
  }

  /**
   * Create a new customer with Azure app registration
   */
  public async createCustomer(customerData: CreateCustomerRequest): Promise<Customer> {
    console.log('🔧 CustomerService: Create customer called with data:', customerData);
    
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
    try {
      console.log('🗑️ CustomerService: Deleting customer:', customerId);
      const response = await axios.delete(`${this.baseUrl}/customers?id=${customerId}`);
      
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
   * Get customer assessment history with caching and deduplication
   */
  public async getCustomerAssessments(customerId: string, limit?: number): Promise<Assessment[]> {
    const cacheKey = `${customerId}-${limit || 'all'}`;
    
    // Check cache first
    const cached = this.assessmentCache.get(cacheKey);
    const cacheTime = this.assessmentCacheTimestamps.get(cacheKey);
    
    if (cached && cacheTime && (Date.now() - cacheTime) < this.ASSESSMENT_CACHE_DURATION) {
      console.log(`⚡ CustomerService: Returning cached assessments for ${customerId} (${cached.length} items)`);
      return cached;
    }
    
    // Check if request is already in progress (deduplication)
    if (this.assessmentRequests.has(cacheKey)) {
      console.log(`🔄 CustomerService: Waiting for existing assessment request for ${customerId}`);
      return await this.assessmentRequests.get(cacheKey)!;
    }
    
    // Start new request
    const requestPromise = this.fetchCustomerAssessments(customerId, limit);
    this.assessmentRequests.set(cacheKey, requestPromise);
    
    try {
      const assessments = await requestPromise;
      
      // Cache the results
      this.assessmentCache.set(cacheKey, assessments);
      this.assessmentCacheTimestamps.set(cacheKey, Date.now());
      
      console.log(`✅ CustomerService: Cached ${assessments.length} assessments for ${customerId}`);
      return assessments;
    } finally {
      // Clean up request tracking
      this.assessmentRequests.delete(cacheKey);
    }
  }
  
  /**
   * Internal method to fetch customer assessments
   */
  private async fetchCustomerAssessments(customerId: string, limit?: number): Promise<Assessment[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/customers/${customerId}/assessments`, {
        params: limit ? { limit } : undefined,
        timeout: 8000, // Shorter timeout for assessments
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
      console.error('❌ CustomerService: Error fetching customer assessments:', error);
      throw new Error('Failed to fetch customer assessments');
    }
  }

  /**
   * Clear all caches when data changes
   */
  private clearCache(): void {
    console.log('🗑️ CustomerService: Clearing all caches due to data change');
    this.customersCache = null;
    this.cacheTimestamp = 0;
    this.quickCache = null;
    this.quickCacheTimestamp = 0;
    this.lazyCache.clear();
    this.assessmentCache.clear();
    this.assessmentCacheTimestamps.clear();
    this.assessmentRequests.clear();
  }

  /**
   * Clear assessment cache for a specific customer
   */
  public clearCustomerAssessmentCache(customerId: string): void {
    console.log(`🗑️ CustomerService: Clearing assessment cache for customer ${customerId}`);
    const keysToDelete: string[] = [];
    this.assessmentCache.forEach((_, key) => {
      if (key.startsWith(customerId)) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => {
      this.assessmentCache.delete(key);
      this.assessmentCacheTimestamps.delete(key);
    });
  }

  /**
   * Prefetch assessments for a customer in the background
   */
  public async prefetchCustomerAssessments(customerId: string): Promise<void> {
    try {
      console.log(`🚀 CustomerService: Prefetching assessments for ${customerId}...`);
      await this.getCustomerAssessments(customerId, 10); // Get recent 10 assessments
    } catch (error) {
      console.warn(`⚠️ CustomerService: Assessment prefetch failed for ${customerId}:`, error);
    }
  }

  /**
   * Get minimal customer data for fast initial display
   * Returns only essential fields for quick loading
   */
  public async getCustomersQuick(): Promise<Partial<Customer>[]> {
    // Check quick cache first
    if (this.quickCache && (Date.now() - this.quickCacheTimestamp) < this.CACHE_DURATION) {
      console.log('⚡ CustomerService: Returning quick cache data');
      return this.quickCache;
    }

    // If main cache exists, use it
    if (this.customersCache) {
      const quickData = this.customersCache.map(c => ({
        id: c.id,
        tenantName: c.tenantName,
        tenantDomain: c.tenantDomain,
        status: c.status,
        totalAssessments: c.totalAssessments,
        createdDate: c.createdDate,
        lastAssessmentDate: c.lastAssessmentDate
      }));
      
      this.quickCache = quickData;
      this.quickCacheTimestamp = Date.now();
      return quickData;
    }

    // Use optimized quick API endpoint
    try {
      console.log('🚀 CustomerService: Making quick API call...');
      
      const response = await axios.get(`${this.baseUrl}/customers?quick=true&limit=25`, {
        timeout: 8000,
        headers: {
          'Accept': 'application/json',
          // Remove Accept-Encoding - browser handles this automatically
        },
      });
      
      let quickData: Partial<Customer>[] = [];
      if (response.data?.success && Array.isArray(response.data.data)) {
        quickData = response.data.data.map((customer: any) => ({
          ...customer,
          createdDate: new Date(customer.createdDate),
          lastAssessmentDate: customer.lastAssessmentDate ? new Date(customer.lastAssessmentDate) : undefined
        }));
      }
      
      this.quickCache = quickData;
      this.quickCacheTimestamp = Date.now();
      
      console.log(`✅ CustomerService: Quick data loaded (${quickData.length} customers)`);
      return quickData;
      
    } catch (error) {
      console.warn('⚠️ CustomerService: Quick API failed, falling back to full fetch');
      // Fallback to full fetch
      const customers = await this.getCustomers();
      return customers.map(c => ({
        id: c.id,
        tenantName: c.tenantName,
        tenantDomain: c.tenantDomain,
        status: c.status,
        totalAssessments: c.totalAssessments,
        createdDate: c.createdDate,
        lastAssessmentDate: c.lastAssessmentDate
      }));
    }
  }
}