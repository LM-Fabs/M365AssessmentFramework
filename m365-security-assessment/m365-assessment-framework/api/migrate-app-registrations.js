/**
 * Migration script to check and fix app registration data after PostgreSQL migration
 * This script addresses potential data structure issues from Table Storage -> PostgreSQL migration
 */

const { Client } = require('pg');
const { DefaultAzureCredential } = require('@azure/identity');

async function migrateAppRegistrations() {
    console.log('🔧 Starting app registration migration/fix process...');
    
    let client;
    
    try {
        // Get Azure AD token for PostgreSQL
        const credential = new DefaultAzureCredential();
        console.log('🔐 Getting Azure AD token for PostgreSQL...');
        const tokenResponse = await credential.getToken('https://ossrdbms-aad.database.windows.net/.default');
        
        if (!tokenResponse || !tokenResponse.token) {
            throw new Error('Failed to get Azure AD token');
        }
        
        console.log('✅ Azure AD token obtained successfully');
        
        // Connect to PostgreSQL
        client = new Client({
            host: 'psql-c6qdbpkda5cvs.postgres.database.azure.com',
            port: 5432,
            database: 'm365_assessment',
            user: '1528f6e7-3452-4919-bae3-41258c155840',
            password: tokenResponse.token,
            ssl: { rejectUnauthorized: false }
        });
        
        console.log('🔌 Connecting to PostgreSQL...');
        await client.connect();
        console.log('✅ Connected to PostgreSQL successfully');
        
        // Get all customers with their app registrations
        const result = await client.query(`
            SELECT id, tenant_name, tenant_domain, app_registration 
            FROM customers 
            ORDER BY tenant_name
        `);
        
        console.log(`📊 Found ${result.rows.length} customers to check`);
        
        const customersNeedingFix = [];
        
        for (const row of result.rows) {
            const customerId = row.id;
            const tenantName = row.tenant_name;
            const appReg = row.app_registration;
            
            console.log(`\n🔍 Checking customer: ${tenantName} (${customerId})`);
            console.log(`   App Registration Type: ${typeof appReg}`);
            console.log(`   App Registration Value:`, appReg ? JSON.stringify(appReg, null, 2) : 'NULL');
            
            let needsFix = false;
            let fixReason = '';
            
            // Check if app registration is null or undefined
            if (!appReg) {
                needsFix = true;
                fixReason = 'App registration is null/undefined';
            }
            // Check if app registration is a string (should be object)
            else if (typeof appReg === 'string') {
                needsFix = true;
                fixReason = 'App registration stored as string instead of object';
            }
            // Check if app registration is object but missing required fields
            else if (typeof appReg === 'object') {
                if (!appReg.applicationId || 
                    typeof appReg.applicationId !== 'string' ||
                    appReg.applicationId.trim() === '' ||
                    appReg.applicationId.startsWith('ERROR_') ||
                    appReg.applicationId.startsWith('pending-') ||
                    appReg.applicationId.startsWith('placeholder-')) {
                    needsFix = true;
                    fixReason = 'App registration has invalid applicationId';
                }
            }
            
            if (needsFix) {
                console.log(`   ❌ Needs fix: ${fixReason}`);
                console.log(`   ⚠️ Customer ${customerId} requires manual app registration setup`);
                // No longer creating placeholder registrations - require manual setup
                customersNeedingFix.push({
                    customerId,
                    tenantName,
                    reason: fixReason
                });
            } else {
                console.log(`   ✅ App registration is valid`);
            }
        }
        
        console.log(`\n📋 Migration Summary:`);
        console.log(`   Total customers: ${result.rows.length}`);
        console.log(`   Customers needing manual setup: ${customersNeedingFix.length}`);
        
        if (customersNeedingFix.length > 0) {
            console.log(`\n⚠️ Customers requiring manual app registration setup:`);
            customersNeedingFix.forEach(customer => {
                console.log(`   - ${customer.tenantName}: ${customer.reason}`);
            });
        }
        
        console.log('\n🎉 Migration completed successfully!');
        console.log('⚠️ Note: No mock/placeholder app registrations created. Manual setup required for flagged customers.');
        
        return {
            success: true,
            totalCustomers: result.rows.length,
            customersNeedingManualSetup: customersNeedingFix.length,
            customersNeedingFix
        };
        
    } catch (error) {
        console.error('❌ Error during migration:', error);
        throw error;
    } finally {
        if (client) {
            await client.end();
            console.log('🔌 Database connection closed');
        }
    }
}

// Run the migration if called directly
if (require.main === module) {
    migrateAppRegistrations()
        .then(result => {
            console.log('\n✅ Migration completed:', result);
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ Migration failed:', error);
            process.exit(1);
        });
}

module.exports = { migrateAppRegistrations };
