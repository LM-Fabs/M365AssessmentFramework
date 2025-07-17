import { Customer, CreateCustomerRequest, CustomerAssessmentSummary } from './customerService';
import { Assessment as BaseAssessment } from '../models/Assessment';
import { graphApiService } from './graphApiService';

// Extended Assessment interface for local storage
interface LocalAssessment extends BaseAssessment {
  customerId: string;
}

// For compatibility with the main service
type Assessment = LocalAssessment;

/**
 * Client-side CustomerService for Azure Static Web Apps Free tier
 * Stores data in localStorage and performs real M365 assessments via Microsoft Graph API
 */
export class LocalCustomerService {
  private static instance: LocalCustomerService;
  private readonly STORAGE_KEY = 'm365-assessment-customers';
  private readonly ASSESSMENTS_STORAGE_KEY = 'm365-assessment-assessments';

  private constructor() {
    console.log('🔧 LocalCustomerService: Initialized for Free tier');
    console.log('💾 LocalCustomerService: Using localStorage for data persistence');
  }

  public static getInstance(): LocalCustomerService {
    if (!LocalCustomerService.instance) {
      LocalCustomerService.instance = new LocalCustomerService();
    }
    return LocalCustomerService.instance;
  }

  /**
   * Get all customers from localStorage
   */
  public async getCustomers(): Promise<Customer[]> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      const customers = stored ? JSON.parse(stored) : [];
      
      // Convert date strings back to Date objects
      return customers.map((customer: any) => ({
        ...customer,
        createdDate: new Date(customer.createdDate),
        lastAssessmentDate: customer.lastAssessmentDate ? new Date(customer.lastAssessmentDate) : undefined
      }));
    } catch (error) {
      console.error('❌ LocalCustomerService: Error loading customers:', error);
      return [];
    }
  }

  /**
   * Create a new customer with real Microsoft Graph API integration
   */
  public async createCustomer(request: CreateCustomerRequest): Promise<Customer> {
    try {
      console.log('📝 LocalCustomerService: Creating new customer:', request.tenantName);

      // Generate a unique ID for the customer
      const customerId = this.generateId();
      
      // For Free tier, we'll use the provided tenant information
      // In a real scenario, you might want to validate the tenant via Graph API
      const newCustomer: Customer = {
        id: customerId,
        tenantId: request.tenantId || this.generateId(), // Use provided or generate
        tenantName: request.tenantName,
        tenantDomain: request.tenantDomain,
        applicationId: '', // Will be set when user configures app registration
        clientId: '', // Will be set when user configures app registration
        servicePrincipalId: '',
        createdDate: new Date(),
        totalAssessments: 0,
        status: 'pending',
        permissions: [],
        contactEmail: request.contactEmail,
        notes: request.notes
      };

      // Store in localStorage
      const customers = await this.getCustomers();
      customers.push(newCustomer);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(customers));

      console.log('✅ LocalCustomerService: Customer created successfully');
      return newCustomer;
    } catch (error) {
      console.error('❌ LocalCustomerService: Error creating customer:', error);
      throw error;
    }
  }

  /**
   * Update an existing customer
   */
  public async updateCustomer(customerId: string, updates: Partial<Customer>): Promise<Customer> {
    try {
      const customers = await this.getCustomers();
      const customerIndex = customers.findIndex(c => c.id === customerId);
      
      if (customerIndex === -1) {
        throw new Error(`Customer with ID ${customerId} not found`);
      }

      // Update the customer
      customers[customerIndex] = { ...customers[customerIndex], ...updates };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(customers));

      console.log('✅ LocalCustomerService: Customer updated successfully');
      return customers[customerIndex];
    } catch (error) {
      console.error('❌ LocalCustomerService: Error updating customer:', error);
      throw error;
    }
  }

  /**
   * Delete a customer
   */
  public async deleteCustomer(customerId: string): Promise<void> {
    try {
      const customers = await this.getCustomers();
      const filteredCustomers = customers.filter(c => c.id !== customerId);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filteredCustomers));

      // Also remove associated assessments
      const assessments = this.getStoredAssessments();
      const filteredAssessments = assessments.filter(a => a.customerId !== customerId);
      localStorage.setItem(this.ASSESSMENTS_STORAGE_KEY, JSON.stringify(filteredAssessments));

      console.log('✅ LocalCustomerService: Customer deleted successfully');
    } catch (error) {
      console.error('❌ LocalCustomerService: Error deleting customer:', error);
      throw error;
    }
  }

  /**
   * Get customer by ID
   */
  public async getCustomerById(customerId: string): Promise<Customer | null> {
    const customers = await this.getCustomers();
    return customers.find(c => c.id === customerId) || null;
  }

  /**
   * Perform a real M365 security assessment using Microsoft Graph API
   */
  public async runAssessment(customerId: string, accessToken: string): Promise<Assessment> {
    try {
      console.log('🔍 LocalCustomerService: Starting M365 security assessment');
      
      const customer = await this.getCustomerById(customerId);
      if (!customer) {
        throw new Error(`Customer with ID ${customerId} not found`);
      }

      // Initialize Graph API service with the access token
      const graphService = graphApiService;
      await graphService.initialize(accessToken);

      // Perform the assessment
      const baseAssessment = await graphService.performSecurityAssessment(customer);
      
      // Add customerId to make it compatible with LocalAssessment
      const assessment: Assessment = {
        ...baseAssessment,
        customerId
      };

      // Store the assessment
      this.storeAssessment(assessment);

      // Update customer's last assessment date
      await this.updateCustomer(customerId, {
        lastAssessmentDate: new Date(),
        totalAssessments: customer.totalAssessments + 1
      });

      console.log('✅ LocalCustomerService: Assessment completed successfully');
      return assessment;
    } catch (error) {
      console.error('❌ LocalCustomerService: Error running assessment:', error);
      throw error;
    }
  }

  /**
   * Get assessments for a customer
   */
  public async getCustomerAssessments(customerId: string): Promise<Assessment[]> {
    const assessments = this.getStoredAssessments();
    return assessments.filter(a => a.customerId === customerId);
  }

  /**
   * Get customer summary with recent assessments
   */
  public async getCustomerSummary(customerId: string): Promise<CustomerAssessmentSummary | null> {
    const customer = await this.getCustomerById(customerId);
    if (!customer) return null;

    const recentAssessments = await this.getCustomerAssessments(customerId);
    const lastScore = recentAssessments.length > 0 ? 
      (recentAssessments[0].comparisonResults?.previousAssessment?.overallScore || 
       recentAssessments[0].metrics?.score?.overall || 0) : undefined;

    return {
      customer,
      recentAssessments: recentAssessments.slice(0, 5), // Last 5 assessments
      lastScore
    };
  }

  /**
   * Prefetch customers (for compatibility with existing code)
   */
  public async prefetchCustomers(): Promise<void> {
    // For localStorage-based implementation, data is always available
    const customers = await this.getCustomers();
    console.log(`✅ LocalCustomerService: Prefetched ${customers.length} customers`);
  }

  /**
   * Test if Microsoft Graph API access is working for a customer
   */
  public async testGraphApiAccess(customerId: string, accessToken: string): Promise<boolean> {
    try {
      const customer = await this.getCustomerById(customerId);
      if (!customer) return false;

      const graphService = graphApiService;
      await graphService.initialize(accessToken);
      
      // Test basic Graph API access
      const profile = await graphService.getOrganizationProfile();
      return profile !== null;
    } catch (error) {
      console.error('❌ LocalCustomerService: Graph API test failed:', error);
      return false;
    }
  }

  // Private helper methods

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getStoredAssessments(): Assessment[] {
    try {
      const stored = localStorage.getItem(this.ASSESSMENTS_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('❌ LocalCustomerService: Error loading assessments:', error);
      return [];
    }
  }

  private storeAssessment(assessment: Assessment): void {
    try {
      const assessments = this.getStoredAssessments();
      assessments.unshift(assessment); // Add to beginning
      
      // Keep only the last 100 assessments per customer to avoid localStorage bloat
      const customerAssessments = assessments.filter(a => a.customerId === assessment.customerId);
      if (customerAssessments.length > 100) {
        // Remove oldest assessments for this customer
        const otherAssessments = assessments.filter(a => a.customerId !== assessment.customerId);
        const recentCustomerAssessments = customerAssessments.slice(0, 100);
        localStorage.setItem(this.ASSESSMENTS_STORAGE_KEY, JSON.stringify([...recentCustomerAssessments, ...otherAssessments]));
      } else {
        localStorage.setItem(this.ASSESSMENTS_STORAGE_KEY, JSON.stringify(assessments));
      }
    } catch (error) {
      console.error('❌ LocalCustomerService: Error storing assessment:', error);
    }
  }

  /**
   * Create a new assessment for a customer
   */
  public async createAssessment(customerId: string, assessmentData: Partial<Assessment>): Promise<Assessment> {
    const customer = await this.getCustomerById(customerId);
    if (!customer) {
      throw new Error('Customer not found');
    }

    const assessment: Assessment = {
      id: this.generateId(),
      customerId,
      tenantId: customer.tenantId,
      assessmentDate: new Date(),
      status: 'draft',
      assessor: {
        id: 'local-user',
        name: 'Local Assessment',
        email: customer.contactEmail || 'unknown@example.com'
      },
      metrics: assessmentData.metrics || {
        license: {
          totalLicenses: 0,
          assignedLicenses: 0,
          utilizationRate: 0,
          licenseDetails: [],
          summary: 'No license data available'
        },
        secureScore: {
          percentage: 0,
          currentScore: 0,
          maxScore: 0,
          controlScores: [],
          summary: 'No secure score data available'
        },
        score: {
          overall: 0,
          license: 0,
          secureScore: 0
        },
        lastUpdated: new Date()
      },
      recommendations: assessmentData.recommendations || [],
      lastModified: new Date(),
      ...assessmentData
    };

    this.storeAssessment(assessment);

    // Update customer's assessment count and last assessment date
    await this.updateCustomer(customerId, {
      lastAssessmentDate: assessment.assessmentDate,
      totalAssessments: customer.totalAssessments + 1
    });

    console.log('✅ LocalCustomerService: Assessment created:', assessment.id);
    return assessment;
  }

  /**
   * Get customers with their recent assessments (for summary displays)
   */
  public async getCustomersWithAssessments(): Promise<CustomerAssessmentSummary[]> {
    const customers = await this.getCustomers();
    const results: CustomerAssessmentSummary[] = [];

    for (const customer of customers) {
      const recentAssessments = await this.getCustomerAssessments(customer.id);
      const lastScore = recentAssessments.length > 0 ? 
        (recentAssessments[0].comparisonResults?.previousAssessment?.overallScore || 
         recentAssessments[0].metrics?.score?.overall || 0) : undefined;

      results.push({
        customer,
        recentAssessments: recentAssessments.slice(0, 5), // Last 5 assessments
        lastScore
      });
    }

    return results;
  }

  /**
   * Export all data for backup
   */
  public exportData(): { customers: Customer[], assessments: Assessment[] } {
    return {
      customers: JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]'),
      assessments: JSON.parse(localStorage.getItem(this.ASSESSMENTS_STORAGE_KEY) || '[]')
    };
  }

  /**
   * Import data from backup
   */
  public importData(data: { customers: Customer[], assessments: Assessment[] }): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data.customers));
    localStorage.setItem(this.ASSESSMENTS_STORAGE_KEY, JSON.stringify(data.assessments));
    console.log('✅ LocalCustomerService: Data imported successfully');
  }

  /**
   * Clear all stored data
   */
  public clearAllData(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem(this.ASSESSMENTS_STORAGE_KEY);
    console.log('🗑️ LocalCustomerService: All data cleared');
  }
}

// Export singleton instance
export const localCustomerService = LocalCustomerService.getInstance();
