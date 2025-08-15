// Script to verify permission ID mappings
console.log('🔍 Verifying Permission ID Mappings');
console.log('=====================================');

const requiredPermissions = [
    'User.Read.All',                    // Read user profiles
    'Directory.Read.All',               // Read directory data
    'Reports.Read.All',                 // Read usage reports
    'Policy.Read.All',                  // Read security policies - CRITICAL for CA policies
    'SecurityEvents.Read.All',          // Read security events
    'IdentityRiskEvent.Read.All',       // Read identity risk events
    'Agreement.Read.All',               // Read terms of use agreements
    'AuditLog.Read.All',                // Read audit logs
    'Organization.Read.All',            // Read organization info
    'RoleManagement.Read.Directory'     // Read role assignments - CRITICAL for privileged roles
];

const permissionMap = {
    'Organization.Read.All': '498476ce-e0fe-48b0-b801-37ba7e2685c6',
    'Reports.Read.All': '230c1aed-a721-4c5d-9cb4-a90514e508ef',
    'Directory.Read.All': '7ab1d382-f21e-4acd-a863-ba3e13f7da61',
    'Policy.Read.All': '246dd0d5-5bd0-4def-940b-0421030a5b68',
    'SecurityEvents.Read.All': 'bf394140-e372-4bf9-a898-299cfc7564e5',
    'IdentityRiskEvent.Read.All': '6e472fd1-ad78-48da-a0f0-97ab2c6b769e',
    'DeviceManagementManagedDevices.Read.All': '2f51be20-0bb4-4fed-bf7b-db946066c75e',
    'AuditLog.Read.All': 'b0afded3-3588-46d8-8b3d-9842eff778da',
    'User.Read.All': 'df021288-bdef-4463-88db-98f22de89214',
    'Agreement.Read.All': 'ef4b5d93-3104-4867-9b0b-5cd61b5ffb6f',
    'RoleManagement.Read.Directory': '483bed4a-2ad3-4361-a73b-c83ccdbdc53c'
};

console.log('\n📋 Required Permissions Check:');
requiredPermissions.forEach((permission, index) => {
    const id = permissionMap[permission];
    if (id) {
        console.log(`✅ ${index + 1}. ${permission} → ${id}`);
    } else {
        console.log(`❌ ${index + 1}. ${permission} → MISSING ID!`);
    }
});

console.log('\n🚨 Missing Permissions in Map:');
const missingPermissions = requiredPermissions.filter(perm => !permissionMap[perm]);
if (missingPermissions.length > 0) {
    missingPermissions.forEach(perm => console.log(`   - ${perm}`));
} else {
    console.log('   None - All permissions have IDs!');
}

console.log('\n📊 Permission Count Summary:');
console.log(`   Required: ${requiredPermissions.length}`);
console.log(`   Mapped: ${requiredPermissions.filter(perm => permissionMap[perm]).length}`);
console.log(`   Missing: ${missingPermissions.length}`);

console.log('\n✅ All permissions should now be correctly mapped!');
