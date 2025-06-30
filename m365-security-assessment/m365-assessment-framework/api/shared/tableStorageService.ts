import { TableClient, AzureNamedKeyCredential, odata } from "@azure/data-tables";
import { DefaultAzureCredential } from "@azure/identity";

export interface Customer {
    id: string;
    tenantName: string;
    tenantDomain: string;
    contactEmail?: string;
    notes?: string;
    createdDate: Date;
    status: string;
    appRegistration?: {
        applicationId: string;
        clientId: string;
        servicePrincipalId: string;
        permissions: string[];
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
        // Use managed identity if available, fallback to connection string
        const accountName = process.env.STORAGE_ACCOUNT_NAME || 'm365c6qdbpkda5cvs';
        const accountUrl = `https://${accountName}.table.core.windows.net`;
        
        try {
            // Try using managed identity first (production)
            const credential = new DefaultAzureCredential();
            this.customersTable = new TableClient(accountUrl, 'customers', credential);
            this.assessmentsTable = new TableClient(accountUrl, 'assessments', credential);
            this.historyTable = new TableClient(accountUrl, 'assessmenthistory', credential);
        } catch (error) {
            // Fallback to connection string for local development
            const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
            if (connectionString) {
                this.customersTable = TableClient.fromConnectionString(connectionString, 'customers');
                this.assessmentsTable = TableClient.fromConnectionString(connectionString, 'assessments');
                this.historyTable = TableClient.fromConnectionString(connectionString, 'assessmenthistory');
            } else {
                throw new Error('No storage credentials available. Set AZURE_STORAGE_CONNECTION_STRING or configure managed identity.');
            }
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
            filter,
            select: ['RowKey', 'tenantName', 'tenantDomain', 'contactEmail', 'notes', 'status', 'createdDate', 'appRegistration']
        });

        let count = 0;
        const maxItems = options?.maxItemCount || 100;

        for await (const entity of iterator) {
            if (count >= maxItems) break;
            
            customers.push({
                id: entity.rowKey as string,
                tenantName: entity.tenantName as string,
                tenantDomain: entity.tenantDomain as string,
                contactEmail: entity.contactEmail as string,
                notes: entity.notes as string,
                status: entity.status as string,
                createdDate: new Date(entity.createdDate as string),
                appRegistration: entity.appRegistration ? JSON.parse(entity.appRegistration as string) : undefined
            });
            count++;
        }

        return { customers };
    }

    async getCustomerByDomain(domain: string): Promise<Customer | null> {
        await this.initialize();

        try {
            const filter = odata`tenantDomain eq ${domain}`;
            const iterator = this.customersTable.listEntities({ filter });

            for await (const entity of iterator) {
                return {
                    id: entity.rowKey as string,
                    tenantName: entity.tenantName as string,
                    tenantDomain: entity.tenantDomain as string,
                    contactEmail: entity.contactEmail as string,
                    notes: entity.notes as string,
                    status: entity.status as string,
                    createdDate: new Date(entity.createdDate as string),
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
    async getCustomerAssessments(customerId: string, options?: { status?: string; limit?: number }): Promise<{ assessments: Assessment[] }> {
        await this.initialize();

        const assessments: Assessment[] = [];
        let filter = odata`customerId eq ${customerId}`;
        
        if (options?.status) {
            filter = odata`customerId eq ${customerId} and status eq ${options.status}`;
        }

        const iterator = this.assessmentsTable.listEntities({ filter });

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

        const iterator = this.historyTable.listEntities({ filter });

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
