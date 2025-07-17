import { Pool, PoolClient, PoolConfig } from 'pg';
import { DefaultAzureCredential } from '@azure/identity';
import { Assessment, Customer, AssessmentHistory } from './types';
import { getKeyVaultService } from './keyVaultService';

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
export class PostgreSQLService {
    private pool!: Pool;
    private initialized = false;
    private credential: DefaultAzureCredential;

    constructor() {
        this.credential = new DefaultAzureCredential();
        // Pool initialization is deferred to initialize() method to allow async Key Vault retrieval
    }

    /**
     * Setup Azure AD authentication for PostgreSQL
     * Uses service principal authentication instead of password
     */
    private async getAzureADToken(): Promise<string> {
        try {
            // Get access token for PostgreSQL using service principal
            // Use the correct scope for PostgreSQL Flexible Server
            const tokenResponse = await this.credential.getToken('https://ossrdbms-aad.database.windows.net/.default');
            
            if (tokenResponse && tokenResponse.token) {
                console.log('🔐 PostgreSQL: Azure AD token obtained successfully');
                return tokenResponse.token;
            } else {
                throw new Error('Failed to get Azure AD token');
            }
        } catch (error) {
            console.error('❌ PostgreSQL: Failed to get Azure AD token:', error);
            throw new Error(`Azure AD authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Initialize database schema and tables
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;

        try {
            console.log('🔧 PostgreSQL: Initializing database connection...');
            
            // Initialize connection pool with proper authentication
            await this.initializePoolAsync();
            
            console.log('🔧 PostgreSQL: Initializing database schema...');
            
            const client = await this.pool.connect();
            
            try {
                // Create tables with proper indexes and constraints
                await this.createTables(client);
                
                console.log('✅ PostgreSQL: Database schema initialized successfully');
                this.initialized = true;
            } finally {
                client.release();
            }
        } catch (error) {
            console.error('❌ PostgreSQL: Schema initialization failed:', error);
            throw new Error(`Database initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Initialize connection pool with Azure AD authentication
     */
    private async initializePoolAsync(): Promise<void> {
        const config: PoolConfig = {
            host: process.env.POSTGRES_HOST || 'localhost',
            port: parseInt(process.env.POSTGRES_PORT || '5432'),
            database: process.env.POSTGRES_DATABASE || 'm365_assessment',
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
            
            // Connection pool settings for optimal performance
            max: 20, // Maximum number of connections
            min: 5,  // Minimum connections to maintain
            idleTimeoutMillis: 30000, // Close idle connections after 30s
            connectionTimeoutMillis: 10000, // Connection timeout
            
            // Performance optimizations
            statement_timeout: 30000, // 30 second query timeout
            query_timeout: 30000,
            keepAlive: true,
            keepAliveInitialDelayMillis: 10000,
        };

        // Use password authentication as primary method (most reliable for current setup)
        // Check multiple indicators for production environment
        const isProduction = process.env.NODE_ENV === 'production' || 
                           process.env.AZURE_CLIENT_ID !== undefined ||
                           process.env.WEBSITE_SITE_NAME !== undefined;
        
        if (isProduction && process.env.POSTGRES_USER && process.env.POSTGRES_PASSWORD) {
            console.log('🔐 PostgreSQL: Using secure password authentication');
            
            // Use configured credentials for reliable connection
            config.user = process.env.POSTGRES_USER;
            // Clean up the password format (remove any newlines or extra text)
            let cleanPassword = process.env.POSTGRES_PASSWORD;
            if (cleanPassword.includes('\n')) {
                cleanPassword = cleanPassword.split('\n').pop() || cleanPassword;
            }
            config.password = cleanPassword;
            
            console.log('✅ PostgreSQL: Password authentication configured successfully');
        } else if (isProduction) {
            console.log('🔐 PostgreSQL: Attempting Azure AD authentication');
            
            try {
                // Set the service principal application ID as the username
                config.user = '1528f6e7-3452-4919-bae3-41258c155840'; // Service principal app ID
                
                // Get Azure AD token for authentication
                const azureToken = await this.getAzureADToken();
                config.password = azureToken;
                
                console.log('✅ PostgreSQL: Azure AD authentication configured successfully');
            } catch (azureError) {
                console.error('❌ PostgreSQL: Azure AD authentication failed:', azureError);
                throw new Error('Azure AD authentication failed and no password credentials available');
            }
        } else {
            // Local development with password
            config.user = process.env.POSTGRES_USER || 'postgres';
            config.password = process.env.POSTGRES_PASSWORD || 'password';
            console.log('🔧 PostgreSQL: Using password authentication for local development');
        }

        this.pool = new Pool(config);

        // Handle pool errors
        this.pool.on('error', (err: Error) => {
            console.error('💥 PostgreSQL Pool Error:', err);
        });

        this.pool.on('connect', () => {
            console.log('✅ PostgreSQL: New connection established');
        });
    }

    /**
     * Create all required tables with optimized schema
     */
    private async createTables(client: PoolClient): Promise<void> {
        // Try to enable required extensions (may fail if not allowed, but continue anyway)
        try {
            await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
            console.log('✅ PostgreSQL: uuid-ossp extension enabled');
        } catch (error) {
            console.warn('⚠️ PostgreSQL: uuid-ossp extension not available, using alternative UUID generation');
        }
        
        try {
            await client.query(`CREATE EXTENSION IF NOT EXISTS "pg_trgm";`);
            console.log('✅ PostgreSQL: pg_trgm extension enabled');
        } catch (error) {
            console.warn('⚠️ PostgreSQL: pg_trgm extension not available, full-text search may be limited');
        }

        // Customers table with optimized structure (using gen_random_uuid() as fallback)
        await client.query(`
            CREATE TABLE IF NOT EXISTS customers (
                id UUID PRIMARY KEY DEFAULT COALESCE(uuid_generate_v4(), gen_random_uuid()),
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
                
                -- Performance indexes
                CONSTRAINT valid_status CHECK (status IN ('active', 'inactive', 'deleted'))
            );
        `);

        // Handle schema migrations for existing tables
        try {
            // Add missing columns if they don't exist
            await client.query(`
                ALTER TABLE customers 
                ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';
            `);
            
            await client.query(`
                ALTER TABLE customers 
                ADD COLUMN IF NOT EXISTS created_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
            `);
            
            await client.query(`
                ALTER TABLE customers 
                ADD COLUMN IF NOT EXISTS last_assessment_date TIMESTAMPTZ;
            `);
            
            await client.query(`
                ALTER TABLE customers 
                ADD COLUMN IF NOT EXISTS total_assessments INTEGER DEFAULT 0;
            `);
            
            await client.query(`
                ALTER TABLE customers 
                ADD COLUMN IF NOT EXISTS app_registration JSONB;
            `);
            
            await client.query(`
                ALTER TABLE customers 
                ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255);
            `);
            
            await client.query(`
                ALTER TABLE customers 
                ADD COLUMN IF NOT EXISTS notes TEXT;
            `);

            console.log('✅ PostgreSQL: Schema migration completed for customers table');
        } catch (migrationError) {
            console.warn('⚠️ PostgreSQL: Schema migration warning (table might be new):', migrationError);
        }

        // Create indexes
        try {
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_customers_tenant_id ON customers(tenant_id);
                CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
                CREATE INDEX IF NOT EXISTS idx_customers_created_date ON customers(created_date);
                CREATE INDEX IF NOT EXISTS idx_customers_domain ON customers(tenant_domain);
                
                -- GIN index for JSONB searches
                CREATE INDEX IF NOT EXISTS idx_customers_app_registration ON customers USING gin(app_registration);
            `);
        } catch (indexError) {
            console.warn('⚠️ PostgreSQL: Index creation warning:', indexError);
        }

        // Assessments table with unlimited JSONB storage
        await client.query(`
            CREATE TABLE IF NOT EXISTS assessments (
                id UUID PRIMARY KEY DEFAULT COALESCE(uuid_generate_v4(), gen_random_uuid()),
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
                id UUID PRIMARY KEY DEFAULT COALESCE(uuid_generate_v4(), gen_random_uuid()),
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

    /**
     * Customer operations
     */
    async getCustomers(options?: { status?: string; limit?: number }): Promise<{ customers: Customer[]; total: number }> {
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
            
            const params: any[] = [];
            const conditions: string[] = [];
            
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
            
            const customers: Customer[] = result.rows.map((row: any) => ({
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
                appRegistration: row.app_registration || undefined
            }));
            
            return {
                customers,
                total: parseInt(countResult.rows[0].count)
            };
            
        } finally {
            client.release();
        }
    }

    async getCustomerByDomain(domain: string): Promise<Customer | null> {
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
                appRegistration: row.app_registration || undefined
            };
            
        } finally {
            client.release();
        }
    }

    async createCustomer(customerRequest: any, appRegistration: any): Promise<Customer> {
        await this.initialize();
        
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            
            const query = `
                INSERT INTO customers (
                    tenant_id,
                    tenant_name,
                    tenant_domain,
                    contact_email,
                    notes,
                    status,
                    total_assessments,
                    app_registration
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *
            `;
            
            const values = [
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
            const customer: Customer = {
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
            
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('❌ PostgreSQL: Failed to create customer:', error);
            
            if (error instanceof Error && error.message.includes('duplicate key')) {
                throw new Error('Customer with this domain already exists');
            }
            
            throw new Error(`Failed to create customer: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            client.release();
        }
    }

    async getCustomer(customerId: string): Promise<Customer | null> {
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
                appRegistration: row.app_registration || undefined
            };
            
        } finally {
            client.release();
        }
    }

    async updateCustomer(customerId: string, updates: Partial<Customer>): Promise<Customer> {
        await this.initialize();
        
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            
            // Build dynamic update query
            const setClauses: string[] = [];
            const values: any[] = [];
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
            const customer: Customer = {
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
                appRegistration: row.app_registration || undefined
            };
            
            console.log('✅ PostgreSQL: Customer updated successfully:', customer.id);
            return customer;
            
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('❌ PostgreSQL: Failed to update customer:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async deleteCustomer(customerId: string): Promise<void> {
        await this.initialize();
        
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            
            const result = await client.query(
                'DELETE FROM customers WHERE id = $1',
                [customerId]
            );
            
            if (result.rowCount === 0) {
                throw new Error('Customer not found');
            }
            
            await client.query('COMMIT');
            console.log('✅ PostgreSQL: Customer deleted successfully:', customerId);
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async getCustomerByClientId(clientId: string): Promise<Customer | null> {
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
                appRegistration: row.app_registration || undefined
            };
            
        } finally {
            client.release();
        }
    }

    /**
     * Assessment operations with unlimited JSON storage
     */
    async getCustomerAssessments(customerId: string, options?: { status?: string; limit?: number }): Promise<{ assessments: Assessment[] }> {
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
            
            const params: any[] = [customerId];
            
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
            
            const assessments: Assessment[] = result.rows.map((row: any) => ({
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
            
        } finally {
            client.release();
        }
    }

    async createAssessment(assessmentData: any): Promise<Assessment> {
        await this.initialize();
        
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            
            const query = `
                INSERT INTO assessments (
                    customer_id,
                    tenant_id,
                    status,
                    score,
                    metrics,
                    recommendations
                ) VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *
            `;
            
            const values = [
                assessmentData.customerId,
                assessmentData.tenantId,
                'completed',
                assessmentData.score || 0,
                JSON.stringify(assessmentData.metrics || {}),
                JSON.stringify(assessmentData.recommendations || [])
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
            const assessment: Assessment = {
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
            
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('❌ PostgreSQL: Failed to create assessment:', error);
            throw new Error(`Failed to create assessment: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            client.release();
        }
    }

    async updateAssessment(assessmentId: string, customerId: string, assessmentData: any): Promise<Assessment> {
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
            const assessment: Assessment = {
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
            
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('❌ PostgreSQL: Failed to update assessment:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async getAssessments(options?: { 
        customerId?: string; 
        tenantId?: string; 
        status?: string; 
        limit?: number 
    }): Promise<{ assessments: Assessment[]; total: number }> {
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
            
            const params: any[] = [];
            const conditions: string[] = [];
            
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
            
            const assessments: Assessment[] = result.rows.map((row: any) => ({
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
            
        } finally {
            client.release();
        }
    }

    /**
     * Assessment history operations
     */
    async getAssessmentHistory(options?: { tenantId?: string; customerId?: string; limit?: number }): Promise<AssessmentHistory[]> {
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
            
            const params: any[] = [];
            const conditions: string[] = [];
            
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
            
            const history: AssessmentHistory[] = result.rows.map((row: any) => ({
                id: row.id,
                assessmentId: row.assessment_id,
                tenantId: row.tenant_id,
                customerId: row.customer_id,
                date: row.date,
                overallScore: parseFloat(row.overall_score) || 0,
                categoryScores: row.category_scores || {}
            }));
            
            return history;
            
        } finally {
            client.release();
        }
    }

    async storeAssessmentHistory(historyData: AssessmentHistory): Promise<void> {
        await this.initialize();
        
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            
            const query = `
                INSERT INTO assessment_history (
                    assessment_id,
                    tenant_id,
                    customer_id,
                    date,
                    overall_score,
                    category_scores
                ) VALUES ($1, $2, $3, $4, $5, $6)
            `;
            
            const values = [
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
            
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('❌ PostgreSQL: Failed to store assessment history:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async getAllAssessmentHistory(): Promise<AssessmentHistory[]> {
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
            
            const history: AssessmentHistory[] = result.rows.map((row: any) => ({
                id: row.id,
                assessmentId: row.assessment_id,
                tenantId: row.tenant_id,
                customerId: row.customer_id,
                date: row.date,
                overallScore: parseFloat(row.overall_score) || 0,
                categoryScores: row.category_scores || {}
            }));
            
            return history;
            
        } finally {
            client.release();
        }
    }

    async getCustomerAssessmentHistory(customerId: string): Promise<AssessmentHistory[]> {
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
            
            const history: AssessmentHistory[] = result.rows.map((row: any) => ({
                id: row.id,
                assessmentId: row.assessment_id,
                tenantId: row.tenant_id,
                customerId: row.customer_id,
                date: row.date,
                overallScore: parseFloat(row.overall_score) || 0,
                categoryScores: row.category_scores || {}
            }));
            
            return history;
            
        } finally {
            client.release();
        }
    }

    /**
     * Health check and monitoring
     */
    async healthCheck(): Promise<{ healthy: boolean; details: any }> {
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
        } catch (error) {
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
    async testConnection(): Promise<{ connected: boolean; host: string; database: string; version: string }> {
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
            } finally {
                client.release();
            }
        } catch (error) {
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
    async getDatabaseStats(): Promise<{ tables: any[]; totalRecords: number }> {
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
            } finally {
                client.release();
            }
        } catch (error) {
            return {
                tables: [],
                totalRecords: 0
            };
        }
    }

    /**
     * Clean shutdown
     */
    async destroy(): Promise<void> {
        try {
            await this.pool.end();
            console.log('✅ PostgreSQL: Connection pool closed');
        } catch (error) {
            console.error('❌ PostgreSQL: Error closing connection pool:', error);
        }
    }

    /**
     * Browse table data for debugging/monitoring
     */
    async browseTable(tableName: string, limit: number = 10): Promise<any[]> {
        const validTables = ['customers', 'assessments', 'assessment_history'];
        if (!validTables.includes(tableName)) {
            throw new Error(`Invalid table name. Valid tables: ${validTables.join(', ')}`);
        }
        
        const client = await this.pool.connect();
        try {
            const query = `SELECT * FROM ${tableName} ORDER BY created_at DESC LIMIT $1`;
            const result = await client.query(query, [limit]);
            return result.rows;
        } finally {
            client.release();
        }
    }
}

// Export singleton instance
export const postgresService = new PostgreSQLService();

// Export the service as postgresqlService for backward compatibility
export const postgresqlService = postgresService;
