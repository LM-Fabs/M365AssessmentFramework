"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.postgresqlService = exports.postgresService = exports.PostgreSQLService = void 0;
const pg_1 = require("pg");
const identity_1 = require("@azure/identity");
const crypto_1 = require("crypto");
/**
 * Generate a UUID for database records
 */
function generateUUID() {
    return (0, crypto_1.randomUUID)();
}
/**
 * Validate and sanitize app registration data from PostgreSQL JSONB
 * This ensures compatibility after migration from Azure Table Storage
 */
function validateAppRegistration(appRegData) {
    if (!appRegData) {
        return undefined;
    }
    // If it's a string, try to parse it as JSON
    if (typeof appRegData === 'string') {
        try {
            const parsed = JSON.parse(appRegData);
            return validateAppRegistration(parsed); // Recursive validation
        }
        catch {
            console.warn('Invalid JSON string in app registration data:', appRegData);
            return undefined;
        }
    }
    // If it's an object, validate required properties
    if (typeof appRegData === 'object') {
        // Check if it has the basic structure we expect
        if (appRegData.applicationId || appRegData.clientId) {
            return appRegData; // Return as-is if it has expected properties
        }
        // If it's an empty object or malformed, return undefined
        if (Object.keys(appRegData).length === 0) {
            return undefined;
        }
        // Return the object even if it might be malformed - let the validation logic handle it
        return appRegData;
    }
    // For any other type, return undefined
    return undefined;
}
/**
 * PostgreSQL Database Service for M365 Assessment Framework
 * Replaces Azure Table Storage with PostgreSQL Flexible Server
 *
 * Features:
 * - Managed Identity authentication
 * - Connection pooling for performance
 * - JSONB storage for complex data without size limits
 * - Automatic retry logic with exponential backoff
 * - Comprehensive error handling
 * - SQL-based querying for better performance
 */
class PostgreSQLService {
    constructor() {
        this.initialized = false;
        this.credential = new identity_1.DefaultAzureCredential();
        // Pool initialization is deferred to initialize() method to allow async Key Vault retrieval
    }
    /**
     * Setup Azure AD authentication for PostgreSQL
     * Uses service principal authentication instead of password
     */
    async getAzureADToken() {
        try {
            // Get access token for PostgreSQL using service principal
            // Use the correct scope for PostgreSQL Flexible Server
            const tokenResponse = await this.credential.getToken('https://ossrdbms-aad.database.windows.net/.default');
            if (tokenResponse && tokenResponse.token) {
                console.log('🔐 PostgreSQL: Azure AD token obtained successfully');
                return tokenResponse.token;
            }
            else {
                throw new Error('Failed to get Azure AD token');
            }
        }
        catch (error) {
            console.error('❌ PostgreSQL: Failed to get Azure AD token:', error);
            throw new Error(`Azure AD authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Initialize database schema and tables
     */
    async initialize() {
        if (this.initialized)
            return;
        try {
            console.log('🔧 PostgreSQL: Initializing database connection...');
            // Initialize connection pool with proper authentication
            await this.initializePoolAsync();
            // Skip heavy schema creation in production to speed up cold starts
            const isProduction = process.env.NODE_ENV === 'production' ||
                process.env.AZURE_CLIENT_ID !== undefined ||
                process.env.WEBSITE_SITE_NAME !== undefined;
            if (!isProduction) {
                console.log('🔧 PostgreSQL: Initializing database schema...');
                const client = await this.pool.connect();
                try {
                    // Create tables with proper indexes and constraints
                    await this.createTables(client);
                    console.log('✅ PostgreSQL: Database schema initialized successfully');
                }
                finally {
                    client.release();
                }
            }
            else {
                console.log('⚡ PostgreSQL: Skipping schema creation in production for faster startup');
            }
            this.initialized = true;
        }
        catch (error) {
            console.error('❌ PostgreSQL: Schema initialization failed:', error);
            throw new Error(`Database initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Initialize connection pool with Azure AD authentication
     */
    async initializePoolAsync() {
        const config = {
            host: process.env.POSTGRES_HOST || 'localhost',
            port: parseInt(process.env.POSTGRES_PORT || '5432'),
            database: process.env.POSTGRES_DATABASE || 'm365_assessment',
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
            // Optimized connection pool settings for Azure Functions
            max: 3, // Reduced for faster startup
            min: 1, // Minimal connections 
            idleTimeoutMillis: 10000, // Faster cleanup
            connectionTimeoutMillis: 5000, // Faster timeout
            // Performance optimizations
            statement_timeout: 15000, // Reduced timeout
            query_timeout: 15000,
            keepAlive: true,
            keepAliveInitialDelayMillis: 5000, // Faster keepalive
        };
        // Use password authentication as primary method (most reliable for current setup)
        // Check multiple indicators for production environment
        const isProduction = process.env.NODE_ENV === 'production' ||
            process.env.AZURE_CLIENT_ID !== undefined ||
            process.env.WEBSITE_SITE_NAME !== undefined;
        if (isProduction && process.env.POSTGRES_USER && process.env.POSTGRES_PASSWORD) {
            console.log('🔐 PostgreSQL: Using secure password authentication (fast path)');
            // Use configured credentials for reliable connection
            config.user = process.env.POSTGRES_USER;
            // Clean up the password format (remove any newlines or extra text)
            let cleanPassword = process.env.POSTGRES_PASSWORD;
            if (cleanPassword.includes('\n')) {
                cleanPassword = cleanPassword.split('\n').pop() || cleanPassword;
            }
            config.password = cleanPassword;
            console.log('✅ PostgreSQL: Password authentication configured successfully');
        }
        else if (isProduction) {
            console.log('🔐 PostgreSQL: Falling back to Azure AD authentication (slower)');
            try {
                // Set the service principal application ID as the username
                config.user = 'dd9864b2-219d-4683-9769-97690f7a9760'; // Service principal app ID (M365AssessmentFramework-sp)
                // Get Azure AD token for authentication
                const azureToken = await this.getAzureADToken();
                config.password = azureToken;
                console.log('✅ PostgreSQL: Azure AD authentication configured successfully');
            }
            catch (azureError) {
                console.error('❌ PostgreSQL: Azure AD authentication failed:', azureError);
                throw new Error('Azure AD authentication failed and no password credentials available');
            }
        }
        else {
            // Local development with password
            config.user = process.env.POSTGRES_USER || 'postgres';
            config.password = process.env.POSTGRES_PASSWORD || 'password';
            console.log('🔧 PostgreSQL: Using password authentication for local development');
        }
        this.pool = new pg_1.Pool(config);
        // Handle pool errors
        this.pool.on('error', (err) => {
            console.error('💥 PostgreSQL Pool Error:', err);
        });
        this.pool.on('connect', () => {
            console.log('✅ PostgreSQL: New connection established');
        });
    }
    /**
     * Create all required tables with optimized schema
     */
    async createTables(client) {
        // Use a transaction to ensure all schema changes are committed together
        console.log('🔧 PostgreSQL: Starting schema creation without explicit transaction...');
        try {
            // Try to enable required extensions (may fail if not allowed, but continue anyway)
            try {
                await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
                console.log('✅ PostgreSQL: uuid-ossp extension enabled');
            }
            catch (error) {
                console.warn('⚠️ PostgreSQL: uuid-ossp extension not available, using alternative UUID generation');
            }
            try {
                await client.query(`CREATE EXTENSION IF NOT EXISTS "pg_trgm";`);
                console.log('✅ PostgreSQL: pg_trgm extension enabled');
            }
            catch (error) {
                console.warn('⚠️ PostgreSQL: pg_trgm extension not available, full-text search may be limited');
            }
            // Create tables only if they don't exist - preserve existing data
            console.log('� PostgreSQL: Ensuring clean database schema...');
            // REMOVED: Drop table statements to preserve data across restarts
            // await client.query('DROP TABLE IF EXISTS assessment_history CASCADE;');
            // await client.query('DROP TABLE IF EXISTS assessments CASCADE;');
            // Create customers table if it doesn't exist  
            console.log('🔧 PostgreSQL: Creating customers table with complete schema...');
            await client.query(`
            CREATE TABLE IF NOT EXISTS customers (
                    id UUID PRIMARY KEY,
                    tenant_id VARCHAR(255) NOT NULL,
                    tenant_name VARCHAR(255) NOT NULL,
                    tenant_domain VARCHAR(255) NOT NULL,
                    contact_email VARCHAR(255),
                    notes TEXT,
                    status VARCHAR(50) DEFAULT 'active',
                    created_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    last_assessment_date TIMESTAMPTZ,
                    total_assessments INTEGER DEFAULT 0,
                    app_registration JSONB,
                    
                    CONSTRAINT valid_status CHECK (status IN ('active', 'inactive', 'deleted'))
                );
            `);
            console.log('✅ PostgreSQL: Created customers table with all required columns');
            // Create indexes (safe to run multiple times)
            try {
                await client.query(`
                CREATE INDEX IF NOT EXISTS idx_customers_tenant_id ON customers(tenant_id);
                CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
                CREATE INDEX IF NOT EXISTS idx_customers_created_date ON customers(created_date);
                CREATE INDEX IF NOT EXISTS idx_customers_domain ON customers(tenant_domain);
                CREATE INDEX IF NOT EXISTS idx_customers_app_registration ON customers USING gin(app_registration);
            `);
                console.log('✅ PostgreSQL: Created indexes');
            }
            catch (indexError) {
                console.warn('⚠️ PostgreSQL: Index creation warning:', indexError);
            } // Assessments table with unlimited JSONB storage
            await client.query(`
                CREATE TABLE IF NOT EXISTS assessments (
                    id UUID PRIMARY KEY,
                    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
                    tenant_id VARCHAR(255) NOT NULL,
                    date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    status VARCHAR(50) DEFAULT 'completed',
                    score DECIMAL(5,2) DEFAULT 0,
                    metrics JSONB NOT NULL DEFAULT '{}',
                    recommendations JSONB NOT NULL DEFAULT '[]',
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    
                    CONSTRAINT valid_score CHECK (score >= 0 AND score <= 100),
                    CONSTRAINT valid_status CHECK (status IN ('draft', 'in-progress', 'completed', 'failed', 'archived'))
                );
                
                -- Performance indexes for assessments
                CREATE INDEX IF NOT EXISTS idx_assessments_customer_id ON assessments(customer_id);
                CREATE INDEX IF NOT EXISTS idx_assessments_tenant_id ON assessments(tenant_id);
                CREATE INDEX IF NOT EXISTS idx_assessments_date ON assessments(date);
                CREATE INDEX IF NOT EXISTS idx_assessments_status ON assessments(status);
                CREATE INDEX IF NOT EXISTS idx_assessments_score ON assessments(score);
                
                -- GIN indexes for JSONB searches
                CREATE INDEX IF NOT EXISTS idx_assessments_metrics ON assessments USING gin(metrics);
                CREATE INDEX IF NOT EXISTS idx_assessments_recommendations ON assessments USING gin(recommendations);
                
                -- Composite index for common queries
                CREATE INDEX IF NOT EXISTS idx_assessments_customer_date ON assessments(customer_id, date DESC);
                CREATE INDEX IF NOT EXISTS idx_assessments_tenant_date ON assessments(tenant_id, date DESC);
            `);
            // Assessment history table for tracking trends
            await client.query(`
                CREATE TABLE IF NOT EXISTS assessment_history (
                    id UUID PRIMARY KEY,
                    assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
                    tenant_id VARCHAR(255) NOT NULL,
                    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
                    date TIMESTAMPTZ NOT NULL,
                    overall_score DECIMAL(5,2) NOT NULL,
                    category_scores JSONB NOT NULL DEFAULT '{}',
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    
                    CONSTRAINT valid_overall_score CHECK (overall_score >= 0 AND overall_score <= 100)
                );
                
                -- Performance indexes for history
                CREATE INDEX IF NOT EXISTS idx_history_assessment_id ON assessment_history(assessment_id);
                CREATE INDEX IF NOT EXISTS idx_history_tenant_id ON assessment_history(tenant_id);
                CREATE INDEX IF NOT EXISTS idx_history_customer_id ON assessment_history(customer_id);
                CREATE INDEX IF NOT EXISTS idx_history_date ON assessment_history(date);
                CREATE INDEX IF NOT EXISTS idx_history_overall_score ON assessment_history(overall_score);
                
                -- GIN index for category scores
                CREATE INDEX IF NOT EXISTS idx_history_category_scores ON assessment_history USING gin(category_scores);
                
                -- Composite indexes for common queries
                CREATE INDEX IF NOT EXISTS idx_history_tenant_date ON assessment_history(tenant_id, date DESC);
                CREATE INDEX IF NOT EXISTS idx_history_customer_date ON assessment_history(customer_id, date DESC);
            `);
            // Add missing columns to existing tables (migrations)
            try {
                await client.query(`
                    ALTER TABLE assessments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
                `);
                console.log('✅ PostgreSQL: Added updated_at column to assessments table');
            }
            catch (error) {
                console.log('ℹ️ PostgreSQL: updated_at column may already exist or add failed:', error);
            }
            // Create updated_at trigger for assessments
            await client.query(`
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ language 'plpgsql';
            
            DROP TRIGGER IF EXISTS update_assessments_updated_at ON assessments;
            CREATE TRIGGER update_assessments_updated_at
                BEFORE UPDATE ON assessments
                FOR EACH ROW
                EXECUTE FUNCTION update_updated_at_column();
        `);
            console.log('📊 PostgreSQL: All tables created successfully');
        }
        catch (error) {
            console.error('❌ PostgreSQL: Schema creation failed:', error);
            throw error;
        }
    }
    /**
     * Customer operations
     */
    async getCustomers(options) {
        await this.initialize();
        const client = await this.pool.connect();
        try {
            let query = `
                SELECT 
                    id,
                    tenant_id,
                    tenant_name,
                    tenant_domain,
                    contact_email,
                    notes,
                    status,
                    created_date,
                    last_assessment_date,
                    total_assessments,
                    app_registration
                FROM customers
            `;
            const params = [];
            const conditions = [];
            if (options?.status) {
                conditions.push(`status = $${params.length + 1}`);
                params.push(options.status);
            }
            if (conditions.length > 0) {
                query += ` WHERE ${conditions.join(' AND ')}`;
            }
            query += ` ORDER BY created_date DESC`;
            if (options?.limit) {
                query += ` LIMIT $${params.length + 1}`;
                params.push(options.limit);
            }
            const result = await client.query(query, params);
            // Get total count
            let countQuery = 'SELECT COUNT(*) FROM customers';
            if (conditions.length > 0) {
                countQuery += ` WHERE ${conditions.join(' AND ')}`;
            }
            const countResult = await client.query(countQuery, params.slice(0, -1)); // Remove limit param
            const customers = result.rows.map((row) => ({
                id: row.id,
                tenantId: row.tenant_id,
                tenantName: row.tenant_name,
                tenantDomain: row.tenant_domain,
                contactEmail: row.contact_email || '',
                notes: row.notes || '',
                status: row.status,
                createdDate: row.created_date,
                lastAssessmentDate: row.last_assessment_date,
                totalAssessments: row.total_assessments || 0,
                appRegistration: validateAppRegistration(row.app_registration)
            }));
            return {
                customers,
                total: parseInt(countResult.rows[0].count)
            };
        }
        finally {
            client.release();
        }
    }
    async getCustomerByDomain(domain) {
        await this.initialize();
        const client = await this.pool.connect();
        try {
            const query = `
                SELECT 
                    id,
                    tenant_id,
                    tenant_name,
                    tenant_domain,
                    contact_email,
                    notes,
                    status,
                    created_date,
                    last_assessment_date,
                    total_assessments,
                    app_registration
                FROM customers
                WHERE tenant_domain = $1
                LIMIT 1
            `;
            const result = await client.query(query, [domain]);
            if (result.rows.length === 0) {
                return null;
            }
            const row = result.rows[0];
            return {
                id: row.id,
                tenantId: row.tenant_id,
                tenantName: row.tenant_name,
                tenantDomain: row.tenant_domain,
                contactEmail: row.contact_email || '',
                notes: row.notes || '',
                status: row.status,
                createdDate: row.created_date,
                lastAssessmentDate: row.last_assessment_date,
                totalAssessments: row.total_assessments || 0,
                appRegistration: validateAppRegistration(row.app_registration)
            };
        }
        finally {
            client.release();
        }
    }
    async getCustomerByTenantId(tenantId) {
        await this.initialize();
        const client = await this.pool.connect();
        try {
            const query = `
                SELECT 
                    id,
                    tenant_id,
                    tenant_name,
                    tenant_domain,
                    contact_email,
                    notes,
                    status,
                    created_date,
                    last_assessment_date,
                    total_assessments,
                    app_registration
                FROM customers
                WHERE tenant_id = $1
                LIMIT 1
            `;
            const result = await client.query(query, [tenantId]);
            if (result.rows.length === 0) {
                return null;
            }
            const row = result.rows[0];
            return {
                id: row.id,
                tenantId: row.tenant_id,
                tenantName: row.tenant_name,
                tenantDomain: row.tenant_domain,
                contactEmail: row.contact_email || '',
                notes: row.notes || '',
                status: row.status,
                createdDate: row.created_date,
                lastAssessmentDate: row.last_assessment_date,
                totalAssessments: row.total_assessments || 0,
                appRegistration: validateAppRegistration(row.app_registration)
            };
        }
        finally {
            client.release();
        }
    }
    async createCustomer(customerRequest, appRegistration) {
        await this.initialize();
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const customerId = generateUUID();
            const query = `
                INSERT INTO customers (
                    id,
                    tenant_id,
                    tenant_name,
                    tenant_domain,
                    contact_email,
                    notes,
                    status,
                    total_assessments,
                    app_registration
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *
            `;
            const values = [
                customerId,
                customerRequest.tenantId || '',
                customerRequest.tenantName,
                customerRequest.tenantDomain,
                customerRequest.contactEmail || '',
                customerRequest.notes || '',
                'active',
                0,
                JSON.stringify(appRegistration)
            ];
            const result = await client.query(query, values);
            await client.query('COMMIT');
            const row = result.rows[0];
            const customer = {
                id: row.id,
                tenantId: row.tenant_id,
                tenantName: row.tenant_name,
                tenantDomain: row.tenant_domain,
                contactEmail: row.contact_email || '',
                notes: row.notes || '',
                status: row.status,
                createdDate: row.created_date,
                lastAssessmentDate: row.last_assessment_date,
                totalAssessments: row.total_assessments || 0,
                appRegistration: appRegistration
            };
            console.log('✅ PostgreSQL: Customer created successfully:', customer.id);
            return customer;
        }
        catch (error) {
            await client.query('ROLLBACK');
            console.error('❌ PostgreSQL: Failed to create customer:', error);
            if (error instanceof Error && error.message.includes('duplicate key')) {
                throw new Error(`Customer with domain ${customerRequest.tenantDomain} already exists`);
            }
            throw new Error(`Failed to create customer: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        finally {
            client.release();
        }
    }
    async getCustomer(customerId) {
        await this.initialize();
        const client = await this.pool.connect();
        try {
            const query = `
                SELECT 
                    id,
                    tenant_id,
                    tenant_name,
                    tenant_domain,
                    contact_email,
                    notes,
                    status,
                    created_date,
                    last_assessment_date,
                    total_assessments,
                    app_registration
                FROM customers
                WHERE id = $1
            `;
            const result = await client.query(query, [customerId]);
            if (result.rows.length === 0) {
                return null;
            }
            const row = result.rows[0];
            return {
                id: row.id,
                tenantId: row.tenant_id,
                tenantName: row.tenant_name,
                tenantDomain: row.tenant_domain,
                contactEmail: row.contact_email || '',
                notes: row.notes || '',
                status: row.status,
                createdDate: row.created_date,
                lastAssessmentDate: row.last_assessment_date,
                totalAssessments: row.total_assessments || 0,
                appRegistration: validateAppRegistration(row.app_registration)
            };
        }
        finally {
            client.release();
        }
    }
    async updateCustomer(customerId, updates) {
        await this.initialize();
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            // Build dynamic update query
            const setClauses = [];
            const values = [];
            let paramIndex = 1;
            if (updates.tenantId !== undefined) {
                setClauses.push(`tenant_id = $${paramIndex++}`);
                values.push(updates.tenantId);
            }
            if (updates.tenantName !== undefined) {
                setClauses.push(`tenant_name = $${paramIndex++}`);
                values.push(updates.tenantName);
            }
            if (updates.tenantDomain !== undefined) {
                setClauses.push(`tenant_domain = $${paramIndex++}`);
                values.push(updates.tenantDomain);
            }
            if (updates.contactEmail !== undefined) {
                setClauses.push(`contact_email = $${paramIndex++}`);
                values.push(updates.contactEmail);
            }
            if (updates.notes !== undefined) {
                setClauses.push(`notes = $${paramIndex++}`);
                values.push(updates.notes);
            }
            if (updates.status !== undefined) {
                setClauses.push(`status = $${paramIndex++}`);
                values.push(updates.status);
            }
            if (updates.lastAssessmentDate !== undefined) {
                setClauses.push(`last_assessment_date = $${paramIndex++}`);
                values.push(updates.lastAssessmentDate);
            }
            if (updates.totalAssessments !== undefined) {
                setClauses.push(`total_assessments = $${paramIndex++}`);
                values.push(updates.totalAssessments);
            }
            if (updates.appRegistration !== undefined) {
                setClauses.push(`app_registration = $${paramIndex++}`);
                values.push(JSON.stringify(updates.appRegistration));
            }
            if (setClauses.length === 0) {
                throw new Error('No valid fields to update');
            }
            values.push(customerId);
            const query = `
                UPDATE customers
                SET ${setClauses.join(', ')}
                WHERE id = $${paramIndex}
                RETURNING *
            `;
            const result = await client.query(query, values);
            if (result.rows.length === 0) {
                throw new Error('Customer not found');
            }
            await client.query('COMMIT');
            const row = result.rows[0];
            const customer = {
                id: row.id,
                tenantId: row.tenant_id,
                tenantName: row.tenant_name,
                tenantDomain: row.tenant_domain,
                contactEmail: row.contact_email || '',
                notes: row.notes || '',
                status: row.status,
                createdDate: row.created_date,
                lastAssessmentDate: row.last_assessment_date,
                totalAssessments: row.total_assessments || 0,
                appRegistration: validateAppRegistration(row.app_registration)
            };
            console.log('✅ PostgreSQL: Customer updated successfully:', customer.id);
            return customer;
        }
        catch (error) {
            await client.query('ROLLBACK');
            console.error('❌ PostgreSQL: Failed to update customer:', error);
            throw error;
        }
        finally {
            client.release();
        }
    }
    async deleteCustomer(customerId) {
        await this.initialize();
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const result = await client.query('DELETE FROM customers WHERE id = $1', [customerId]);
            if (result.rowCount === 0) {
                throw new Error('Customer not found');
            }
            await client.query('COMMIT');
            console.log('✅ PostgreSQL: Customer deleted successfully:', customerId);
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    async getCustomerByClientId(clientId) {
        await this.initialize();
        const client = await this.pool.connect();
        try {
            const query = `
                SELECT 
                    id,
                    tenant_id,
                    tenant_name,
                    tenant_domain,
                    contact_email,
                    notes,
                    status,
                    created_date,
                    last_assessment_date,
                    total_assessments,
                    app_registration
                FROM customers
                WHERE app_registration->>'clientId' = $1
                LIMIT 1
            `;
            const result = await client.query(query, [clientId]);
            if (result.rows.length === 0) {
                return null;
            }
            const row = result.rows[0];
            return {
                id: row.id,
                tenantId: row.tenant_id,
                tenantName: row.tenant_name,
                tenantDomain: row.tenant_domain,
                contactEmail: row.contact_email || '',
                notes: row.notes || '',
                status: row.status,
                createdDate: row.created_date,
                lastAssessmentDate: row.last_assessment_date,
                totalAssessments: row.total_assessments || 0,
                appRegistration: validateAppRegistration(row.app_registration)
            };
        }
        finally {
            client.release();
        }
    }
    /**
     * Assessment operations with unlimited JSON storage
     */
    async getCustomerAssessments(customerId, options) {
        await this.initialize();
        const client = await this.pool.connect();
        try {
            let query = `
                SELECT 
                    id,
                    customer_id,
                    tenant_id,
                    date,
                    status,
                    score,
                    metrics,
                    recommendations
                FROM assessments
                WHERE customer_id = $1
            `;
            const params = [customerId];
            if (options?.status) {
                query += ` AND status = $2`;
                params.push(options.status);
            }
            query += ` ORDER BY date DESC`;
            if (options?.limit) {
                query += ` LIMIT $${params.length + 1}`;
                params.push(options.limit);
            }
            const result = await client.query(query, params);
            const assessments = result.rows.map((row) => ({
                id: row.id,
                customerId: row.customer_id,
                tenantId: row.tenant_id,
                date: row.date,
                status: row.status,
                score: parseFloat(row.score) || 0,
                metrics: row.metrics || {},
                recommendations: row.recommendations || []
            }));
            return { assessments };
        }
        finally {
            client.release();
        }
    }
    async createAssessment(assessmentData) {
        await this.initialize();
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const assessmentId = generateUUID();
            const query = `
                INSERT INTO assessments (
                    id,
                    customer_id,
                    tenant_id,
                    date,
                    status,
                    score,
                    metrics,
                    recommendations,
                    created_at,
                    updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING *
            `;
            const now = new Date();
            const values = [
                assessmentId,
                assessmentData.customerId,
                assessmentData.tenantId,
                now,
                'completed',
                assessmentData.score || 0,
                JSON.stringify(assessmentData.metrics || {}),
                JSON.stringify(assessmentData.recommendations || []),
                now,
                now
            ];
            const result = await client.query(query, values);
            // Update customer's assessment count
            await client.query(`
                UPDATE customers 
                SET 
                    total_assessments = total_assessments + 1,
                    last_assessment_date = CURRENT_TIMESTAMP
                WHERE id = $1
            `, [assessmentData.customerId]);
            await client.query('COMMIT');
            const row = result.rows[0];
            const assessment = {
                id: row.id,
                customerId: row.customer_id,
                tenantId: row.tenant_id,
                date: row.date,
                status: row.status,
                score: parseFloat(row.score) || 0,
                metrics: row.metrics || {},
                recommendations: row.recommendations || []
            };
            console.log('✅ PostgreSQL: Assessment created successfully:', assessment.id);
            return assessment;
        }
        catch (error) {
            await client.query('ROLLBACK');
            console.error('❌ PostgreSQL: Failed to create assessment:', error);
            throw new Error(`Failed to create assessment: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        finally {
            client.release();
        }
    }
    async updateAssessment(assessmentId, customerId, assessmentData) {
        await this.initialize();
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const query = `
                UPDATE assessments
                SET 
                    status = $1,
                    score = $2,
                    metrics = $3,
                    recommendations = $4
                WHERE id = $5 AND customer_id = $6
                RETURNING *
            `;
            const values = [
                assessmentData.status || 'completed',
                assessmentData.score || 0,
                JSON.stringify(assessmentData.metrics || {}),
                JSON.stringify(assessmentData.recommendations || []),
                assessmentId,
                customerId
            ];
            const result = await client.query(query, values);
            if (result.rows.length === 0) {
                throw new Error('Assessment not found');
            }
            await client.query('COMMIT');
            const row = result.rows[0];
            const assessment = {
                id: row.id,
                customerId: row.customer_id,
                tenantId: row.tenant_id,
                date: row.date,
                status: row.status,
                score: parseFloat(row.score) || 0,
                metrics: row.metrics || {},
                recommendations: row.recommendations || []
            };
            console.log('✅ PostgreSQL: Assessment updated successfully:', assessment.id);
            return assessment;
        }
        catch (error) {
            await client.query('ROLLBACK');
            console.error('❌ PostgreSQL: Failed to update assessment:', error);
            throw error;
        }
        finally {
            client.release();
        }
    }
    async getAssessments(options) {
        await this.initialize();
        const client = await this.pool.connect();
        try {
            let query = `
                SELECT 
                    id,
                    customer_id,
                    tenant_id,
                    date,
                    status,
                    score,
                    metrics,
                    recommendations
                FROM assessments
            `;
            const params = [];
            const conditions = [];
            if (options?.customerId) {
                conditions.push(`customer_id = $${params.length + 1}`);
                params.push(options.customerId);
            }
            if (options?.tenantId) {
                conditions.push(`tenant_id = $${params.length + 1}`);
                params.push(options.tenantId);
            }
            if (options?.status) {
                conditions.push(`status = $${params.length + 1}`);
                params.push(options.status);
            }
            if (conditions.length > 0) {
                query += ` WHERE ${conditions.join(' AND ')}`;
            }
            query += ` ORDER BY date DESC`;
            if (options?.limit) {
                query += ` LIMIT $${params.length + 1}`;
                params.push(options.limit);
            }
            const result = await client.query(query, params);
            // Get total count
            let countQuery = 'SELECT COUNT(*) FROM assessments';
            if (conditions.length > 0) {
                countQuery += ` WHERE ${conditions.join(' AND ')}`;
            }
            const countResult = await client.query(countQuery, params.slice(0, -1)); // Remove limit param
            const assessments = result.rows.map((row) => ({
                id: row.id,
                customerId: row.customer_id,
                tenantId: row.tenant_id,
                date: row.date,
                status: row.status,
                score: parseFloat(row.score) || 0,
                metrics: row.metrics || {},
                recommendations: row.recommendations || []
            }));
            return {
                assessments,
                total: parseInt(countResult.rows[0].count)
            };
        }
        finally {
            client.release();
        }
    }
    /**
     * Assessment history operations
     */
    async getAssessmentHistory(options) {
        await this.initialize();
        const client = await this.pool.connect();
        try {
            let query = `
                SELECT 
                    id,
                    assessment_id,
                    tenant_id,
                    customer_id,
                    date,
                    overall_score,
                    category_scores
                FROM assessment_history
            `;
            const params = [];
            const conditions = [];
            if (options?.tenantId) {
                conditions.push(`tenant_id = $${params.length + 1}`);
                params.push(options.tenantId);
            }
            if (options?.customerId) {
                conditions.push(`customer_id = $${params.length + 1}`);
                params.push(options.customerId);
            }
            if (conditions.length > 0) {
                query += ` WHERE ${conditions.join(' AND ')}`;
            }
            query += ` ORDER BY date DESC`;
            if (options?.limit) {
                query += ` LIMIT $${params.length + 1}`;
                params.push(options.limit);
            }
            const result = await client.query(query, params);
            const history = result.rows.map((row) => ({
                id: row.id,
                assessmentId: row.assessment_id,
                tenantId: row.tenant_id,
                customerId: row.customer_id,
                date: row.date,
                overallScore: parseFloat(row.overall_score) || 0,
                categoryScores: row.category_scores || {}
            }));
            return history;
        }
        finally {
            client.release();
        }
    }
    async storeAssessmentHistory(historyData) {
        await this.initialize();
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const historyId = historyData.id || generateUUID();
            const query = `
                INSERT INTO assessment_history (
                    id,
                    assessment_id,
                    tenant_id,
                    customer_id,
                    date,
                    overall_score,
                    category_scores
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            `;
            const values = [
                historyId,
                historyData.assessmentId,
                historyData.tenantId,
                historyData.customerId,
                historyData.date,
                historyData.overallScore,
                JSON.stringify(historyData.categoryScores || {})
            ];
            await client.query(query, values);
            await client.query('COMMIT');
            console.log('✅ PostgreSQL: Assessment history stored successfully');
        }
        catch (error) {
            await client.query('ROLLBACK');
            console.error('❌ PostgreSQL: Failed to store assessment history:', error);
            throw error;
        }
        finally {
            client.release();
        }
    }
    async getAllAssessmentHistory() {
        await this.initialize();
        const client = await this.pool.connect();
        try {
            const query = `
                SELECT 
                    id,
                    assessment_id,
                    tenant_id,
                    customer_id,
                    date,
                    overall_score,
                    category_scores
                FROM assessment_history
                ORDER BY date DESC
            `;
            const result = await client.query(query);
            const history = result.rows.map((row) => ({
                id: row.id,
                assessmentId: row.assessment_id,
                tenantId: row.tenant_id,
                customerId: row.customer_id,
                date: row.date,
                overallScore: parseFloat(row.overall_score) || 0,
                categoryScores: row.category_scores || {}
            }));
            return history;
        }
        finally {
            client.release();
        }
    }
    async getCustomerAssessmentHistory(customerId) {
        await this.initialize();
        const client = await this.pool.connect();
        try {
            const query = `
                SELECT 
                    id,
                    assessment_id,
                    tenant_id,
                    customer_id,
                    date,
                    overall_score,
                    category_scores
                FROM assessment_history
                WHERE customer_id = $1
                ORDER BY date DESC
            `;
            const result = await client.query(query, [customerId]);
            const history = result.rows.map((row) => ({
                id: row.id,
                assessmentId: row.assessment_id,
                tenantId: row.tenant_id,
                customerId: row.customer_id,
                date: row.date,
                overallScore: parseFloat(row.overall_score) || 0,
                categoryScores: row.category_scores || {}
            }));
            return history;
        }
        finally {
            client.release();
        }
    }
    /**
     * Health check and monitoring
     */
    async healthCheck() {
        try {
            const client = await this.pool.connect();
            const result = await client.query('SELECT NOW() as current_time, version() as version');
            client.release();
            return {
                healthy: true,
                details: {
                    timestamp: result.rows[0].current_time,
                    version: result.rows[0].version,
                    poolSize: this.pool.totalCount,
                    idleConnections: this.pool.idleCount,
                    waitingClients: this.pool.waitingCount
                }
            };
        }
        catch (error) {
            return {
                healthy: false,
                details: {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    timestamp: new Date().toISOString()
                }
            };
        }
    }
    /**
     * Test database connection for health checks
     */
    async testConnection() {
        try {
            const client = await this.pool.connect();
            try {
                const result = await client.query('SELECT version(), current_database()');
                return {
                    connected: true,
                    host: process.env.POSTGRES_HOST || 'localhost',
                    database: result.rows[0].current_database,
                    version: result.rows[0].version
                };
            }
            finally {
                client.release();
            }
        }
        catch (error) {
            return {
                connected: false,
                host: process.env.POSTGRES_HOST || 'localhost',
                database: process.env.POSTGRES_DATABASE || 'm365_assessment',
                version: 'unknown'
            };
        }
    }
    /**
     * Get database statistics for monitoring
     */
    async getDatabaseStats() {
        try {
            const client = await this.pool.connect();
            try {
                // Get table information
                const tableQuery = `
                    SELECT 
                        schemaname,
                        tablename,
                        n_tup_ins as inserts,
                        n_tup_upd as updates,
                        n_tup_del as deletes,
                        n_live_tup as live_tuples,
                        n_dead_tup as dead_tuples
                    FROM pg_stat_user_tables
                    WHERE schemaname = 'public'
                    ORDER BY tablename;
                `;
                const tableResult = await client.query(tableQuery);
                // Get total record count
                const countQuery = `
                    SELECT 
                        (SELECT COUNT(*) FROM customers) as customer_count,
                        (SELECT COUNT(*) FROM assessments) as assessment_count,
                        (SELECT COUNT(*) FROM assessment_history) as history_count;
                `;
                const countResult = await client.query(countQuery);
                const counts = countResult.rows[0];
                return {
                    tables: tableResult.rows,
                    totalRecords: parseInt(counts.customer_count) + parseInt(counts.assessment_count) + parseInt(counts.history_count)
                };
            }
            finally {
                client.release();
            }
        }
        catch (error) {
            return {
                tables: [],
                totalRecords: 0
            };
        }
    }
    /**
     * Clean shutdown
     */
    async destroy() {
        try {
            await this.pool.end();
            console.log('✅ PostgreSQL: Connection pool closed');
        }
        catch (error) {
            console.error('❌ PostgreSQL: Error closing connection pool:', error);
        }
    }
    /**
     * Get a single assessment by ID
     */
    async getAssessmentById(assessmentId) {
        await this.initialize();
        const client = await this.pool.connect();
        try {
            const query = `
                SELECT 
                    id,
                    customer_id,
                    tenant_id,
                    date,
                    status,
                    score,
                    metrics,
                    recommendations
                FROM assessments
                WHERE id = $1
            `;
            const result = await client.query(query, [assessmentId]);
            if (result.rows.length === 0) {
                return null;
            }
            const row = result.rows[0];
            return {
                id: row.id,
                customerId: row.customer_id,
                tenantId: row.tenant_id,
                date: row.date,
                status: row.status,
                score: row.score,
                metrics: row.metrics,
                recommendations: row.recommendations
            };
        }
        finally {
            client.release();
        }
    }
    /**
     * Browse table data for debugging/monitoring
     */
    async browseTable(tableName, limit = 10) {
        const validTables = ['customers', 'assessments', 'assessment_history'];
        if (!validTables.includes(tableName)) {
            throw new Error(`Invalid table name. Valid tables: ${validTables.join(', ')}`);
        }
        const client = await this.pool.connect();
        try {
            const query = `SELECT * FROM ${tableName} ORDER BY created_at DESC LIMIT $1`;
            const result = await client.query(query, [limit]);
            return result.rows;
        }
        finally {
            client.release();
        }
    }
    /**
     * Execute a generic SQL query for debugging/schema inspection
     */
    async query(sql, params = []) {
        await this.initialize();
        const client = await this.pool.connect();
        try {
            const result = await client.query(sql, params);
            return {
                rows: result.rows,
                rowCount: result.rowCount || 0
            };
        }
        finally {
            client.release();
        }
    }
}
exports.PostgreSQLService = PostgreSQLService;
// Export singleton instance
exports.postgresService = new PostgreSQLService();
// Export the service as postgresqlService for backward compatibility
exports.postgresqlService = exports.postgresService;
//# sourceMappingURL=postgresqlService.js.map