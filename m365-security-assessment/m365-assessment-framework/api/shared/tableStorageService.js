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
            // Reconstruct chunked data with improved error handling
            const metricsJson = this.reconstructChunkedData(entity, 'metrics');
            const recommendationsJson = this.reconstructChunkedData(entity, 'recommendations');
            let metrics;
            let recommendations;
            try {
                if (metricsJson && metricsJson.trim()) {
                    metrics = JSON.parse(metricsJson);
                }
                else {
                    metrics = {};
                }
            }
            catch (e) {
                console.warn('Failed to parse metrics JSON:', e, 'Raw data:', metricsJson?.substring(0, 100));
                metrics = { error: 'Failed to parse stored metrics data' };
            }
            try {
                if (recommendationsJson && recommendationsJson.trim()) {
                    recommendations = JSON.parse(recommendationsJson);
                }
                else {
                    recommendations = [];
                }
            }
            catch (e) {
                console.warn('Failed to parse recommendations JSON:', e, 'Raw data:', recommendationsJson?.substring(0, 100));
                recommendations = [];
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
        // Apply optimization more selectively based on data size and content
        let optimizedMetrics = assessment.metrics;
        if (metricsJson.length > 40000) { // Increased threshold to preserve more license data
            console.log('⚠️ Metrics data is large, applying optimization...');
            optimizedMetrics = this.optimizeMetricsForStorage(assessment.metrics);
            const optimizedSize = JSON.stringify(optimizedMetrics).length;
            console.log(`📉 Optimized metrics size: ${optimizedSize} chars (reduced from ${metricsJson.length})`);
        }
        const finalMetricsJson = JSON.stringify(optimizedMetrics || {});
        // Apply additional compression if still too large
        let finalMetrics = finalMetricsJson;
        let finalRecommendations = recommendationsJson;
        if (finalMetricsJson.length > 100000) { // If still very large
            console.log('🗜️ Applying additional compression to metrics...');
            finalMetrics = this.compressJsonData(finalMetricsJson);
        }
        if (recommendationsJson.length > 50000) { // If recommendations are large
            console.log('🗜️ Applying compression to recommendations...');
            finalRecommendations = this.compressJsonData(recommendationsJson);
        }
        this.prepareLargeDataForStorage(entity, 'metrics', finalMetrics);
        this.prepareLargeDataForStorage(entity, 'recommendations', finalRecommendations);
        try {
            await this.assessmentsTable.createEntity(entity);
            console.log('✅ Assessment created successfully with chunked data support');
            return assessment;
        }
        catch (error) {
            console.error('❌ Failed to create assessment:', error);
            console.error('❌ Error details:', {
                message: error.message,
                statusCode: error.statusCode,
                code: error.code,
                name: error.name
            });
            // Check various error conditions that indicate size issues
            const isSizeError = error.message?.includes('PropertyValueTooLarge') ||
                error.message?.includes('64KB') ||
                error.message?.includes('too large') ||
                error.message?.includes('RequestEntityTooLarge') ||
                error.statusCode === 413 ||
                error.code === 'PropertyValueTooLarge' ||
                error.code === 'RequestEntityTooLarge';
            if (isSizeError) {
                console.log('⚠️ Creating minimal assessment due to size constraints');
                console.log(`📊 Original data sizes: Metrics=${finalMetrics.length}, Recommendations=${finalRecommendations.length}`);
                // Create minimal metrics object preserving essential information
                const minimalMetrics = this.createMinimalMetrics(assessment.metrics);
                const minimalEntity = {
                    partitionKey: 'assessment',
                    rowKey: assessmentId,
                    customerId: assessment.customerId,
                    tenantId: assessment.tenantId,
                    date: assessment.date.toISOString(),
                    status: 'completed_with_size_limit',
                    score: assessment.score,
                    metrics: JSON.stringify(minimalMetrics),
                    recommendations: '[]',
                    dataSizeError: true,
                    originalDataSize: finalMetrics.length + finalRecommendations.length,
                    errorDetails: `${error.code || 'SizeLimit'}: ${error.message?.substring(0, 200) || 'Data too large'}`
                };
                await this.assessmentsTable.createEntity(minimalEntity);
                console.log('✅ Minimal assessment created due to size limit');
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
        // Apply optimization if data is large
        let optimizedMetrics = assessmentData.metrics;
        if (metricsJson.length > 40000) { // Increased threshold to preserve more license data
            console.log('⚠️ Metrics data is large, applying optimization for update...');
            optimizedMetrics = this.optimizeMetricsForStorage(assessmentData.metrics);
        }
        const finalMetricsJson = JSON.stringify(optimizedMetrics || {});
        let finalMetrics = finalMetricsJson;
        let finalRecommendations = recommendationsJson;
        if (finalMetricsJson.length > 100000) {
            finalMetrics = this.compressJsonData(finalMetricsJson);
        }
        if (recommendationsJson.length > 50000) {
            finalRecommendations = this.compressJsonData(recommendationsJson);
        }
        this.prepareLargeDataForStorage(entity, 'metrics', finalMetrics);
        this.prepareLargeDataForStorage(entity, 'recommendations', finalRecommendations);
        try {
            await this.assessmentsTable.updateEntity(entity, 'Replace');
        }
        catch (error) {
            console.error('❌ Failed to update assessment:', error);
            // Check for size-related errors
            const isSizeError = error.message?.includes('PropertyValueTooLarge') ||
                error.message?.includes('64KB') ||
                error.message?.includes('too large') ||
                error.statusCode === 413 ||
                error.code === 'PropertyValueTooLarge';
            if (isSizeError) {
                console.log('⚠️ Updating with minimal assessment due to size constraints');
                const minimalMetrics = this.createMinimalMetrics(assessmentData.metrics);
                const minimalEntity = {
                    partitionKey: 'assessment',
                    rowKey: assessmentId,
                    customerId: customerId,
                    tenantId: assessmentData.tenantId || '',
                    date: new Date().toISOString(),
                    status: 'completed_with_size_limit',
                    score: assessmentData.score || 0,
                    metrics: JSON.stringify(minimalMetrics),
                    recommendations: '[]',
                    dataSizeError: true,
                    originalDataSize: finalMetrics.length + finalRecommendations.length
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
            // Reconstruct chunked data for large properties with improved error handling
            const metricsJson = this.reconstructChunkedData(entity, 'metrics');
            const recommendationsJson = this.reconstructChunkedData(entity, 'recommendations');
            let metrics;
            let recommendations;
            try {
                if (metricsJson && metricsJson.trim()) {
                    metrics = JSON.parse(metricsJson);
                }
                else {
                    metrics = {};
                }
            }
            catch (e) {
                console.warn('Failed to parse metrics JSON in getAssessments:', e);
                metrics = { error: 'Failed to parse stored metrics data' };
            }
            try {
                if (recommendationsJson && recommendationsJson.trim()) {
                    recommendations = JSON.parse(recommendationsJson);
                }
                else {
                    recommendations = [];
                }
            }
            catch (e) {
                console.warn('Failed to parse recommendations JSON in getAssessments:', e);
                recommendations = [];
            }
            assessments.push({
                id: entity.rowKey,
                customerId: entity.customerId,
                tenantId: entity.tenantId,
                date: new Date(entity.date),
                status: entity.status,
                score: entity.score,
                metrics: metrics,
                recommendations: recommendations
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
     * Azure Table Storage has a 64KB limit per property, but we need to account for metadata overhead
     */
    chunkLargeData(data, maxSize = 50000) {
        if (!data) {
            return { chunks: [''], isChunked: false };
        }
        if (data.length <= maxSize) {
            return { chunks: [data], isChunked: false };
        }
        const chunks = [];
        for (let i = 0; i < data.length; i += maxSize) {
            chunks.push(data.substring(i, i + maxSize));
        }
        console.log(`📋 Chunked data of ${data.length} chars into ${chunks.length} chunks (max ${maxSize} chars per chunk)`);
        // Check if we have too many chunks (Azure Table Storage has limits on entity size)
        if (chunks.length > 200) {
            console.warn(`⚠️ Warning: ${chunks.length} chunks may exceed Azure Table Storage limits`);
        }
        return { chunks, isChunked: true };
    }
    /**
     * Helper method to reconstruct chunked data with improved error handling
     */
    reconstructChunkedData(entity, propertyName) {
        try {
            if (entity[`${propertyName}_isChunked`]) {
                const chunkCount = entity[`${propertyName}_chunkCount`] || 0;
                let reconstructed = '';
                for (let i = 0; i < chunkCount; i++) {
                    const chunkData = entity[`${propertyName}_chunk${i}`];
                    if (chunkData !== undefined && chunkData !== null) {
                        reconstructed += chunkData;
                    }
                }
                console.log(`📋 Reconstructed ${propertyName} from ${chunkCount} chunks, total length: ${reconstructed.length}`);
                return reconstructed;
            }
            return entity[propertyName] || '';
        }
        catch (error) {
            console.error(`❌ Error reconstructing chunked data for ${propertyName}:`, error);
            return entity[propertyName] || '';
        }
    }
    /**
     * Create minimal metrics object preserving essential information
     */
    createMinimalMetrics(originalMetrics) {
        if (!originalMetrics) {
            return { error: "Data too large for storage", hasFullData: false };
        }
        const minimal = {
            error: "Data too large for storage",
            hasFullData: false,
            originalDataDetected: true
        };
        // Preserve essential score information
        if (originalMetrics.score) {
            minimal.score = {
                overall: originalMetrics.score.overall,
                license: originalMetrics.score.license,
                secureScore: originalMetrics.score.secureScore
            };
        }
        // Preserve basic metadata
        if (originalMetrics.assessmentType) {
            minimal.assessmentType = originalMetrics.assessmentType;
        }
        if (originalMetrics.realData?.tenantInfo) {
            minimal.tenantInfo = originalMetrics.realData.tenantInfo;
        }
        // Preserve summary information for secure score if available
        if (originalMetrics.realData?.secureScore) {
            minimal.secureScore = {
                currentScore: originalMetrics.realData.secureScore.currentScore,
                maxScore: originalMetrics.realData.secureScore.maxScore,
                percentage: originalMetrics.realData.secureScore.percentage,
                summary: originalMetrics.realData.secureScore.summary,
                controlCount: originalMetrics.realData.secureScore.controlScores?.length || 0,
                truncated: true
            };
        }
        // Preserve license summary if available - enhanced for license reporting
        if (originalMetrics.realData?.licenseInfo) {
            minimal.licenseInfo = {
                totalLicenses: originalMetrics.realData.licenseInfo.totalLicenses,
                assignedLicenses: originalMetrics.realData.licenseInfo.assignedLicenses,
                utilizationRate: originalMetrics.realData.licenseInfo.utilizationRate,
                summary: originalMetrics.realData.licenseInfo.summary,
                // Preserve basic license breakdown even in minimal mode
                detailedBreakdown: originalMetrics.realData.licenseInfo.detailedBreakdown ?
                    Object.keys(originalMetrics.realData.licenseInfo.detailedBreakdown).reduce((acc, key) => {
                        const license = originalMetrics.realData.licenseInfo.detailedBreakdown[key];
                        acc[key] = {
                            total: license.total,
                            assigned: license.assigned,
                            available: license.available
                        };
                        return acc;
                    }, {}) : undefined,
                // Preserve license types for reporting
                licenseTypes: originalMetrics.realData.licenseInfo.licenseTypes || [],
                truncated: true
            };
        }
        return minimal;
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
            // If we have control scores, limit and compress them more aggressively
            if (secureScore.controlScores && Array.isArray(secureScore.controlScores)) {
                console.log(`🔧 Optimizing ${secureScore.controlScores.length} control scores for storage`);
                // Sort by importance (highest score first) and take top 30 (reduced from 50)
                const topControls = secureScore.controlScores
                    .sort((a, b) => (b.maxScore || 0) - (a.maxScore || 0))
                    .slice(0, 30)
                    .map((control) => ({
                    // Compress field names and limit string lengths more aggressively
                    n: (control.controlName || '').substring(0, 40), // name (reduced from 60)
                    c: (control.category || '').substring(0, 20), // category (reduced from 30)
                    cs: control.currentScore || 0, // current score
                    ms: control.maxScore || 0, // max score
                    s: (control.implementationStatus || '').substring(0, 15) // status (reduced from 20)
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
        // Optimize license info if present - preserve more details for license reporting
        if (optimized.realData?.licenseInfo) {
            const licenseInfo = optimized.realData.licenseInfo;
            // Keep essential license information and preserve license breakdown for reporting
            optimized.realData.licenseInfo = {
                totalLicenses: licenseInfo.totalLicenses,
                assignedLicenses: licenseInfo.assignedLicenses,
                utilizationRate: licenseInfo.utilizationRate,
                summary: licenseInfo.summary,
                // Preserve license breakdown but limit detailed descriptions
                detailedBreakdown: licenseInfo.detailedBreakdown ?
                    Object.keys(licenseInfo.detailedBreakdown).reduce((acc, key) => {
                        const license = licenseInfo.detailedBreakdown[key];
                        acc[key] = {
                            total: license.total,
                            assigned: license.assigned,
                            available: license.available,
                            // Keep short description, remove long details
                            details: license.details ? license.details.substring(0, 100) : ''
                        };
                        return acc;
                    }, {}) : undefined,
                // Preserve license types array if present
                licenseTypes: licenseInfo.licenseTypes || [],
                // Preserve subscription info if present
                subscriptions: licenseInfo.subscriptions || [],
                optimized: true
            };
        }
        // Remove verbose logging and debugging information
        if (optimized.realData?.dataFetchResults) {
            delete optimized.realData.dataFetchResults;
        }
        // Compress recommendations if present - preserve essential information
        if (optimized.recommendations && Array.isArray(optimized.recommendations)) {
            optimized.recommendations = optimized.recommendations
                .filter((rec) => rec && (rec.title || rec.description)) // Filter out empty recommendations
                .slice(0, 10)
                .map((rec) => ({
                // Keep essential recommendation fields with fallbacks
                title: rec.title || rec.name || 'Security Recommendation',
                description: rec.description || rec.detail || rec.summary || 'Recommendation details not available',
                priority: rec.priority || 'Medium',
                category: rec.category || 'Security',
                impact: rec.impact ? rec.impact.substring(0, 100) : undefined,
                effort: rec.effort || undefined
            }));
        }
        return optimized;
    }
    /**
     * Helper method to store large data with chunking support and fallback compression
     */
    prepareLargeDataForStorage(entity, propertyName, data) {
        if (!data) {
            entity[propertyName] = '';
            entity[`${propertyName}_isChunked`] = false;
            return;
        }
        const { chunks, isChunked } = this.chunkLargeData(data);
        if (isChunked) {
            // Check if we have too many chunks for Azure Table Storage
            if (chunks.length > 200) {
                console.warn(`⚠️ ${propertyName} has ${chunks.length} chunks, which may exceed Azure Table Storage limits`);
                console.log(`📦 Attempting to compress ${propertyName} data further before chunking`);
                // Try to compress the data further by removing unnecessary whitespace and formatting
                const compressedData = this.compressJsonData(data);
                const compressedResult = this.chunkLargeData(compressedData);
                if (compressedResult.chunks.length <= 200) {
                    console.log(`✅ Compression successful: reduced chunks from ${chunks.length} to ${compressedResult.chunks.length}`);
                    this.storeChunkedData(entity, propertyName, compressedResult.chunks);
                }
                else {
                    console.warn(`⚠️ Even after compression, ${propertyName} still has ${compressedResult.chunks.length} chunks`);
                    this.storeChunkedData(entity, propertyName, compressedResult.chunks);
                }
            }
            else {
                console.log(`📦 Storing ${propertyName} as ${chunks.length} chunks`);
                this.storeChunkedData(entity, propertyName, chunks);
            }
        }
        else {
            // Store as single property
            entity[propertyName] = data;
            entity[`${propertyName}_isChunked`] = false;
            console.log(`✅ ${propertyName} stored as single property (${data.length} chars)`);
        }
    }
    /**
     * Helper method to store chunked data in the entity
     */
    storeChunkedData(entity, propertyName, chunks) {
        entity[`${propertyName}_isChunked`] = true;
        entity[`${propertyName}_chunkCount`] = chunks.length;
        chunks.forEach((chunk, index) => {
            entity[`${propertyName}_chunk${index}`] = chunk;
        });
        // Remove the original property to avoid confusion
        delete entity[propertyName];
        console.log(`✅ ${propertyName} chunked successfully into ${chunks.length} parts`);
    }
    /**
     * Compress JSON data by removing unnecessary whitespace and formatting
     */
    compressJsonData(jsonString) {
        try {
            const parsed = JSON.parse(jsonString);
            return JSON.stringify(parsed); // This removes all unnecessary whitespace
        }
        catch (error) {
            console.warn('Failed to parse JSON for compression, returning original string');
            return jsonString;
        }
    }
}
exports.TableStorageService = TableStorageService;
//# sourceMappingURL=tableStorageService.js.map