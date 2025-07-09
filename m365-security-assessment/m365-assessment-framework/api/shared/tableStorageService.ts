import { TableClient, AzureNamedKeyCredential, odata } from "@azure/data-tables";
import { DefaultAzureCredential } from "@azure/identity";

export interface Customer {
    id: string;
    tenantId: string;  // Add tenantId field
    tenantName: string;
    tenantDomain: string;
    contactEmail?: string;
    notes?: string;
    createdDate: Date | string;  // Can be Date object or ISO string
    lastAssessmentDate?: Date | string;  // Can be Date object or ISO string
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
            console.log('🔧 TableStorageService: Creating tables if they don\'t exist...');
            
            // Create tables if they don't exist with detailed logging
            await this.customersTable.createTable().catch(error => {
                if (error?.statusCode !== 409) {
                    console.error('❌ Failed to create customers table:', error);
                    throw error;
                }
                console.log('✅ Customers table already exists');
            });
            
            await this.assessmentsTable.createTable().catch(error => {
                if (error?.statusCode !== 409) {
                    console.error('❌ Failed to create assessments table:', error);
                    throw error;
                }
                console.log('✅ Assessments table already exists');
            });
            
            await this.historyTable.createTable().catch(error => {
                if (error?.statusCode !== 409) {
                    console.error('❌ Failed to create history table:', error);
                    throw error;
                }
                console.log('✅ History table already exists');
            });
            
            console.log('✅ TableStorageService: All tables initialized successfully');
            this.initialized = true;
        } catch (error: any) {
            console.error('❌ TableStorageService initialization failed:', error);
            // Don't set initialized to true on failure
            throw new Error(`Table Storage initialization failed: ${error.message || error}`);
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
                lastAssessmentDate: entity.lastAssessmentDate as string,
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
            createdDate: customer.createdDate instanceof Date ? customer.createdDate.toISOString() : customer.createdDate,
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
                lastAssessmentDate: entity.lastAssessmentDate as string,
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
            console.log('🔄 TableStorageService: Updating customer:', customerId);
            console.log('📝 TableStorageService: Update data:', JSON.stringify(updates, null, 2));

            // First get the existing customer
            const existingEntity = await this.customersTable.getEntity('customer', customerId);
            console.log('📊 TableStorageService: Existing entity:', JSON.stringify(existingEntity, null, 2));
            
            // Handle app registration update with special logging
            let newAppRegistration;
            if (updates.appRegistration) {
                console.log('🔧 TableStorageService: Updating app registration with:', JSON.stringify(updates.appRegistration, null, 2));
                newAppRegistration = JSON.stringify(updates.appRegistration);
            } else {
                newAppRegistration = existingEntity.appRegistration;
            }

            // Create updated entity - use Replace mode to ensure all changes are persisted
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
                lastAssessmentDate: updates.lastAssessmentDate 
                    ? (updates.lastAssessmentDate instanceof Date ? updates.lastAssessmentDate.toISOString() : updates.lastAssessmentDate)
                    : existingEntity.lastAssessmentDate,
                totalAssessments: updates.totalAssessments ?? existingEntity.totalAssessments ?? 0,
                appRegistration: newAppRegistration
            };

            console.log('💾 TableStorageService: Final entity to save:', JSON.stringify(updatedEntity, null, 2));

            // Update the entity (Replace mode to ensure all changes are persisted)
            await this.customersTable.updateEntity(updatedEntity, 'Replace');
            console.log('✅ TableStorageService: Entity updated successfully');

            // Verify the update by fetching the entity again
            const verificationEntity = await this.customersTable.getEntity('customer', customerId);
            console.log('🔍 TableStorageService: Verification - stored app registration:', verificationEntity.appRegistration);

            // Return the updated customer with proper app registration parsing
            let parsedAppRegistration;
            try {
                parsedAppRegistration = updatedEntity.appRegistration ? JSON.parse(updatedEntity.appRegistration as string) : undefined;
            } catch (parseError) {
                console.error('❌ TableStorageService: Failed to parse app registration:', parseError);
                parsedAppRegistration = undefined;
            }

            return {
                id: customerId,
                tenantId: updatedEntity.tenantId as string,  // Include tenant ID
                tenantName: updatedEntity.tenantName as string,
                tenantDomain: updatedEntity.tenantDomain as string,
                contactEmail: updatedEntity.contactEmail as string,
                notes: updatedEntity.notes as string,
                createdDate: new Date(updatedEntity.createdDate as string),
                lastAssessmentDate: updatedEntity.lastAssessmentDate as string,
                status: updatedEntity.status as string,
                totalAssessments: (updatedEntity.totalAssessments as number) || 0,
                appRegistration: parsedAppRegistration
            };
        } catch (error) {
            console.error('❌ TableStorageService: Failed to update customer:', error);
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
            
            // Reconstruct chunked data
            const metricsJson = this.reconstructChunkedData(entity, 'metrics');
            const recommendationsJson = this.reconstructChunkedData(entity, 'recommendations');
            
            let metrics;
            let recommendations;
            
            try {
                metrics = metricsJson ? JSON.parse(metricsJson) : undefined;
            } catch (e) {
                console.warn('Failed to parse metrics JSON:', e);
                metrics = undefined;
            }
            
            try {
                recommendations = recommendationsJson ? JSON.parse(recommendationsJson) : undefined;
            } catch (e) {
                console.warn('Failed to parse recommendations JSON:', e);
                recommendations = undefined;
            }
            
            assessments.push({
                id: entity.rowKey as string,
                customerId: entity.customerId as string,
                tenantId: entity.tenantId as string,
                date: new Date(entity.date as string),
                status: entity.status as string,
                score: entity.score as number,
                metrics,
                recommendations
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
            score: assessment.score
        };

        // Handle large data with chunking to avoid 64KB limit
        const metricsJson = JSON.stringify(assessment.metrics || {});
        const recommendationsJson = JSON.stringify(assessment.recommendations || []);
        
        console.log(`📊 Assessment data sizes - Metrics: ${metricsJson.length} chars, Recommendations: ${recommendationsJson.length} chars`);
        
        this.prepareLargeDataForStorage(entity, 'metrics', metricsJson);
        this.prepareLargeDataForStorage(entity, 'recommendations', recommendationsJson);

        try {
            await this.assessmentsTable.createEntity(entity);
            console.log('✅ Assessment created successfully with chunked data support');
            return assessment;
        } catch (error: any) {
            console.error('❌ Failed to create assessment:', error);
            // If still failing due to size, create a minimal assessment
            if (error.message?.includes('PropertyValueTooLarge') || error.message?.includes('64KB')) {
                console.log('⚠️ Creating minimal assessment due to size constraints');
                const minimalEntity = {
                    partitionKey: 'assessment',
                    rowKey: assessmentId,
                    customerId: assessment.customerId,
                    tenantId: assessment.tenantId,
                    date: assessment.date.toISOString(),
                    status: 'completed_with_size_limit',
                    score: assessment.score,
                    metrics: '{"error":"Data too large for storage"}',
                    recommendations: '[]',
                    dataSizeError: true
                };
                await this.assessmentsTable.createEntity(minimalEntity);
                return assessment;
            }
            throw error;
        }
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
            score: assessmentData.score || 0
        };

        // Handle large data with chunking to avoid 64KB limit
        const metricsJson = JSON.stringify(assessmentData.metrics || {});
        const recommendationsJson = JSON.stringify(assessmentData.recommendations || []);
        
        this.prepareLargeDataForStorage(entity, 'metrics', metricsJson);
        this.prepareLargeDataForStorage(entity, 'recommendations', recommendationsJson);

        try {
            await this.assessmentsTable.updateEntity(entity, 'Replace');
        } catch (error: any) {
            console.error('❌ Failed to update assessment:', error);
            // If still failing due to size, update with minimal data
            if (error.message?.includes('PropertyValueTooLarge') || error.message?.includes('64KB')) {
                console.log('⚠️ Updating with minimal assessment due to size constraints');
                const minimalEntity = {
                    partitionKey: 'assessment',
                    rowKey: assessmentId,
                    customerId: customerId,
                    tenantId: assessmentData.tenantId || '',
                    date: new Date().toISOString(),
                    status: 'completed_with_size_limit',
                    score: assessmentData.score || 0,
                    metrics: '{"error":"Data too large for storage"}',
                    recommendations: '[]',
                    dataSizeError: true
                };
                await this.assessmentsTable.updateEntity(minimalEntity, 'Replace');
            } else {
                throw error;
            }
        }
        
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

    // Get all assessments with optional filtering
    async getAssessments(options?: { 
        customerId?: string; 
        tenantId?: string; 
        status?: string; 
        maxItemCount?: number 
    }): Promise<{ assessments: Assessment[]; continuationToken?: string }> {
        await this.initialize();

        const assessments: Assessment[] = [];
        let filter = '';
        
        const filters: string[] = [];
        if (options?.customerId) {
            filters.push(odata`customerId eq ${options.customerId}`);
        }
        if (options?.tenantId) {
            filters.push(odata`tenantId eq ${options.tenantId}`);
        }
        if (options?.status) {
            filters.push(odata`status eq ${options.status}`);
        }
        
        if (filters.length > 0) {
            filter = filters.join(' and ');
        }

        const iterator = this.assessmentsTable.listEntities({ 
            queryOptions: { filter }
        });

        let count = 0;
        const maxItems = options?.maxItemCount || 50;

        for await (const entity of iterator) {
            if (count >= maxItems) break;

            // Reconstruct chunked data for large properties
            const metricsJson = this.reconstructChunkedData(entity, 'metrics');
            const recommendationsJson = this.reconstructChunkedData(entity, 'recommendations');

            assessments.push({
                id: entity.rowKey as string,
                customerId: entity.customerId as string,
                tenantId: entity.tenantId as string,
                date: new Date(entity.date as string),
                status: entity.status as string,
                score: entity.score as number,
                metrics: metricsJson ? JSON.parse(metricsJson) : {},
                recommendations: recommendationsJson ? JSON.parse(recommendationsJson) : []
            });

            count++;
        }

        return {
            assessments,
            continuationToken: undefined // Could be implemented for pagination
        };
    }

    /**
     * Get assessment history for a specific customer
     */
    async getCustomerAssessmentHistory(customerId: string): Promise<AssessmentHistory[]> {
        await this.initialize();

        const filter = odata`customerId eq ${customerId}`;
        const iterator = this.historyTable.listEntities({ 
            queryOptions: { filter }
        });

        const history: AssessmentHistory[] = [];
        for await (const entity of iterator) {
            history.push({
                id: entity.rowKey as string,
                tenantId: entity.tenantId as string,
                customerId: entity.customerId as string,
                date: new Date(entity.date as string),
                overallScore: entity.overallScore as number,
                categoryScores: entity.categoryScores ? JSON.parse(entity.categoryScores as string) : {}
            });
        }

        return history.sort((a, b) => b.date.getTime() - a.date.getTime());
    }

    /**
     * Get all assessment history across all tenants/customers
     */
    async getAllAssessmentHistory(): Promise<AssessmentHistory[]> {
        await this.initialize();

        const iterator = this.historyTable.listEntities();

        const history: AssessmentHistory[] = [];
        for await (const entity of iterator) {
            history.push({
                id: entity.rowKey as string,
                tenantId: entity.tenantId as string,
                customerId: entity.customerId as string,
                date: new Date(entity.date as string),
                overallScore: entity.overallScore as number,
                categoryScores: entity.categoryScores ? JSON.parse(entity.categoryScores as string) : {}
            });
        }

        return history.sort((a, b) => b.date.getTime() - a.date.getTime());
    }

    /**
     * Helper method to chunk large string data into smaller pieces for Azure Table Storage
     * Azure Table Storage has a 64KB limit per property
     */
    private chunkLargeData(data: string, maxSize: number = 60000): { chunks: string[], isChunked: boolean } {
        if (data.length <= maxSize) {
            return { chunks: [data], isChunked: false };
        }

        const chunks: string[] = [];
        for (let i = 0; i < data.length; i += maxSize) {
            chunks.push(data.substring(i, i + maxSize));
        }
        
        return { chunks, isChunked: true };
    }

    /**
     * Helper method to reconstruct chunked data
     */
    private reconstructChunkedData(entity: any, propertyName: string): string {
        if (entity[`${propertyName}_isChunked`]) {
            const chunkCount = entity[`${propertyName}_chunkCount`] || 0;
            let reconstructed = '';
            for (let i = 0; i < chunkCount; i++) {
                reconstructed += entity[`${propertyName}_chunk${i}`] || '';
            }
            return reconstructed;
        }
        return entity[propertyName] || '';
    }

    /**
     * Helper method to store large data with chunking support
     */
    private prepareLargeDataForStorage(entity: any, propertyName: string, data: string): void {
        const { chunks, isChunked } = this.chunkLargeData(data);
        
        if (isChunked) {
            // Store chunked data
            entity[`${propertyName}_isChunked`] = true;
            entity[`${propertyName}_chunkCount`] = chunks.length;
            chunks.forEach((chunk, index) => {
                entity[`${propertyName}_chunk${index}`] = chunk;
            });
            // Remove the original property to avoid confusion
            delete entity[propertyName];
        } else {
            // Store as single property
            entity[propertyName] = data;
            entity[`${propertyName}_isChunked`] = false;
        }
    }
}
