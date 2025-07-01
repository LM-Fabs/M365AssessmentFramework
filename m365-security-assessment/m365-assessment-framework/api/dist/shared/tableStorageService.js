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
        // For Azure Functions, use the AzureWebJobsStorage connection string
        const connectionString = process.env.AzureWebJobsStorage || process.env.AZURE_STORAGE_CONNECTION_STRING;
        if (!connectionString) {
            throw new Error('No storage connection string available. AzureWebJobsStorage is required for Azure Functions.');
        }
        try {
            this.customersTable = data_tables_1.TableClient.fromConnectionString(connectionString, 'customers');
            this.assessmentsTable = data_tables_1.TableClient.fromConnectionString(connectionString, 'assessments');
            this.historyTable = data_tables_1.TableClient.fromConnectionString(connectionString, 'assessmenthistory');
        }
        catch (error) {
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
                tenantName: entity.tenantName,
                tenantDomain: entity.tenantDomain,
                contactEmail: entity.contactEmail,
                notes: entity.notes,
                status: entity.status,
                createdDate: new Date(entity.createdDate),
                appRegistration: entity.appRegistration ? JSON.parse(entity.appRegistration) : undefined
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
                    tenantName: entity.tenantName,
                    tenantDomain: entity.tenantDomain,
                    contactEmail: entity.contactEmail,
                    notes: entity.notes,
                    status: entity.status,
                    createdDate: new Date(entity.createdDate),
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
            tenantName: customerRequest.tenantName,
            tenantDomain: customerRequest.tenantDomain,
            contactEmail: customerRequest.contactEmail,
            notes: customerRequest.notes,
            createdDate: new Date(),
            status: 'active',
            appRegistration
        };
        const entity = {
            partitionKey: 'customer',
            rowKey: customerId,
            tenantName: customer.tenantName,
            tenantDomain: customer.tenantDomain,
            contactEmail: customer.contactEmail || '',
            notes: customer.notes || '',
            status: customer.status,
            createdDate: customer.createdDate.toISOString(),
            appRegistration: JSON.stringify(customer.appRegistration)
        };
        await this.customersTable.createEntity(entity);
        return customer;
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
}
exports.TableStorageService = TableStorageService;
//# sourceMappingURL=tableStorageService.js.map