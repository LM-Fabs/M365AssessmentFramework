import { CosmosClient, Database, Container, ItemResponse } from "@azure/cosmos";
import { DefaultAzureCredential } from "@azure/identity";
import { Customer, CreateCustomerRequest, Assessment } from "./types";
import { getKeyVaultService } from "./keyVaultService";

/**
 * Azure Cosmos DB Service for M365 Assessment Framework
 * Uses managed identity for authentication and implements proper error handling
 * Follows Azure best practices for Cosmos DB operations
 */
export class CosmosDbService {
    private client: CosmosClient;
    private database: Database;
    private customersContainer: Container;
    private assessmentsContainer: Container;
    private assessmentHistoryContainer: Container;
    private isInitialized = false;

    constructor() {
        // Use managed identity for authentication (Azure best practice)
        const credential = new DefaultAzureCredential();
        
        // Get configuration from environment variables
        const endpoint = process.env.COSMOS_DB_ENDPOINT;
        const databaseName = process.env.COSMOS_DB_DATABASE_NAME || 'm365assessment';
        const customersContainerName = process.env.COSMOS_DB_CUSTOMERS_CONTAINER || 'customers';
        const assessmentsContainerName = process.env.COSMOS_DB_ASSESSMENTS_CONTAINER || 'assessments';
        const assessmentHistoryContainerName = process.env.COSMOS_DB_ASSESSMENT_HISTORY_CONTAINER || 'assessmentHistory';

        if (!endpoint) {
            throw new Error("COSMOS_DB_ENDPOINT environment variable is required");
        }

        // Initialize Cosmos client with managed identity
        this.client = new CosmosClient({
            endpoint,
            aadCredentials: credential,
            consistencyLevel: "Session" // Optimal for most scenarios
        });

        this.database = this.client.database(databaseName);
        this.customersContainer = this.database.container(customersContainerName);
        this.assessmentsContainer = this.database.container(assessmentsContainerName);
        this.assessmentHistoryContainer = this.database.container(assessmentHistoryContainerName);
    }

    /**
     * Initialize database and containers if they don't exist
     * Should be called during application startup
     */
    async initialize(): Promise<void> {
        try {
            // Create database if it doesn't exist
            await this.client.databases.createIfNotExists({
                id: this.database.id,
                throughput: 400 // Minimum throughput for development
            });

            // Create customers container with proper partitioning
            await this.database.containers.createIfNotExists({
                id: this.customersContainer.id,
                partitionKey: "/tenantDomain", // Partition by tenant domain for optimal distribution
                indexingPolicy: {
                    indexingMode: "consistent",
                    automatic: true,
                    includedPaths: [
                        { path: "/*" }
                    ],
                    excludedPaths: [
                        { path: "/\"_etag\"/?" }
                    ]
                },
                throughput: 400
            });

            // Create assessments container with proper partitioning
            await this.database.containers.createIfNotExists({
                id: this.assessmentsContainer.id,
                partitionKey: "/customerId", // Partition by customer for optimal query performance
                indexingPolicy: {
                    indexingMode: "consistent",
                    automatic: true,
                    includedPaths: [
                        { path: "/*" }
                    ],
                    excludedPaths: [
                        { path: "/\"_etag\"/?" }
                    ]
                },
                throughput: 400
            });

            // Create assessment history container with proper partitioning
            await this.database.containers.createIfNotExists({
                id: this.assessmentHistoryContainer.id,
                partitionKey: "/tenantId", // Partition by tenant for optimal query performance
                indexingPolicy: {
                    indexingMode: "consistent",
                    automatic: true,
                    includedPaths: [
                        { path: "/*" }
                    ],
                    excludedPaths: [
                        { path: "/\"_etag\"/?" }
                    ]
                },
                throughput: 400
            });

            this.isInitialized = true;
        } catch (error) {
            throw new Error(`Failed to initialize Cosmos DB: ${(error as Error).message}`);
        }
    }

    /**
     * Create a new customer with app registration details
     * Stores client secret securely in Key Vault
     */
    async createCustomer(
        customerData: CreateCustomerRequest, 
        appRegistration: {
            applicationId: string;
            clientId: string;
            servicePrincipalId: string;
            permissions: string[];
        }
    ): Promise<Customer> {
        try {
            // Generate unique customer ID
            const customerId = `customer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

            const customer: Customer = {
                id: customerId,
                tenantId: '', // Will be populated during first assessment
                tenantName: customerData.tenantName,
                tenantDomain: customerData.tenantDomain,
                createdDate: new Date(),
                totalAssessments: 0,
                status: 'active',
                contactEmail: customerData.contactEmail,
                appRegistration: {
                    applicationId: appRegistration.applicationId,
                    clientId: appRegistration.clientId,
                    servicePrincipalId: appRegistration.servicePrincipalId,
                    permissions: appRegistration.permissions
                },
                notes: customerData.notes
            };

            // Create customer record in Cosmos DB
            const response = await this.customersContainer.items.create(customer);
            
            if (!response.resource) {
                throw new Error('Failed to create customer - no resource returned');
            }

            return response.resource;
        } catch (error) {
            if ((error as any).code === 409) {
                throw new Error(`Customer with domain ${customerData.tenantDomain} already exists`);
            }
            throw new Error(`Failed to create customer: ${(error as Error).message}`);
        }
    }

    /**
     * Get all customers with optional filtering and pagination
     */
    async getCustomers(options?: {
        status?: string;
        maxItemCount?: number;
        continuationToken?: string;
    }): Promise<{
        customers: Customer[];
        continuationToken?: string;
    }> {
        try {
            let query = "SELECT * FROM c WHERE c.status != 'deleted'";
            const parameters: any[] = [];

            // Add status filter if provided
            if (options?.status) {
                query += " AND c.status = @status";
                parameters.push({ name: "@status", value: options.status });
            }

            // Order by creation date (most recent first)
            query += " ORDER BY c.createdDate DESC";

            const querySpec = {
                query,
                parameters
            };

            const queryOptions: any = {
                maxItemCount: options?.maxItemCount || 50
            };

            if (options?.continuationToken) {
                queryOptions.continuationToken = options.continuationToken;
            }

            const response = await this.customersContainer.items.query<Customer>(querySpec, queryOptions).fetchNext();

            return {
                customers: response.resources,
                continuationToken: response.continuationToken
            };
        } catch (error) {
            throw new Error(`Failed to retrieve customers: ${(error as Error).message}`);
        }
    }

    /**
     * Get customer by domain (for duplicate checking)
     */
    async getCustomerByDomain(tenantDomain: string): Promise<Customer | null> {
        try {
            const querySpec = {
                query: "SELECT * FROM c WHERE c.tenantDomain = @tenantDomain AND c.status != 'deleted'",
                parameters: [
                    { name: "@tenantDomain", value: tenantDomain }
                ]
            };

            const response = await this.customersContainer.items.query<Customer>(querySpec).fetchNext();
            return response.resources.length > 0 ? response.resources[0] : null;
        } catch (error) {
            throw new Error(`Failed to get customer by domain: ${(error as Error).message}`);
        }
    }

    /**
     * Get customer by ID
     */
    async getCustomer(customerId: string): Promise<Customer | null>;
    async getCustomer(customerId: string, tenantDomain: string): Promise<Customer>;
    async getCustomer(customerId: string, tenantDomain?: string): Promise<Customer | null> {
        try {
            if (tenantDomain) {
                // Original implementation with tenant domain
                const response = await this.customersContainer.item(customerId, tenantDomain).read<Customer>();
                if (!response.resource) {
                    throw new Error(`Customer ${customerId} not found`);
                }
                return response.resource;
            } else {
                // New implementation - query by ID only
                const querySpec = {
                    query: "SELECT * FROM c WHERE c.id = @customerId AND c.status != 'deleted'",
                    parameters: [
                        { name: "@customerId", value: customerId }
                    ]
                };

                const response = await this.customersContainer.items.query<Customer>(querySpec).fetchNext();
                return response.resources.length > 0 ? response.resources[0] : null;
            }
        } catch (error) {
            if ((error as any).code === 404) {
                if (tenantDomain) {
                    throw new Error(`Customer ${customerId} not found`);
                } else {
                    return null;
                }
            }
            throw new Error(`Failed to get customer: ${(error as Error).message}`);
        }
    }

    /**
     * Update customer information
     */
    async updateCustomer(customerId: string, updates: Partial<Customer>): Promise<Customer>;
    async updateCustomer(customerId: string, tenantDomain: string, updates: Partial<Customer>): Promise<Customer>;
    async updateCustomer(customerId: string, tenantDomainOrUpdates: string | Partial<Customer>, updates?: Partial<Customer>): Promise<Customer> {
        try {
            let customer: Customer | null = null;
            let actualUpdates: Partial<Customer>;
            let tenantDomain: string;

            if (typeof tenantDomainOrUpdates === 'string') {
                // Original implementation with tenant domain
                tenantDomain = tenantDomainOrUpdates;
                actualUpdates = updates!;
                customer = await this.getCustomer(customerId, tenantDomain);
                if (!customer) {
                    throw new Error(`Customer ${customerId} not found`);
                }
            } else {
                // New implementation - find customer first
                actualUpdates = tenantDomainOrUpdates;
                customer = await this.getCustomer(customerId);
                if (!customer) {
                    throw new Error('Customer not found');
                }
                tenantDomain = customer.tenantDomain;
            }

            const updated = { ...customer, ...actualUpdates };
            const response = await this.customersContainer.item(customerId, tenantDomain).replace(updated);
            
            if (!response.resource) {
                throw new Error('Failed to update customer - no resource returned');
            }
            
            return response.resource;
        } catch (error) {
            throw new Error(`Failed to update customer: ${(error as Error).message}`);
        }
    }

    /**
     * Soft delete customer (mark as deleted)
     */
    async deleteCustomer(customerId: string): Promise<void>;
    async deleteCustomer(customerId: string, tenantDomain: string): Promise<void>;
    async deleteCustomer(customerId: string, tenantDomain?: string): Promise<void> {
        try {
            let customer: Customer | null = null;
            
            if (tenantDomain) {
                // Original implementation with tenant domain
                customer = await this.getCustomer(customerId, tenantDomain);
                if (!customer) {
                    throw new Error(`Customer ${customerId} not found`);
                }
            } else {
                // New implementation - find customer first
                customer = await this.getCustomer(customerId);
                if (!customer) {
                    throw new Error('Customer not found');
                }
                tenantDomain = customer.tenantDomain;
            }

            // Soft delete by updating status
            await this.updateCustomer(customerId, tenantDomain, {
                status: 'deleted'
                // deletedDate: new Date()
            });

            // Also clean up secrets in Key Vault
            const keyVaultService = getKeyVaultService();
            await keyVaultService.deleteClientSecret(customerId);
        } catch (error) {
            throw new Error(`Failed to delete customer: ${(error as Error).message}`);
        }
    }

    /**
     * Create a new assessment
     */
    async createAssessment(assessment: Omit<Assessment, 'id'>): Promise<Assessment> {
        try {
            const assessmentId = `assessment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            const newAssessment: Assessment = {
                ...assessment,
                id: assessmentId
            };

            const response = await this.assessmentsContainer.items.create(newAssessment);

            if (!response.resource) {
                throw new Error('Failed to create assessment - no resource returned');
            }

            // Update customer's assessment count and last assessment date if assessment has tenantId
            if ('tenantId' in assessment) {
                await this.updateCustomerAssessmentInfo(assessment.tenantId, assessment.tenantId);
            }

            return response.resource;
        } catch (error) {
            throw new Error(`Failed to create assessment: ${(error as Error).message}`);
        }
    }

    /**
     * Get assessments for a customer
     */
    async getCustomerAssessments(customerId: string, options?: {
        limit?: number;
        status?: string;
        continuationToken?: string;
    }): Promise<{
        assessments: Assessment[];
        continuationToken?: string;
    }> {
        try {
            let query = "SELECT * FROM c WHERE c.customerId = @customerId";
            const parameters = [{ name: "@customerId", value: customerId }];

            if (options?.status) {
                query += " AND c.status = @status";
                parameters.push({ name: "@status", value: options.status });
            }

            query += " ORDER BY c.createdDate DESC";

            const querySpec = { query, parameters };
            const queryOptions: any = {
                maxItemCount: options?.limit || 20
            };

            if (options?.continuationToken) {
                queryOptions.continuationToken = options.continuationToken;
            }

            const response = await this.assessmentsContainer.items.query<Assessment>(querySpec, queryOptions).fetchNext();

            return {
                assessments: response.resources,
                continuationToken: response.continuationToken
            };
        } catch (error) {
            throw new Error(`Failed to get customer assessments: ${(error as Error).message}`);
        }
    }

    /**
     * Get assessment by ID
     */
    async getAssessment(assessmentId: string, customerId: string): Promise<Assessment | null> {
        try {
            const response = await this.assessmentsContainer.item(assessmentId, customerId).read<Assessment>();
            return response.resource || null;
        } catch (error) {
            if ((error as any).code === 404) {
                return null;
            }
            throw new Error(`Failed to get assessment: ${(error as Error).message}`);
        }
    }

    /**
     * Update assessment
     */
    async updateAssessment(assessmentId: string, customerId: string, updates: Partial<Assessment>): Promise<Assessment> {
        try {
            const existing = await this.getAssessment(assessmentId, customerId);
            if (!existing) {
                throw new Error(`Assessment ${assessmentId} not found`);
            }

            const updated = { ...existing, ...updates };
            const response = await this.assessmentsContainer.item(assessmentId, customerId).replace(updated);
            
            if (!response.resource) {
                throw new Error('Failed to update assessment - no resource returned');
            }
            
            return response.resource;
        } catch (error) {
            throw new Error(`Failed to update assessment: ${(error as Error).message}`);
        }
    }

    /**
     * Store assessment in history for comparison purposes
     */
    async storeAssessmentHistory(assessment: {
        id: string;
        tenantId: string;
        customerId?: string;
        date: Date;
        overallScore: number;
        categoryScores: Record<string, number>;
        [key: string]: any;
    }): Promise<void> {
        try {
            const historyEntry = {
                id: `history-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                assessmentId: assessment.id,
                tenantId: assessment.tenantId,
                customerId: assessment.customerId,
                date: assessment.date,
                overallScore: assessment.overallScore,
                categoryScores: assessment.categoryScores,
                createdDate: new Date()
            };

            await this.assessmentHistoryContainer.items.create(historyEntry);
        } catch (error) {
            throw new Error(`Failed to store assessment history: ${(error as Error).message}`);
        }
    }

    /**
     * Get assessment history with optional filtering
     */
    async getAssessmentHistory(options?: {
        tenantId?: string;
        customerId?: string;
        maxItemCount?: number;
        continuationToken?: string;
    }): Promise<any[]> {
        try {
            let query = "SELECT * FROM c";
            const parameters: any[] = [];
            const conditions: string[] = [];

            // Add filters
            if (options?.tenantId) {
                conditions.push("c.tenantId = @tenantId");
                parameters.push({ name: "@tenantId", value: options.tenantId });
            }

            if (options?.customerId) {
                conditions.push("c.customerId = @customerId");
                parameters.push({ name: "@customerId", value: options.customerId });
            }

            if (conditions.length > 0) {
                query += " WHERE " + conditions.join(" AND ");
            }

            // Order by date (most recent first)
            query += " ORDER BY c.date DESC";

            const querySpec = {
                query,
                parameters
            };

            const queryOptions: any = {
                maxItemCount: options?.maxItemCount || 10
            };

            if (options?.continuationToken) {
                queryOptions.continuationToken = options.continuationToken;
            }

            const response = await this.assessmentHistoryContainer.items.query(querySpec, queryOptions).fetchNext();
            return response.resources;
        } catch (error) {
            throw new Error(`Failed to get assessment history: ${(error as Error).message}`);
        }
    }

    /**
     * Update customer's assessment info after a new assessment
     */
    private async updateCustomerAssessmentInfo(customerId: string, tenantId?: string): Promise<void> {
        try {
            // Get customer's tenant domain first
            const querySpec = {
                query: "SELECT * FROM c WHERE c.id = @customerId",
                parameters: [{ name: "@customerId", value: customerId }]
            };

            const customerResponse = await this.customersContainer.items.query<Customer>(querySpec).fetchNext();
            if (customerResponse.resources.length === 0) {
                return; // Customer not found, skip update
            }

            const customer = customerResponse.resources[0];
            
            // Update customer info
            const updates: Partial<Customer> = {
                lastAssessmentDate: new Date(),
                totalAssessments: customer.totalAssessments + 1
            };

            // Update tenant ID if provided and not already set
            if (tenantId && !customer.tenantId) {
                updates.tenantId = tenantId;
            }

            await this.updateCustomer(customerId, customer.tenantDomain, updates);
        } catch (error) {
            console.error('Failed to update customer assessment info:', error);
            // Don't throw error here as it's not critical for assessment creation
        }
    }

    /**
     * Health check for Cosmos DB connectivity
     */
    async healthCheck(): Promise<boolean> {
        try {
            // Simple query to test connectivity
            await this.customersContainer.items.query("SELECT VALUE COUNT(1) FROM c WHERE c.id = 'health-check'").fetchNext();
            return true;
        } catch (error) {
            console.error('Cosmos DB health check failed:', error);
            return false;
        }
    }

    /**
     * Get database statistics
     */
    async getStatistics(): Promise<{
        totalCustomers: number;
        activeCustomers: number;
        totalAssessments: number;
        completedAssessments: number;
    }> {
        try {
            // Get customer counts
            const customerCountResponse = await this.customersContainer.items.query({
                query: "SELECT VALUE COUNT(1) FROM c WHERE c.status != 'deleted'"
            }).fetchNext();

            const activeCustomerCountResponse = await this.customersContainer.items.query({
                query: "SELECT VALUE COUNT(1) FROM c WHERE c.status = 'active'"
            }).fetchNext();

            // Get assessment counts
            const assessmentCountResponse = await this.assessmentsContainer.items.query({
                query: "SELECT VALUE COUNT(1) FROM c"
            }).fetchNext();

            const completedAssessmentCountResponse = await this.assessmentsContainer.items.query({
                query: "SELECT VALUE COUNT(1) FROM c WHERE c.status = 'completed'"
            }).fetchNext();

            return {
                totalCustomers: customerCountResponse.resources[0] || 0,
                activeCustomers: activeCustomerCountResponse.resources[0] || 0,
                totalAssessments: assessmentCountResponse.resources[0] || 0,
                completedAssessments: completedAssessmentCountResponse.resources[0] || 0
            };
        } catch (error) {
            throw new Error(`Failed to get statistics: ${(error as Error).message}`);
        }
    }
}

// Singleton instance for reuse across functions
let cosmosDbServiceInstance: CosmosDbService;

export function getCosmosDbService(): CosmosDbService {
    if (!cosmosDbServiceInstance) {
        cosmosDbServiceInstance = new CosmosDbService();
    }
    return cosmosDbServiceInstance;
}