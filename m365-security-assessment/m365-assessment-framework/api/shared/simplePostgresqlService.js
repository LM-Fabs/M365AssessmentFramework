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
                tenantName: row.tenant_name || '',
                tenantId: row.tenant_id || '',
                tenantDomain: row.tenant_domain || '',
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
                tenantName: row.tenant_name || '',
                tenantId: row.tenant_id || '',
                tenantDomain: row.tenant_domain || '',
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

    async updateCustomer(customerData) {
        await this.initialize();
        
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            
            // Build dynamic query based on provided fields
            const updateFields = [];
            const values = [];
            let paramIndex = 1;
            
            if (customerData.tenantName !== undefined) {
                updateFields.push(`tenant_name = $${paramIndex++}`);
                values.push(customerData.tenantName);
            }
            if (customerData.tenantId !== undefined) {
                updateFields.push(`tenant_id = $${paramIndex++}`);
                values.push(customerData.tenantId);
            }
            if (customerData.tenantDomain !== undefined) {
                updateFields.push(`tenant_domain = $${paramIndex++}`);
                values.push(customerData.tenantDomain);
            }
            if (customerData.contactEmail !== undefined) {
                updateFields.push(`contact_email = $${paramIndex++}`);
                values.push(customerData.contactEmail);
            }
            if (customerData.notes !== undefined) {
                updateFields.push(`notes = $${paramIndex++}`);
                values.push(customerData.notes);
            }
            
            // App registration fields - store as JSON
            if (customerData.applicationId || customerData.clientId || customerData.servicePrincipalId) {
                const appRegistration = {
                    applicationId: customerData.applicationId,
                    clientId: customerData.clientId,
                    servicePrincipalId: customerData.servicePrincipalId,
                    clientSecret: customerData.clientSecret,
                    tenantId: customerData.tenantIdField,
                    consentUrl: customerData.consentUrl,
                    authUrl: customerData.authUrl,
                    redirectUri: customerData.redirectUri,
                    permissions: customerData.permissions || []
                };
                updateFields.push(`app_registration = $${paramIndex++}`);
                values.push(JSON.stringify(appRegistration));
            }
            
            if (updateFields.length === 0) {
                throw new Error('No fields to update');
            }
            
            // Add updated_at field
            updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
            
            // Add customer ID as the last parameter
            values.push(customerData.id);
            
            const query = `
                UPDATE customers 
                SET ${updateFields.join(', ')}
                WHERE id = $${paramIndex}
                RETURNING *
            `;
            
            const result = await client.query(query, values);
            await client.query('COMMIT');
            
            if (result.rows.length === 0) {
                throw new Error('Customer not found');
            }
            
            const row = result.rows[0];
            let appRegistration = null;
            if (row.app_registration) {
                try {
                    appRegistration = JSON.parse(row.app_registration);
                } catch (e) {
                    console.warn('Failed to parse app_registration JSON:', e);
                }
            }
            
            return {
                id: row.id || '',
                tenantName: row.tenant_name || '',
                tenantId: row.tenant_id || '',
                tenantDomain: row.tenant_domain || '',
                contactEmail: row.contact_email || '',
                notes: row.notes || '',
                status: row.status || 'active',
                createdAt: row.created_date,
                updatedAt: row.updated_at,
                totalAssessments: row.total_assessments || 0,
                appRegistration: appRegistration
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
                assessmentData.status || 'pending',
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

    async deleteCustomer(customerId) {
        await this.initialize();
        
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            
            // First check if customer exists
            const checkQuery = 'SELECT id FROM customers WHERE id = $1';
            const checkResult = await client.query(checkQuery, [customerId]);
            
            if (checkResult.rows.length === 0) {
                throw new Error('Customer not found');
            }
            
            // Delete related assessments first (if any)
            await client.query('DELETE FROM assessments WHERE customer_id = $1', [customerId]);
            
            // Delete the customer
            const deleteQuery = 'DELETE FROM customers WHERE id = $1 RETURNING *';
            const deleteResult = await client.query(deleteQuery, [customerId]);
            
            await client.query('COMMIT');
            
            return {
                success: true,
                deletedCustomer: {
                    id: deleteResult.rows[0].id,
                    tenantName: deleteResult.rows[0].tenant_name,
                    tenantDomain: deleteResult.rows[0].tenant_domain
                }
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
