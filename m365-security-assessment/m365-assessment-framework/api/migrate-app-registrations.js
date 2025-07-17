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
        
        const fixes = [];
        
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
                
                // Create a placeholder app registration
                const placeholderAppReg = {
                    applicationId: `placeholder-${customerId}`,
                    clientId: `placeholder-${customerId}`,
                    servicePrincipalId: `placeholder-${customerId}`,
                    permissions: [
                        'Organization.Read.All',
                        'Reports.Read.All',
                        'Directory.Read.All',
                        'SecurityEvents.Read.All'
                    ],
                    consentUrl: '',
                    isReal: false,
                    needsSetup: true,
                    createdDate: new Date().toISOString(),
                    migrationFixed: true,
                    migrationReason: fixReason
                };
                
                // Update the customer record
                await client.query(
                    'UPDATE customers SET app_registration = $1 WHERE id = $2',
                    [JSON.stringify(placeholderAppReg), customerId]
                );
                
                console.log(`   ✅ Fixed with placeholder app registration`);
                
                fixes.push({
                    customerId,
                    tenantName,
                    reason: fixReason,
                    fixed: true
                });
            } else {
                console.log(`   ✅ App registration is valid`);
            }
        }
        
        console.log(`\n📋 Migration Summary:`);
        console.log(`   Total customers: ${result.rows.length}`);
        console.log(`   Customers needing fixes: ${fixes.length}`);
        console.log(`   Customers fixed: ${fixes.filter(f => f.fixed).length}`);
        
        if (fixes.length > 0) {
            console.log(`\n🔧 Fixed customers:`);
            fixes.forEach(fix => {
                console.log(`   - ${fix.tenantName}: ${fix.reason}`);
            });
        }
        
        console.log('\n🎉 Migration completed successfully!');
        
        return {
            success: true,
            totalCustomers: result.rows.length,
            fixesNeeded: fixes.length,
            fixesApplied: fixes.filter(f => f.fixed).length,
            fixes
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
