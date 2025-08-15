/**
 * Quick fix script for M365 Assessment Framework permission issues
 * This will add the missing permissions that are causing your reported issues:
 * 
 * 1. Missing privileged roles -> Adds RoleManagement.Read.Directory
 * 2. Missing conditional access policies -> Adds Policy.Read.All
 * 
 * HOW TO USE:
 * 1. Get an access token with Application.ReadWrite.All permission
 * 2. Replace YOUR_ACCESS_TOKEN_HERE with your actual token
 * 3. Run this script in browser console or Node.js
 */

const CLIENT_ID = 'd1cc9e16-9194-4892-92c5-473c9f65dcb3';
const ACCESS_TOKEN = 'YOUR_ACCESS_TOKEN_HERE'; // Replace with your actual token

async function quickFixPermissions() {
  console.log('🔧 Quick fix for M365 Assessment Framework permissions...\n');
  
  try {
    // Step 1: Get current app registration
    console.log('📋 Getting current app registration...');
    const appResponse = await fetch(
      `https://graph.microsoft.com/v1.0/applications?$filter=appId eq '${CLIENT_ID}'`,
      {
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!appResponse.ok) {
      throw new Error(`Failed to get app: ${appResponse.statusText}`);
    }
    
    const appData = await appResponse.json();
    const application = appData.value[0];
    const objectId = application.id;
    
    console.log('✅ Found app registration:', application.displayName);
    
    // Step 2: Get current permissions
    const currentGraphPermissions = application.requiredResourceAccess?.find(
      ra => ra.resourceAppId === '00000003-0000-0000-c000-000000000000'
    );
    
    const currentPermissionIds = currentGraphPermissions?.resourceAccess?.map(access => access.id) || [];
    console.log('📊 Current permissions count:', currentPermissionIds.length);
    
    // Step 3: Add the critical missing permissions
    const criticalPermissions = [
      // Core permissions (likely already present)
      { id: 'df021288-bdef-4463-88db-98f22de89214', type: 'Role', name: 'User.Read.All' },
      { id: '7ab1d382-f21e-4acd-a863-ba3e13f7da61', type: 'Role', name: 'Directory.Read.All' },
      { id: '498476ce-e0fe-48b0-b801-37ba7e2685c6', type: 'Role', name: 'Organization.Read.All' },
      
      // CRITICAL: These fix your reported issues
      { id: '246dd0d5-5bd0-4def-940b-0421030a5b68', type: 'Role', name: 'Policy.Read.All' },           // FIXES conditional access policies
      { id: '483bed4a-2ad3-4361-a73b-c83ccdbdc53c', type: 'Role', name: 'RoleManagement.Read.Directory' }, // FIXES privileged roles
      
      // Additional useful permissions
      { id: '230c1aed-a721-4c5d-9cb4-a90514e508ef', type: 'Role', name: 'Reports.Read.All' },
      { id: 'bf394140-e372-4bf9-a898-299cfc7564e5', type: 'Role', name: 'SecurityEvents.Read.All' },
      { id: '6e472fd1-ad78-48da-a0f0-97ab2c6b769e', type: 'Role', name: 'IdentityRiskEvent.Read.All' },
      { id: 'ef4b5d93-3104-4867-9b0b-5cd61b5ffb6f', type: 'Role', name: 'Agreement.Read.All' },
      { id: 'b0afded3-3588-46d8-8b3d-9842eff778da', type: 'Role', name: 'AuditLog.Read.All' }
    ];
    
    // Combine existing and new permissions (remove duplicates)
    const existingPermissions = currentGraphPermissions?.resourceAccess || [];
    const existingIds = new Set(existingPermissions.map(p => p.id));
    
    const newPermissions = criticalPermissions.filter(p => !existingIds.has(p.id));
    const allPermissions = [
      ...existingPermissions,
      ...newPermissions.map(p => ({ id: p.id, type: p.type }))
    ];
    
    console.log('🆕 Adding new permissions:', newPermissions.map(p => p.name));
    
    // Step 4: Update app registration
    const updatePayload = {
      requiredResourceAccess: [
        {
          resourceAppId: '00000003-0000-0000-c000-000000000000', // Microsoft Graph
          resourceAccess: allPermissions
        },
        // Preserve any existing non-Graph permissions
        ...(application.requiredResourceAccess?.filter(ra => ra.resourceAppId !== '00000003-0000-0000-c000-000000000000') || [])
      ]
    };
    
    console.log('🔄 Updating app registration...');
    const updateResponse = await fetch(
      `https://graph.microsoft.com/v1.0/applications/${objectId}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatePayload)
      }
    );
    
    if (!updateResponse.ok) {
      const errorData = await updateResponse.json();
      throw new Error(`Update failed: ${errorData.error?.message || updateResponse.statusText}`);
    }
    
    console.log('✅ App registration updated successfully!');
    console.log('📋 Total permissions after update:', allPermissions.length);
    console.log('🆕 New permissions added:', newPermissions.length);
    
    console.log('\n🎉 SUCCESS! Your app registration now includes:');
    console.log('   ✅ Policy.Read.All - Will fix missing conditional access policies');
    console.log('   ✅ RoleManagement.Read.Directory - Will fix missing privileged roles');
    console.log('   ✅ All other core assessment permissions');
    
    console.log('\n⚠️  IMPORTANT NEXT STEPS:');
    console.log('   1. Admin consent is required for new permissions');
    console.log('   2. Go to Azure Portal > App registrations > API permissions');
    console.log(`   3. Find app with Client ID: ${CLIENT_ID}`);
    console.log('   4. Click "Grant admin consent for [Your Organization]"');
    
    const consentUrl = `https://login.microsoftonline.com/common/adminconsent?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent('https://victorious-pond-069956e03.6.azurestaticapps.net/api/consent-callback')}`;
    console.log('\n🔗 Or use this admin consent URL:');
    console.log(consentUrl);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Ensure your access token has Application.ReadWrite.All permission');
    console.log('   2. Verify the token is valid and not expired');
    console.log('   3. Check that you have permission to modify this app registration');
  }
}

// How to get an access token:
function getAccessTokenInstructions() {
  console.log('🔑 How to get an access token:\n');
  console.log('Option 1 - Azure CLI:');
  console.log('  az login');
  console.log('  az account get-access-token --resource https://graph.microsoft.com/ --query accessToken -o tsv');
  console.log('\nOption 2 - PowerShell:');
  console.log('  Install-Module Microsoft.Graph');
  console.log('  Connect-MgGraph -Scopes "Application.ReadWrite.All"');
  console.log('  Get-MgContext | Select-Object -ExpandProperty TokenCredential');
  console.log('\nOption 3 - Azure Portal:');
  console.log('  Use Microsoft Graph Explorer at https://developer.microsoft.com/en-us/graph/graph-explorer');
}

// Check if we have a valid token
if (ACCESS_TOKEN === 'YOUR_ACCESS_TOKEN_HERE') {
  console.log('⚠️  Please replace YOUR_ACCESS_TOKEN_HERE with your actual access token\n');
  getAccessTokenInstructions();
} else {
  // Run the fix
  quickFixPermissions();
}
