/**
 * Simple test script to verify the domain resolution logic
 * This tests the httpsRequest helper and domain resolution without requiring Azure credentials
 */

import * as https from 'https';

/**
 * Helper function to make HTTPS requests without external dependencies
 */
function httpsRequest(url: string, timeout: number = 10000): Promise<any> {
    return new Promise((resolve, reject) => {
        const request = https.get(url, { timeout }, (response) => {
            let data = '';
            
            response.on('data', (chunk) => {
                data += chunk;
            });
            
            response.on('end', () => {
                try {
                    if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
                        const jsonData = JSON.parse(data);
                        resolve(jsonData);
                    } else {
                        reject(new Error(`HTTP ${response.statusCode}: ${data}`));
                    }
                } catch (parseError) {
                    reject(new Error(`Failed to parse JSON response: ${parseError}`));
                }
            });
        });
        
        request.on('error', (error) => {
            reject(error);
        });
        
        request.on('timeout', () => {
            request.destroy();
            reject(new Error('Request timed out'));
        });
    });
}

/**
 * Test domain resolution logic
 */
async function testDomainResolution(domain: string): Promise<string | null> {
    try {
        console.log('🔍 Testing domain resolution for:', domain);
        
        // For well-known domains like *.onmicrosoft.com, extract tenant name
        if (domain.endsWith('.onmicrosoft.com')) {
            console.log('✅ OnMicrosoft domain detected, using as-is');
            return domain;
        }
        
        // For custom domains, try to resolve using the tenant info endpoint
        try {
            const tenantDiscoveryUrl = `https://login.microsoftonline.com/${domain}/v2.0/.well-known/openid_configuration`;
            console.log('🌐 Trying tenant discovery for domain:', domain);
            
            const config = await httpsRequest(tenantDiscoveryUrl, 10000) as { issuer?: string };
            
            // Extract tenant ID from the issuer URL
            const issuerMatch = config.issuer?.match(/https:\/\/login\.microsoftonline\.com\/([^\/]+)\/v2\.0/);
            if (issuerMatch && issuerMatch[1]) {
                const tenantId = issuerMatch[1];
                
                // Validate it looks like a proper GUID
                if (tenantId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
                    console.log('✅ Domain resolved to tenant ID:', tenantId);
                    return tenantId;
                } else {
                    console.log('⚠️ Resolved tenant ID does not appear to be a GUID:', tenantId);
                }
            }
        } catch (discoveryError: any) {
            if (discoveryError.message?.includes('timed out') || discoveryError.message?.includes('timeout')) {
                console.log('⚠️ Tenant discovery timed out for domain:', domain);
            } else {
                console.log('⚠️ Tenant discovery failed for domain:', domain, discoveryError.message);
            }
        }
        
        // Alternative approach: Try to get tenant info from Microsoft's tenant resolution API
        try {
            console.log('🔍 Trying alternative tenant resolution');
            
            const tenantResolveUrl = `https://login.microsoftonline.com/common/userrealm/${domain}?api-version=2.1`;
            
            const realmInfo = await httpsRequest(tenantResolveUrl, 5000) as { 
                TenantId?: string;
                account_type?: string;
                cloud_instance_name?: string;
            };
            
            if (realmInfo.TenantId && realmInfo.TenantId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
                console.log('✅ Domain resolved via realm API to tenant ID:', realmInfo.TenantId);
                return realmInfo.TenantId;
            }
        } catch (realmError: any) {
            if (realmError.message?.includes('timed out') || realmError.message?.includes('timeout')) {
                console.log('⚠️ Realm API timed out for domain:', domain);
            } else {
                console.log('⚠️ Realm API failed for domain:', domain, realmError.message);
            }
        }
        
        console.log('⚠️ Could not resolve domain to tenant ID, using domain as-is:', domain);
        return domain; // Return the domain as-is if resolution fails
        
    } catch (error) {
        console.error('❌ Error resolving domain to tenant ID:', error);
        return domain; // Return the domain as-is if there's an error
    }
}

// Test with various domains
async function runTests() {
    console.log('🧪 Testing Domain Resolution Logic');
    console.log('===================================');
    console.log('');
    
    const testDomains = [
        'contoso.onmicrosoft.com',  // OnMicrosoft domain (should return as-is)
        'microsoft.com',            // Well-known domain (should resolve to tenant ID)
        'example.com',              // Generic domain (may not resolve)
        'nonexistent-domain-test.com' // Non-existent domain (should handle gracefully)
    ];
    
    for (const domain of testDomains) {
        console.log('');
        console.log(`Testing: ${domain}`);
        console.log('-'.repeat(50));
        
        try {
            const result = await testDomainResolution(domain);
            console.log(`Result: ${result}`);
        } catch (error) {
            console.error(`Error: ${error}`);
        }
        
        console.log('');
    }
    
    console.log('✅ Domain resolution tests completed!');
}

// Run the tests
runTests().catch(console.error);
