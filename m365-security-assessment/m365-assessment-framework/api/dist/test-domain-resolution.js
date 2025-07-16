"use strict";
/**
 * Simple test script to verify the domain resolution logic
 * This tests the httpsRequest helper and domain resolution without requiring Azure credentials
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const https = __importStar(require("https"));
/**
 * Helper function to make HTTPS requests without external dependencies
 */
function httpsRequest(url, timeout = 10000) {
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
                    }
                    else {
                        reject(new Error(`HTTP ${response.statusCode}: ${data}`));
                    }
                }
                catch (parseError) {
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
async function testDomainResolution(domain) {
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
            const config = await httpsRequest(tenantDiscoveryUrl, 10000);
            // Extract tenant ID from the issuer URL
            const issuerMatch = config.issuer?.match(/https:\/\/login\.microsoftonline\.com\/([^\/]+)\/v2\.0/);
            if (issuerMatch && issuerMatch[1]) {
                const tenantId = issuerMatch[1];
                // Validate it looks like a proper GUID
                if (tenantId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
                    console.log('✅ Domain resolved to tenant ID:', tenantId);
                    return tenantId;
                }
                else {
                    console.log('⚠️ Resolved tenant ID does not appear to be a GUID:', tenantId);
                }
            }
        }
        catch (discoveryError) {
            if (discoveryError.message?.includes('timed out') || discoveryError.message?.includes('timeout')) {
                console.log('⚠️ Tenant discovery timed out for domain:', domain);
            }
            else {
                console.log('⚠️ Tenant discovery failed for domain:', domain, discoveryError.message);
            }
        }
        // Alternative approach: Try to get tenant info from Microsoft's tenant resolution API
        try {
            console.log('🔍 Trying alternative tenant resolution');
            const tenantResolveUrl = `https://login.microsoftonline.com/common/userrealm/${domain}?api-version=2.1`;
            const realmInfo = await httpsRequest(tenantResolveUrl, 5000);
            if (realmInfo.TenantId && realmInfo.TenantId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
                console.log('✅ Domain resolved via realm API to tenant ID:', realmInfo.TenantId);
                return realmInfo.TenantId;
            }
        }
        catch (realmError) {
            if (realmError.message?.includes('timed out') || realmError.message?.includes('timeout')) {
                console.log('⚠️ Realm API timed out for domain:', domain);
            }
            else {
                console.log('⚠️ Realm API failed for domain:', domain, realmError.message);
            }
        }
        console.log('⚠️ Could not resolve domain to tenant ID, using domain as-is:', domain);
        return domain; // Return the domain as-is if resolution fails
    }
    catch (error) {
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
        'contoso.onmicrosoft.com',
        'microsoft.com',
        'example.com',
        'nonexistent-domain-test.com' // Non-existent domain (should handle gracefully)
    ];
    for (const domain of testDomains) {
        console.log('');
        console.log(`Testing: ${domain}`);
        console.log('-'.repeat(50));
        try {
            const result = await testDomainResolution(domain);
            console.log(`Result: ${result}`);
        }
        catch (error) {
            console.error(`Error: ${error}`);
        }
        console.log('');
    }
    console.log('✅ Domain resolution tests completed!');
}
// Run the tests
runTests().catch(console.error);
//# sourceMappingURL=test-domain-resolution.js.map