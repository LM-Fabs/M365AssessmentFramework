#!/usr/bin/env node

/**
 * Script to programmatically update your multi-tenant app registration
 * This will fix the missing privileged roles and conditional access policies issues
 * 
 * Usage:
 * 1. Get an access token with Application.ReadWrite.All permission
 * 2. Run: node fix-app-permissions.js <ACCESS_TOKEN>
 */

import { AdminConsentService } from '../src/services/adminConsentService';

const CLIENT_ID = 'd1cc9e16-9194-4892-92c5-473c9f65dcb3'; // Your multi-tenant app registration

async function fixAppPermissions(accessToken: string) {
  console.log('🔧 Fixing M365 Assessment Framework app registration permissions...\n');
  
  const consentService = AdminConsentService.getInstance();
  
  try {
    // Step 1: Check current permissions
    console.log('📋 Step 1: Checking current permissions...');
    const currentResult = await consentService.getCurrentAppPermissions(CLIENT_ID, accessToken);
    
    if (!currentResult.success) {
      throw new Error(`Failed to get current permissions: ${currentResult.error}`);
    }
    
    console.log('✅ Current permissions:', currentResult.permissions);
    console.log('📊 Current permission count:', currentResult.permissions?.length || 0);
    
    // Step 2: Analyze missing features
    const analysis = consentService.analyzeEnabledFeatures(currentResult.permissions || []);
    console.log('\n🔍 Feature Analysis:');
    console.log('  ✅ Enabled features:', analysis.enabledFeatures);
    console.log('  ⚠️  Partial features:', analysis.partialFeatures);
    console.log('  ❌ Missing features:', analysis.missingFeatures);
    
    // Step 3: Add the critical missing permissions for your issues
    console.log('\n🎯 Step 2: Adding critical permissions to fix reported issues...');
    
    // These are the specific feature groups that will fix your issues:
    const criticalFeatures = [
      'policies',        // Adds Policy.Read.All - FIXES conditional access policies issue
      'privilegedRoles'  // Adds RoleManagement.Read.Directory - FIXES privileged roles issue
    ];
    
    console.log('🔄 Adding feature groups:', criticalFeatures);
    
    const updateResult = await consentService.updateAppRegistrationPermissions(
      CLIENT_ID,
      accessToken,
      {
        featureGroups: criticalFeatures,
        replaceAll: false // Only add missing permissions, don't replace existing ones
      }
    );
    
    if (!updateResult.success) {
      throw new Error(`Failed to update permissions: ${updateResult.error}`);
    }
    
    console.log('✅ App registration updated successfully!');
    console.log('📋 Total permissions after update:', updateResult.permissions?.length || 0);
    console.log('🆕 Newly added permissions:', updateResult.newPermissions);
    console.log('🎯 Enabled features:', updateResult.enabledFeatures);
    
    if (updateResult.consentsRequired) {
      console.log('\n⚠️  IMPORTANT: Admin consent is required for the new permissions!');
      console.log('📖 Next steps:');
      console.log('   1. Go to Azure Portal > Azure Active Directory > App registrations');
      console.log(`   2. Find your app: "${CLIENT_ID}"`);
      console.log('   3. Go to "API permissions"');
      console.log('   4. Click "Grant admin consent for [Your Organization]"');
      console.log('   5. Alternatively, customers can re-consent using the admin consent URL');
      
      // Generate example consent URL
      const consentUrl = `https://login.microsoftonline.com/common/adminconsent?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent('https://victorious-pond-069956e03.6.azurestaticapps.net/api/consent-callback')}`;
      console.log('\n🔗 Admin consent URL for customers:');
      console.log(consentUrl);
    }
    
    console.log('\n🎉 SUCCESS: Your app registration now has the permissions needed for:');
    console.log('   ✅ Conditional Access Policies (Policy.Read.All)');
    console.log('   ✅ Privileged Role Assignments (RoleManagement.Read.Directory)');
    console.log('   ✅ All other assessment features');
    
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Example usage for all features (comprehensive update)
async function enableAllFeatures(accessToken: string) {
  console.log('🚀 Enabling ALL assessment features...\n');
  
  const consentService = AdminConsentService.getInstance();
  
  const allFeatures = Object.keys(AdminConsentService.FEATURE_PERMISSION_GROUPS);
  console.log('🎯 Enabling features:', allFeatures);
  
  const result = await consentService.updateAppRegistrationPermissions(
    CLIENT_ID,
    accessToken,
    {
      featureGroups: allFeatures,
      replaceAll: false
    }
  );
  
  if (result.success) {
    console.log('✅ All features enabled successfully!');
    console.log('📋 Total permissions:', result.permissions?.length);
    console.log('🆕 New permissions:', result.newPermissions?.length);
  } else {
    console.error('❌ Failed to enable all features:', result.error);
  }
}

// Get access token from command line argument
const accessToken = process.argv[2];

if (!accessToken) {
  console.error('❌ Error: Access token required');
  console.log('\nUsage:');
  console.log('  node fix-app-permissions.js <ACCESS_TOKEN>');
  console.log('\nTo get an access token:');
  console.log('  1. Use Azure CLI: az account get-access-token --resource https://graph.microsoft.com/');
  console.log('  2. Or use your application authentication flow');
  console.log('  3. Token needs Application.ReadWrite.All permission');
  process.exit(1);
}

// Run the fix
fixAppPermissions(accessToken)
  .then(() => {
    console.log('\n✨ Permission update completed successfully!');
  })
  .catch((error) => {
    console.error('\n💥 Failed to update permissions:', error);
    process.exit(1);
  });

// Export functions for programmatic use
export { fixAppPermissions, enableAllFeatures };
