"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TableStorageService = void 0;
const data_tables_1 = require("@azure/data-tables");
/**
 * Table Storage service for M365 Assessment Framework
 * Uses Azure Table Storage as a temporary solution while Cosmos DB provider is being registered
 */
class TableStorageService {
    constructor() {
        this.initialized = false;
        // Initialize connection string - Azure Static Web Apps vs Local Development
        let connectionString;
        if (process.env.NODE_ENV === 'development' || process.env.AZURE_FUNCTIONS_ENVIRONMENT === 'Development') {
            // Local development - prefer AzureWebJobsStorage, fallback to Azure Storage or emulator
            connectionString = process.env.AzureWebJobsStorage || process.env.AZURE_STORAGE_CONNECTION_STRING || 'UseDevelopmentStorage=true';
            console.log('🔧 TableStorageService: Using local development storage');
        }
        else {
            // Azure Static Web Apps - MUST use AZURE_STORAGE_CONNECTION_STRING (AzureWebJobsStorage not allowed)
            connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || '';
            if (!connectionString) {
                console.error('❌ AZURE_STORAGE_CONNECTION_STRING not found. This is required for Azure Static Web Apps.');
                console.error('📋 Available storage environment variables:', Object.keys(process.env).filter(k => k.includes('STORAGE') || k.includes('AZURE')));
                throw new Error('AZURE_STORAGE_CONNECTION_STRING is required for Azure Static Web Apps');
            }
            console.log('☁️ TableStorageService: Using Azure Storage via AZURE_STORAGE_CONNECTION_STRING for Static Web Apps');
        }
        console.log('🌍 TableStorageService: Environment:', process.env.NODE_ENV || 'production');
        console.log('📊 TableStorageService: Using emulator:', connectionString.includes('UseDevelopmentStorage=true'));
        try {
            this.customersTable = data_tables_1.TableClient.fromConnectionString(connectionString, 'customers');
            this.assessmentsTable = data_tables_1.TableClient.fromConnectionString(connectionString, 'assessments');
            this.historyTable = data_tables_1.TableClient.fromConnectionString(connectionString, 'assessmenthistory');
        }
        catch (error) {
            console.error('❌ Failed to initialize Table Storage client:', error);
            throw new Error(`Failed to initialize Table Storage client: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async initialize() {
        if (this.initialized)
            return;
        try {
            // Create tables if they don't exist
            await this.customersTable.createTable();
            await this.assessmentsTable.createTable();
            await this.historyTable.createTable();
            this.initialized = true;
        }
        catch (error) {
            // Ignore "table already exists" errors
            if (error?.statusCode !== 409) {
                throw error;
            }
            this.initialized = true;
        }
    }
    // Customer operations
    async getCustomers(options) {
        await this.initialize();
        const customers = [];
        let filter = '';
        if (options?.status) {
            filter = (0, data_tables_1.odata) `status eq ${options.status}`;
        }
        const iterator = this.customersTable.listEntities({
            queryOptions: { filter }
        });
        let count = 0;
        const maxItems = options?.maxItemCount || 100;
        for await (const entity of iterator) {
            if (count >= maxItems)
                break;
            customers.push({
                id: entity.rowKey,
                tenantId: entity.tenantId || '', // Include tenant ID
                tenantName: entity.tenantName,
                tenantDomain: entity.tenantDomain,
                contactEmail: entity.contactEmail || '',
                notes: entity.notes || '',
                status: entity.status,
                createdDate: new Date(entity.createdDate),
                lastAssessmentDate: entity.lastAssessmentDate,
                appRegistration: entity.appRegistration ? JSON.parse(entity.appRegistration) : undefined,
                totalAssessments: entity.totalAssessments || 0
            });
            count++;
        }
        return { customers };
    }
    async getCustomerByDomain(domain) {
        await this.initialize();
        try {
            const filter = (0, data_tables_1.odata) `tenantDomain eq ${domain}`;
            const iterator = this.customersTable.listEntities({ queryOptions: { filter } });
            for await (const entity of iterator) {
                return {
                    id: entity.rowKey,
                    tenantId: entity.tenantId || '', // Include tenant ID
                    tenantName: entity.tenantName,
                    tenantDomain: entity.tenantDomain,
                    contactEmail: entity.contactEmail || '',
                    notes: entity.notes || '',
                    status: entity.status,
                    createdDate: new Date(entity.createdDate),
                    totalAssessments: entity.totalAssessments || 0,
                    appRegistration: entity.appRegistration ? JSON.parse(entity.appRegistration) : undefined
                };
            }
            return null;
        }
        catch (error) {
            console.error('Error getting customer by domain:', error);
            return null;
        }
    }
    async createCustomer(customerRequest, appRegistration) {
        await this.initialize();
        const customerId = `customer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const customer = {
            id: customerId,
            tenantId: customerRequest.tenantId || '', // Include tenant ID
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
            tenantId: customerRequest.tenantId || '', // Store the actual tenant ID
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
        }
        catch (error) {
            console.error('❌ Table Storage: Failed to create customer:', error);
            if (error?.statusCode === 409) {
                throw new Error('Customer already exists in Table Storage');
            }
            throw new Error(`Failed to create customer in Table Storage: ${error?.message || 'Unknown error'}`);
        }
    }
    async getCustomer(customerId) {
        await this.initialize();
        try {
            const entity = await this.customersTable.getEntity('customer', customerId);
            return {
                id: entity.rowKey,
                tenantId: entity.tenantId || '', // Include the tenant ID
                tenantName: entity.tenantName,
                tenantDomain: entity.tenantDomain,
                contactEmail: entity.contactEmail || '',
                notes: entity.notes || '',
                createdDate: new Date(entity.createdDate),
                lastAssessmentDate: entity.lastAssessmentDate,
                status: entity.status,
                totalAssessments: entity.totalAssessments || 0,
                appRegistration: JSON.parse(entity.appRegistration)
            };
        }
        catch (error) {
            if (error?.statusCode === 404) {
                return null;
            }
            throw error;
        }
    }
    async deleteCustomer(customerId) {
        await this.initialize();
        try {
            await this.customersTable.deleteEntity('customer', customerId);
        }
        catch (error) {
            if (error?.statusCode === 404) {
                throw new Error('Customer not found');
            }
            throw error;
        }
    }
    async updateCustomer(customerId, updates) {
        await this.initialize();
        try {
            // First get the existing customer
            const existingEntity = await this.customersTable.getEntity('customer', customerId);
            // Create updated entity
            const updatedEntity = {
                partitionKey: 'customer',
                rowKey: customerId,
                tenantId: updates.tenantId ?? existingEntity.tenantId ?? '', // Include tenant ID
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
                appRegistration: updates.appRegistration
                    ? JSON.stringify(updates.appRegistration)
                    : existingEntity.appRegistration
            };
            // Update the entity (merge mode)
            await this.customersTable.updateEntity(updatedEntity, 'Merge');
            // Return the updated customer
            return {
                id: customerId,
                tenantId: updatedEntity.tenantId, // Include tenant ID
                tenantName: updatedEntity.tenantName,
                tenantDomain: updatedEntity.tenantDomain,
                contactEmail: updatedEntity.contactEmail,
                notes: updatedEntity.notes,
                createdDate: new Date(updatedEntity.createdDate),
                lastAssessmentDate: updatedEntity.lastAssessmentDate,
                status: updatedEntity.status,
                totalAssessments: updatedEntity.totalAssessments || 0,
                appRegistration: JSON.parse(updatedEntity.appRegistration)
            };
        }
        catch (error) {
            if (error?.statusCode === 404) {
                throw new Error('Customer not found');
            }
            throw error;
        }
    }
    /**
     * Find customer by clientId from their app registration
     */
    async getCustomerByClientId(clientId) {
        await this.initialize();
        const filter = (0, data_tables_1.odata) `partitionKey eq 'customer'`;
        const iterator = this.customersTable.listEntities({ queryOptions: { filter } });
        for await (const entity of iterator) {
            const appRegistration = entity.appRegistration ? JSON.parse(entity.appRegistration) : null;
            if (appRegistration && appRegistration.clientId === clientId) {
                return {
                    id: entity.rowKey,
                    tenantId: entity.tenantId || '', // Include tenant ID
                    tenantName: entity.tenantName,
                    tenantDomain: entity.tenantDomain,
                    contactEmail: entity.contactEmail || '',
                    notes: entity.notes || '',
                    createdDate: new Date(entity.createdDate),
                    status: entity.status,
                    totalAssessments: entity.totalAssessments || 0,
                    appRegistration: appRegistration
                };
            }
        }
        return null;
    }
    // Assessment operations
    async getCustomerAssessments(customerId, options) {
        await this.initialize();
        const assessments = [];
        let filter = (0, data_tables_1.odata) `customerId eq ${customerId}`;
        if (options?.status) {
            filter = (0, data_tables_1.odata) `customerId eq ${customerId} and status eq ${options.status}`;
        }
        const iterator = this.assessmentsTable.listEntities({ queryOptions: { filter } });
        let count = 0;
        const maxItems = options?.limit || 50;
        for await (const entity of iterator) {
            if (count >= maxItems)
                break;
            assessments.push({
                id: entity.rowKey,
                customerId: entity.customerId,
                tenantId: entity.tenantId,
                date: new Date(entity.date),
                status: entity.status,
                score: entity.score,
                metrics: entity.metrics ? JSON.parse(entity.metrics) : undefined,
                recommendations: entity.recommendations ? JSON.parse(entity.recommendations) : undefined
            });
            count++;
        }
        return { assessments };
    }
    async createAssessment(assessmentData) {
        await this.initialize();
        const assessmentId = `assessment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const assessment = {
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
    async updateAssessment(assessmentId, customerId, assessmentData) {
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
    async getAssessmentHistory(options) {
        await this.initialize();
        const history = [];
        let filter = '';
        if (options?.tenantId) {
            filter = (0, data_tables_1.odata) `tenantId eq ${options.tenantId}`;
        }
        else if (options?.customerId) {
            filter = (0, data_tables_1.odata) `customerId eq ${options.customerId}`;
        }
        const iterator = this.historyTable.listEntities({ queryOptions: { filter } });
        let count = 0;
        const maxItems = options?.maxItemCount || 100;
        for await (const entity of iterator) {
            if (count >= maxItems)
                break;
            history.push({
                id: entity.rowKey,
                tenantId: entity.tenantId,
                customerId: entity.customerId,
                date: new Date(entity.date),
                overallScore: entity.overallScore,
                categoryScores: entity.categoryScores ? JSON.parse(entity.categoryScores) : {}
            });
            count++;
        }
        return history;
    }
    async storeAssessmentHistory(historyData) {
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
    async getAssessments(options) {
        await this.initialize();
        const assessments = [];
        let filter = '';
        const filters = [];
        if (options?.customerId) {
            filters.push((0, data_tables_1.odata) `customerId eq ${options.customerId}`);
        }
        if (options?.tenantId) {
            filters.push((0, data_tables_1.odata) `tenantId eq ${options.tenantId}`);
        }
        if (options?.status) {
            filters.push((0, data_tables_1.odata) `status eq ${options.status}`);
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
            if (count >= maxItems)
                break;
            assessments.push({
                id: entity.rowKey,
                customerId: entity.customerId,
                tenantId: entity.tenantId,
                date: new Date(entity.date),
                status: entity.status,
                score: entity.score,
                metrics: entity.metrics ? JSON.parse(entity.metrics) : {},
                recommendations: entity.recommendations ? JSON.parse(entity.recommendations) : []
            });
            count++;
        }
        return {
            assessments,
            continuationToken: undefined // Could be implemented for pagination
        };
    }
}
exports.TableStorageService = TableStorageService;
//# sourceMappingURL=tableStorageService.js.map