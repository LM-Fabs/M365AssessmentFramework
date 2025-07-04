import { TableClient, AzureNamedKeyCredential, odata } from "@azure/data-tables";
import { DefaultAzureCredential } from "@azure/identity";

export interface Customer {
    id: string;
    tenantId: string;  // Add tenantId field
    tenantName: string;
    tenantDomain: string;
    contactEmail?: string;
    notes?: string;
    createdDate: Date;
    status: string;
    totalAssessments?: number;
    appRegistration?: {
        applicationId: string;
        clientId: string;
        servicePrincipalId: string;
        permissions: string[];
        clientSecret?: string;
        consentUrl?: string;
        redirectUri?: string;
    };
}

export interface Assessment {
    id: string;
    customerId: string;
    tenantId: string;
    date: Date;
    status: string;
    score?: number;
    metrics?: any;
    recommendations?: any[];
}

export interface AssessmentHistory {
    id: string;
    tenantId: string;
    customerId?: string;
    date: Date;
    overallScore: number;
    categoryScores: Record<string, number>;
}

/**
 * Table Storage service for M365 Assessment Framework
 * Uses Azure Table Storage as a temporary solution while Cosmos DB provider is being registered
 */
export class TableStorageService {
    private customersTable: TableClient;
    private assessmentsTable: TableClient;
    private historyTable: TableClient;
    private initialized = false;

    constructor() {
        // Initialize connection string - Azure Static Web Apps vs Local Development
        let connectionString: string;
        
        if (process.env.NODE_ENV === 'development' || process.env.AZURE_FUNCTIONS_ENVIRONMENT === 'Development') {
            // Local development - prefer AzureWebJobsStorage, fallback to Azure Storage or emulator
            connectionString = process.env.AzureWebJobsStorage || process.env.AZURE_STORAGE_CONNECTION_STRING || 'UseDevelopmentStorage=true';
            console.log('🔧 TableStorageService: Using local development storage');
        } else {
            // Azure Static Web Apps - MUST use AZURE_STORAGE_CONNECTION_STRING (AzureWebJobsStorage not allowed)
            connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || '';
            if (!connectionString) {
                console.error('❌ AZURE_STORAGE_CONNECTION_STRING not found. This is required for Azure Static Web Apps.');
                console.error('📋 Available storage environment variables:', 
                    Object.keys(process.env).filter(k => k.includes('STORAGE') || k.includes('AZURE')));
                throw new Error('AZURE_STORAGE_CONNECTION_STRING is required for Azure Static Web Apps');
            }
            console.log('☁️ TableStorageService: Using Azure Storage via AZURE_STORAGE_CONNECTION_STRING for Static Web Apps');
        }

        console.log('🌍 TableStorageService: Environment:', process.env.NODE_ENV || 'production');
        console.log('📊 TableStorageService: Using emulator:', connectionString.includes('UseDevelopmentStorage=true'));

        try {
            this.customersTable = TableClient.fromConnectionString(connectionString, 'customers');
            this.assessmentsTable = TableClient.fromConnectionString(connectionString, 'assessments');
            this.historyTable = TableClient.fromConnectionString(connectionString, 'assessmenthistory');
        } catch (error) {
            console.error('❌ Failed to initialize Table Storage client:', error);
            throw new Error(`Failed to initialize Table Storage client: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async initialize(): Promise<void> {
        if (this.initialized) return;

        try {
            // Create tables if they don't exist
            await this.customersTable.createTable();
            await this.assessmentsTable.createTable();
            await this.historyTable.createTable();
            
            this.initialized = true;
        } catch (error: any) {
            // Ignore "table already exists" errors
            if (error?.statusCode !== 409) {
                throw error;
            }
            this.initialized = true;
        }
    }

    // Customer operations
    async getCustomers(options?: { status?: string; maxItemCount?: number }): Promise<{ customers: Customer[]; continuationToken?: string }> {
        await this.initialize();

        const customers: Customer[] = [];
        let filter = '';
        
        if (options?.status) {
            filter = odata`status eq ${options.status}`;
        }

        const iterator = this.customersTable.listEntities({ 
            queryOptions: { filter }
        });

        let count = 0;
        const maxItems = options?.maxItemCount || 100;

        for await (const entity of iterator) {
            if (count >= maxItems) break;
            
            customers.push({
                id: entity.rowKey as string,
                tenantId: entity.tenantId as string || '',  // Include tenant ID
                tenantName: entity.tenantName as string,
                tenantDomain: entity.tenantDomain as string,
                contactEmail: entity.contactEmail as string || '',
                notes: entity.notes as string || '',
                status: entity.status as string,
                createdDate: new Date(entity.createdDate as string),
                appRegistration: entity.appRegistration ? JSON.parse(entity.appRegistration as string) : undefined,
                totalAssessments: (entity.totalAssessments as number) || 0
            });
            count++;
        }

        return { customers };
    }

    async getCustomerByDomain(domain: string): Promise<Customer | null> {
        await this.initialize();

        try {
            const filter = odata`tenantDomain eq ${domain}`;
            const iterator = this.customersTable.listEntities({ queryOptions: { filter } });

            for await (const entity of iterator) {
                return {
                    id: entity.rowKey as string,
                    tenantId: entity.tenantId as string || '',  // Include tenant ID
                    tenantName: entity.tenantName as string,
                    tenantDomain: entity.tenantDomain as string,
                    contactEmail: entity.contactEmail as string || '',
                    notes: entity.notes as string || '',
                    status: entity.status as string,
                    createdDate: new Date(entity.createdDate as string),
                    totalAssessments: (entity.totalAssessments as number) || 0,
                    appRegistration: entity.appRegistration ? JSON.parse(entity.appRegistration as string) : undefined
                };
            }
            return null;
        } catch (error) {
            console.error('Error getting customer by domain:', error);
            return null;
        }
    }

    async createCustomer(customerRequest: any, appRegistration: any): Promise<Customer> {
        await this.initialize();

        const customerId = `customer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const customer: Customer = {
            id: customerId,
            tenantId: customerRequest.tenantId || '',  // Include tenant ID
            tenantName: customerRequest.tenantName,
            tenantDomain: customerRequest.tenantDomain,
            contactEmail: customerRequest.contactEmail || '',
            notes: customerRequest.notes || '',
            createdDate: new Date(),
            status: 'active',
            totalAssessments: 0,
            appRegistration
        };

        const entity = {
            partitionKey: 'customer',
            rowKey: customerId,
            tenantId: customerRequest.tenantId || '',  // Store the actual tenant ID
            tenantName: customer.tenantName,
            tenantDomain: customer.tenantDomain,
            contactEmail: customer.contactEmail,
            notes: customer.notes,
            status: customer.status,
            createdDate: customer.createdDate.toISOString(),
            appRegistration: JSON.stringify(customer.appRegistration),
            totalAssessments: 0
        };

        try {
            await this.customersTable.createEntity(entity);
            console.log('✅ Table Storage: Customer created successfully:', customerId);
            return customer;
        } catch (error: any) {
            console.error('❌ Table Storage: Failed to create customer:', error);
            if (error?.statusCode === 409) {
                throw new Error('Customer already exists in Table Storage');
            }
            throw new Error(`Failed to create customer in Table Storage: ${error?.message || 'Unknown error'}`);
        }
    }

    async getCustomer(customerId: string): Promise<Customer | null> {
        await this.initialize();

        try {
            const entity = await this.customersTable.getEntity('customer', customerId);
            
            return {
                id: entity.rowKey as string,
                tenantId: entity.tenantId as string || '',  // Include the tenant ID
                tenantName: entity.tenantName as string,
                tenantDomain: entity.tenantDomain as string,
                contactEmail: entity.contactEmail as string || '',
                notes: entity.notes as string || '',
                createdDate: new Date(entity.createdDate as string),
                status: entity.status as string,
                totalAssessments: (entity.totalAssessments as number) || 0,
                appRegistration: JSON.parse(entity.appRegistration as string)
            };
        } catch (error) {
            if ((error as any)?.statusCode === 404) {
                return null;
            }
            throw error;
        }
    }

    async deleteCustomer(customerId: string): Promise<void> {
        await this.initialize();

        try {
            await this.customersTable.deleteEntity('customer', customerId);
        } catch (error) {
            if ((error as any)?.statusCode === 404) {
                throw new Error('Customer not found');
            }
            throw error;
        }
    }

    async updateCustomer(customerId: string, updates: Partial<Customer>): Promise<Customer> {
        await this.initialize();

        try {
            // First get the existing customer
            const existingEntity = await this.customersTable.getEntity('customer', customerId);
            
            // Create updated entity
            const updatedEntity = {
                partitionKey: 'customer',
                rowKey: customerId,
                tenantId: updates.tenantId ?? existingEntity.tenantId ?? '',  // Include tenant ID
                tenantName: updates.tenantName ?? existingEntity.tenantName,
                tenantDomain: updates.tenantDomain ?? existingEntity.tenantDomain,
                contactEmail: updates.contactEmail ?? existingEntity.contactEmail ?? '',
                notes: updates.notes ?? existingEntity.notes ?? '',
                status: updates.status ?? existingEntity.status,
                createdDate: existingEntity.createdDate, // Keep original creation date
                totalAssessments: updates.totalAssessments ?? existingEntity.totalAssessments ?? 0,
                appRegistration: updates.appRegistration 
                    ? JSON.stringify(updates.appRegistration)
                    : existingEntity.appRegistration
            };

            // Update the entity (merge mode)
            await this.customersTable.updateEntity(updatedEntity, 'Merge');

            // Return the updated customer
            return {
                id: customerId,
                tenantId: updatedEntity.tenantId as string,  // Include tenant ID
                tenantName: updatedEntity.tenantName as string,
                tenantDomain: updatedEntity.tenantDomain as string,
                contactEmail: updatedEntity.contactEmail as string,
                notes: updatedEntity.notes as string,
                createdDate: new Date(updatedEntity.createdDate as string),
                status: updatedEntity.status as string,
                totalAssessments: (updatedEntity.totalAssessments as number) || 0,
                appRegistration: JSON.parse(updatedEntity.appRegistration as string)
            };
        } catch (error) {
            if ((error as any)?.statusCode === 404) {
                throw new Error('Customer not found');
            }
            throw error;
        }
    }

    /**
     * Find customer by clientId from their app registration
     */
    async getCustomerByClientId(clientId: string): Promise<Customer | null> {
        await this.initialize();

        const filter = odata`partitionKey eq 'customer'`;
        const iterator = this.customersTable.listEntities({ queryOptions: { filter } });

        for await (const entity of iterator) {
            const appRegistration = entity.appRegistration ? JSON.parse(entity.appRegistration as string) : null;
            if (appRegistration && appRegistration.clientId === clientId) {
                return {
                    id: entity.rowKey as string,
                    tenantId: entity.tenantId as string || '',  // Include tenant ID
                    tenantName: entity.tenantName as string,
                    tenantDomain: entity.tenantDomain as string,
                    contactEmail: (entity.contactEmail as string) || '',
                    notes: (entity.notes as string) || '',
                    createdDate: new Date(entity.createdDate as string),
                    status: entity.status as string,
                    totalAssessments: (entity.totalAssessments as number) || 0,
                    appRegistration: appRegistration
                };
            }
        }

        return null;
    }

    // Assessment operations
    async getCustomerAssessments(customerId: string, options?: { status?: string; limit?: number }): Promise<{ assessments: Assessment[] }> {
        await this.initialize();

        const assessments: Assessment[] = [];
        let filter = odata`customerId eq ${customerId}`;
        
        if (options?.status) {
            filter = odata`customerId eq ${customerId} and status eq ${options.status}`;
        }

        const iterator = this.assessmentsTable.listEntities({ queryOptions: { filter } });

        let count = 0;
        const maxItems = options?.limit || 50;

        for await (const entity of iterator) {
            if (count >= maxItems) break;
            
            assessments.push({
                id: entity.rowKey as string,
                customerId: entity.customerId as string,
                tenantId: entity.tenantId as string,
                date: new Date(entity.date as string),
                status: entity.status as string,
                score: entity.score as number,
                metrics: entity.metrics ? JSON.parse(entity.metrics as string) : undefined,
                recommendations: entity.recommendations ? JSON.parse(entity.recommendations as string) : undefined
            });
            count++;
        }

        return { assessments };
    }

    async createAssessment(assessmentData: any): Promise<Assessment> {
        await this.initialize();

        const assessmentId = `assessment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const assessment: Assessment = {
            id: assessmentId,
            customerId: assessmentData.customerId || '',
            tenantId: assessmentData.tenantId || '',
            date: new Date(),
            status: 'completed',
            score: assessmentData.score || 0,
            metrics: assessmentData.metrics,
            recommendations: assessmentData.recommendations
        };

        const entity = {
            partitionKey: 'assessment',
            rowKey: assessmentId,
            customerId: assessment.customerId,
            tenantId: assessment.tenantId,
            date: assessment.date.toISOString(),
            status: assessment.status,
            score: assessment.score,
            metrics: JSON.stringify(assessment.metrics || {}),
            recommendations: JSON.stringify(assessment.recommendations || [])
        };

        await this.assessmentsTable.createEntity(entity);
        return assessment;
    }

    async updateAssessment(assessmentId: string, customerId: string, assessmentData: any): Promise<Assessment> {
        await this.initialize();

        const entity = {
            partitionKey: 'assessment',
            rowKey: assessmentId,
            customerId: customerId,
            tenantId: assessmentData.tenantId || '',
            date: new Date().toISOString(),
            status: assessmentData.status || 'completed',
            score: assessmentData.score || 0,
            metrics: JSON.stringify(assessmentData.metrics || {}),
            recommendations: JSON.stringify(assessmentData.recommendations || [])
        };

        await this.assessmentsTable.updateEntity(entity, 'Replace');
        
        return {
            id: assessmentId,
            customerId: customerId,
            tenantId: assessmentData.tenantId || '',
            date: new Date(),
            status: assessmentData.status || 'completed',
            score: assessmentData.score || 0,
            metrics: assessmentData.metrics,
            recommendations: assessmentData.recommendations
        };
    }

    // Assessment history operations
    async getAssessmentHistory(options?: { tenantId?: string; customerId?: string; maxItemCount?: number }): Promise<AssessmentHistory[]> {
        await this.initialize();

        const history: AssessmentHistory[] = [];
        let filter = '';
        
        if (options?.tenantId) {
            filter = odata`tenantId eq ${options.tenantId}`;
        } else if (options?.customerId) {
            filter = odata`customerId eq ${options.customerId}`;
        }

        const iterator = this.historyTable.listEntities({ queryOptions: { filter } });

        let count = 0;
        const maxItems = options?.maxItemCount || 100;

        for await (const entity of iterator) {
            if (count >= maxItems) break;
            
            history.push({
                id: entity.rowKey as string,
                tenantId: entity.tenantId as string,
                customerId: entity.customerId as string,
                date: new Date(entity.date as string),
                overallScore: entity.overallScore as number,
                categoryScores: entity.categoryScores ? JSON.parse(entity.categoryScores as string) : {}
            });
            count++;
        }

        return history;
    }

    async storeAssessmentHistory(historyData: AssessmentHistory): Promise<void> {
        await this.initialize();

        const entity = {
            partitionKey: 'history',
            rowKey: historyData.id,
            tenantId: historyData.tenantId,
            customerId: historyData.customerId || '',
            date: historyData.date.toISOString(),
            overallScore: historyData.overallScore,
            categoryScores: JSON.stringify(historyData.categoryScores)
        };

        await this.historyTable.createEntity(entity);
    }
}
