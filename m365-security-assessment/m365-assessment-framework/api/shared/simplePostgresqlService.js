const { Pool } = require('pg');
const { DefaultAzureCredential } = require('@azure/identity');
const { randomUUID } = require('crypto');

/**
 * Simple PostgreSQL Service for v3 JavaScript Functions
 * This is a simplified version of the TypeScript service
 */
class SimplePostgreSQLService {
    constructor() {
        this.pool = null;
        this.initialized = false;
        this.credential = new DefaultAzureCredential();
    }

    async initialize() {
        if (this.initialized) return;

        try {
            console.log('🔧 Initializing PostgreSQL connection...');
            
            // Try different authentication methods
            const isProduction = process.env.NODE_ENV === 'production' || 
                               process.env.AZURE_CLIENT_ID !== undefined ||
                               process.env.WEBSITE_SITE_NAME !== undefined;

            let config;
            
            if (isProduction) {
                // For production, use password authentication with environment variables
                console.log('🔐 Using password authentication...');
                config = {
                    host: process.env.POSTGRES_HOST || 'psql-c6qdbpkda5cvs.postgres.database.azure.com',
                    port: parseInt(process.env.POSTGRES_PORT || '5432'),
                    database: process.env.POSTGRES_DATABASE || 'm365_assessment',
                    user: process.env.POSTGRES_USER || 'assessment_admin',
                    password: process.env.POSTGRES_PASSWORD,
                    ssl: { rejectUnauthorized: false },
                    max: 20,
                    min: 5,
                    idleTimeoutMillis: 30000,
                    connectionTimeoutMillis: 10000,
                };
                
                if (!config.password) {
                    throw new Error('POSTGRES_PASSWORD environment variable is required for production');
                }
            } else {
                // Local development
                config = {
                    host: process.env.POSTGRES_HOST || 'localhost',
                    port: parseInt(process.env.POSTGRES_PORT || '5432'),
                    database: process.env.POSTGRES_DATABASE || 'm365_assessment',
                    user: process.env.POSTGRES_USER || 'postgres',
                    password: process.env.POSTGRES_PASSWORD || 'password',
                    ssl: false,
                    max: 20,
                    min: 5,
                    idleTimeoutMillis: 30000,
                    connectionTimeoutMillis: 10000,
                };
            }

            this.pool = new Pool(config);
            
            // Test connection
            const client = await this.pool.connect();
            await client.query('SELECT 1');
            client.release();
            
            console.log('✅ PostgreSQL connected successfully');
            this.initialized = true;
        } catch (error) {
            console.error('❌ PostgreSQL initialization failed:', error);
            throw new Error(`Database initialization failed: ${error.message}`);
        }
    }

    async getCustomers() {
        await this.initialize();
        
        const client = await this.pool.connect();
        try {
            const query = 'SELECT * FROM customers WHERE status = $1 ORDER BY created_date DESC';
            const result = await client.query(query, ['active']);
            
            return result.rows.map(row => ({
                id: row.id || '',
                name: row.tenant_name || '',
                tenantId: row.tenant_id || '',
                domain: row.tenant_domain || '',
                contactEmail: row.contact_email || '',
                notes: row.notes || '',
                status: row.status || 'active',
                createdAt: row.created_date,
                totalAssessments: row.total_assessments || 0,
                appRegistration: row.app_registration || null
            }));
        } finally {
            client.release();
        }
    }

    async createCustomer(customerData) {
        await this.initialize();
        
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            
            const customerId = randomUUID();
            const query = `
                INSERT INTO customers (
                    id, tenant_id, tenant_name, tenant_domain, 
                    contact_email, notes, status, total_assessments
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *
            `;
            
            const values = [
                customerId,
                customerData.tenantId || '',
                customerData.tenantName || 'New Customer',
                customerData.tenantDomain || 'newcustomer.com',
                customerData.contactEmail || '',
                customerData.notes || '',
                'active',
                0
            ];
            
            const result = await client.query(query, values);
            await client.query('COMMIT');
            
            const row = result.rows[0];
            return {
                id: row.id || '',
                name: row.tenant_name || '',
                tenantId: row.tenant_id || '',
                domain: row.tenant_domain || '',
                contactEmail: row.contact_email || '',
                notes: row.notes || '',
                status: row.status || 'active',
                createdAt: row.created_date,
                totalAssessments: row.total_assessments || 0
            };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async createAssessment(assessmentData) {
        await this.initialize();
        
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            
            const assessmentId = randomUUID();
            const query = `
                INSERT INTO assessments (
                    id, customer_id, tenant_id, status, score, metrics, recommendations
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
            `;
            
            const values = [
                assessmentId,
                assessmentData.customerId,
                assessmentData.tenantId,
                assessmentData.status || 'created',
                assessmentData.score || 0,
                JSON.stringify(assessmentData.metrics || {}),
                JSON.stringify(assessmentData.recommendations || [])
            ];
            
            const result = await client.query(query, values);
            await client.query('COMMIT');
            
            const row = result.rows[0];
            return {
                id: row.id,
                customerId: row.customer_id,
                tenantId: row.tenant_id,
                status: row.status,
                score: row.score,
                metrics: row.metrics,
                recommendations: row.recommendations,
                createdAt: row.created_at,
                updatedAt: row.updated_at
            };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
}

module.exports = { SimplePostgreSQLService };
