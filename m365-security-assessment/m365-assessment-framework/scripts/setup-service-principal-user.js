const { Client } = require('pg');
const { DefaultAzureCredential } = require('@azure/identity');

async function setupServicePrincipalUser() {
    const credential = new DefaultAzureCredential();
    
    try {
        console.log('🔐 Getting Azure AD token for PostgreSQL...');
        const tokenResponse = await credential.getToken('https://ossrdbms-aad.database.windows.net/.default');
        
        if (!tokenResponse || !tokenResponse.token) {
            throw new Error('Failed to get Azure AD token');
        }
        
        console.log('✅ Azure AD token obtained successfully');
        
        // Connect as the service principal admin
        const client = new Client({
            host: 'psql-c6qdbpkda5cvs.postgres.database.azure.com',
            port: 5432,
            database: 'm365_assessment',
            user: 'm365-assessment-keyvault-access',
            password: tokenResponse.token,
            ssl: { rejectUnauthorized: false }
        });
        
        console.log('🔌 Connecting to PostgreSQL...');
        await client.connect();
        
        console.log('✅ Connected to PostgreSQL successfully');
        
        // Create the service principal user
        const createUserSQL = `
            CREATE USER "1528f6e7-3452-4919-bae3-41258c155840" WITH LOGIN IN ROLE azure_ad_user;
        `;
        
        console.log('👤 Creating service principal user...');
        await client.query(createUserSQL);
        
        console.log('✅ Service principal user created successfully');
        
        // Grant necessary permissions
        const grantPermissionsSQL = `
            GRANT ALL PRIVILEGES ON DATABASE m365_assessment TO "1528f6e7-3452-4919-bae3-41258c155840";
            GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO "1528f6e7-3452-4919-bae3-41258c155840";
            GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO "1528f6e7-3452-4919-bae3-41258c155840";
            GRANT CREATE ON SCHEMA public TO "1528f6e7-3452-4919-bae3-41258c155840";
        `;
        
        console.log('🔐 Granting permissions...');
        await client.query(grantPermissionsSQL);
        
        console.log('✅ Permissions granted successfully');
        
        await client.end();
        console.log('🎉 Service principal user setup completed successfully!');
        
    } catch (error) {
        console.error('❌ Error setting up service principal user:', error);
        throw error;
    }
}

// Run the setup
if (require.main === module) {
    setupServicePrincipalUser()
        .then(() => {
            console.log('✅ Setup completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Setup failed:', error);
            process.exit(1);
        });
}

module.exports = { setupServicePrincipalUser };
