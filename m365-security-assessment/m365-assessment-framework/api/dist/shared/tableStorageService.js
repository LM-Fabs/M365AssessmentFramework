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
        }
        catch (error) {
            console.error('❌ TableStorageService initialization failed:', error);
            // Don't set initialized to true on failure
            throw new Error(`Table Storage initialization failed: ${error.message || error}`);
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
            }
            else {
                newAppRegistration = existingEntity.appRegistration;
            }
            // Create updated entity - use Replace mode to ensure all changes are persisted
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
                parsedAppRegistration = updatedEntity.appRegistration ? JSON.parse(updatedEntity.appRegistration) : undefined;
            }
            catch (parseError) {
                console.error('❌ TableStorageService: Failed to parse app registration:', parseError);
                parsedAppRegistration = undefined;
            }
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
                appRegistration: parsedAppRegistration
            };
        }
        catch (error) {
            console.error('❌ TableStorageService: Failed to update customer:', error);
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
            // Reconstruct chunked data
            const metricsJson = this.reconstructChunkedData(entity, 'metrics');
            const recommendationsJson = this.reconstructChunkedData(entity, 'recommendations');
            let metrics;
            let recommendations;
            try {
                metrics = metricsJson ? JSON.parse(metricsJson) : undefined;
            }
            catch (e) {
                console.warn('Failed to parse metrics JSON:', e);
                metrics = undefined;
            }
            try {
                recommendations = recommendationsJson ? JSON.parse(recommendationsJson) : undefined;
            }
            catch (e) {
                console.warn('Failed to parse recommendations JSON:', e);
                recommendations = undefined;
            }
            assessments.push({
                id: entity.rowKey,
                customerId: entity.customerId,
                tenantId: entity.tenantId,
                date: new Date(entity.date),
                status: entity.status,
                score: entity.score,
                metrics,
                recommendations
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
            score: assessment.score
        };
        // Handle large data with compression and chunking to avoid 64KB limit
        const metricsJson = JSON.stringify(assessment.metrics || {});
        const recommendationsJson = JSON.stringify(assessment.recommendations || []);
        console.log(`📊 Assessment data sizes - Metrics: ${metricsJson.length} chars, Recommendations: ${recommendationsJson.length} chars`);
        // Optimize metrics data if it's too large
        let optimizedMetrics = assessment.metrics;
        if (metricsJson.length > 50000) { // If metrics is getting too large
            console.log('⚠️ Metrics data is large, applying optimization...');
            optimizedMetrics = this.optimizeMetricsForStorage(assessment.metrics);
            console.log(`📉 Optimized metrics size: ${JSON.stringify(optimizedMetrics).length} chars`);
        }
        const finalMetricsJson = JSON.stringify(optimizedMetrics || {});
        this.prepareLargeDataForStorage(entity, 'metrics', finalMetricsJson);
        this.prepareLargeDataForStorage(entity, 'recommendations', recommendationsJson);
        try {
            await this.assessmentsTable.createEntity(entity);
            console.log('✅ Assessment created successfully with chunked data support');
            return assessment;
        }
        catch (error) {
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
    async updateAssessment(assessmentId, customerId, assessmentData) {
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
        }
        catch (error) {
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
            }
            else {
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
            // Reconstruct chunked data for large properties
            const metricsJson = this.reconstructChunkedData(entity, 'metrics');
            const recommendationsJson = this.reconstructChunkedData(entity, 'recommendations');
            assessments.push({
                id: entity.rowKey,
                customerId: entity.customerId,
                tenantId: entity.tenantId,
                date: new Date(entity.date),
                status: entity.status,
                score: entity.score,
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
    async getCustomerAssessmentHistory(customerId) {
        await this.initialize();
        const filter = (0, data_tables_1.odata) `customerId eq ${customerId}`;
        const iterator = this.historyTable.listEntities({
            queryOptions: { filter }
        });
        const history = [];
        for await (const entity of iterator) {
            history.push({
                id: entity.rowKey,
                tenantId: entity.tenantId,
                customerId: entity.customerId,
                date: new Date(entity.date),
                overallScore: entity.overallScore,
                categoryScores: entity.categoryScores ? JSON.parse(entity.categoryScores) : {}
            });
        }
        return history.sort((a, b) => b.date.getTime() - a.date.getTime());
    }
    /**
     * Get all assessment history across all tenants/customers
     */
    async getAllAssessmentHistory() {
        await this.initialize();
        const iterator = this.historyTable.listEntities();
        const history = [];
        for await (const entity of iterator) {
            history.push({
                id: entity.rowKey,
                tenantId: entity.tenantId,
                customerId: entity.customerId,
                date: new Date(entity.date),
                overallScore: entity.overallScore,
                categoryScores: entity.categoryScores ? JSON.parse(entity.categoryScores) : {}
            });
        }
        return history.sort((a, b) => b.date.getTime() - a.date.getTime());
    }
    /**
     * Helper method to chunk large string data into smaller pieces for Azure Table Storage
     * Azure Table Storage has a 64KB limit per property
     */
    chunkLargeData(data, maxSize = 60000) {
        if (data.length <= maxSize) {
            return { chunks: [data], isChunked: false };
        }
        const chunks = [];
        for (let i = 0; i < data.length; i += maxSize) {
            chunks.push(data.substring(i, i + maxSize));
        }
        return { chunks, isChunked: true };
    }
    /**
     * Helper method to reconstruct chunked data
     */
    reconstructChunkedData(entity, propertyName) {
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
     * Optimize metrics data for storage by reducing size while preserving essential information
     */
    optimizeMetricsForStorage(metrics) {
        if (!metrics)
            return metrics;
        const optimized = { ...metrics };
        // Optimize secure score data if present
        if (optimized.realData?.secureScore) {
            const secureScore = optimized.realData.secureScore;
            // If we have control scores, limit and compress them
            if (secureScore.controlScores && Array.isArray(secureScore.controlScores)) {
                console.log(`🔧 Optimizing ${secureScore.controlScores.length} control scores for storage`);
                // Sort by importance (highest score first) and take top 50
                const topControls = secureScore.controlScores
                    .sort((a, b) => (b.maxScore || 0) - (a.maxScore || 0))
                    .slice(0, 50)
                    .map((control) => ({
                    // Compress field names and limit string lengths
                    n: (control.controlName || '').substring(0, 60), // name
                    c: (control.category || '').substring(0, 30), // category
                    cs: control.currentScore || 0, // current score
                    ms: control.maxScore || 0, // max score
                    s: (control.implementationStatus || '').substring(0, 20) // status
                }));
                optimized.realData.secureScore = {
                    currentScore: secureScore.currentScore,
                    maxScore: secureScore.maxScore,
                    percentage: secureScore.percentage,
                    lastUpdated: secureScore.lastUpdated,
                    controlScores: topControls,
                    totalControlsFound: secureScore.totalControlsFound || secureScore.controlScores.length,
                    controlsStoredCount: topControls.length,
                    compressed: true // Flag to indicate this data was compressed
                };
                console.log(`✅ Compressed control scores from ${secureScore.controlScores.length} to ${topControls.length}`);
            }
        }
        return optimized;
    }
    /**
     * Helper method to store large data with chunking support
     */
    prepareLargeDataForStorage(entity, propertyName, data) {
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
        }
        else {
            // Store as single property
            entity[propertyName] = data;
            entity[`${propertyName}_isChunked`] = false;
        }
    }
}
exports.TableStorageService = TableStorageService;
//# sourceMappingURL=tableStorageService.js.map