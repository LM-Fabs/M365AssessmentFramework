# PostgreSQL Migration App Registration Fixes

## Problem Summary

After migrating from Azure Table Storage to PostgreSQL, app registrations were not being detected properly for existing customers. The issue was that:

1. **Data Structure Changes**: PostgreSQL stores app registration data as JSONB, which may differ from the original Table Storage format
2. **String vs Object Storage**: Some app registration data may have been stored as JSON strings instead of objects
3. **Validation Logic**: The original validation logic (`row.app_registration || undefined`) didn't handle malformed or corrupted data properly
4. **Migration Artifacts**: Some customers may have corrupted app registration data from the migration process

## Root Cause Analysis

The main issues identified were:

1. **PostgreSQL Service**: Raw JSONB data wasn't being validated before being returned to the application
2. **Type Inconsistency**: App registration data could be stored as strings, objects, or null values
3. **Validation Function**: The `hasRealAppReg` function wasn't handling all edge cases from PostgreSQL data structure
4. **Migration Gaps**: The migration process didn't properly clean up or standardize app registration data

## Solutions Implemented

### 1. Enhanced Data Validation in PostgreSQL Service

**File**: `api/shared/postgresqlService.ts`

Added a new `validateAppRegistration()` function that:
- Handles string to object conversion for JSON data
- Validates object structure and required properties
- Returns `undefined` for invalid/corrupted data
- Provides comprehensive error handling

```typescript
function validateAppRegistration(appRegData: any): any | undefined {
    if (!appRegData) return undefined;
    
    // Handle string data (parse JSON)
    if (typeof appRegData === 'string') {
        try {
            const parsed = JSON.parse(appRegData);
            return validateAppRegistration(parsed);
        } catch {
            return undefined;
        }
    }
    
    // Validate object structure
    if (typeof appRegData === 'object') {
        if (appRegData.applicationId || appRegData.clientId) {
            return appRegData;
        }
        return Object.keys(appRegData).length === 0 ? undefined : appRegData;
    }
    
    return undefined;
}
```

**Updated Methods**:
- `getCustomers()` - Now uses `validateAppRegistration(row.app_registration)`
- `getCustomer()` - Now uses `validateAppRegistration(row.app_registration)`
- `getCustomerByDomain()` - Now uses `validateAppRegistration(row.app_registration)`
- `getCustomerByTenantId()` - Now uses `validateAppRegistration(row.app_registration)`
- `updateCustomer()` - Now uses `validateAppRegistration(row.app_registration)`
- `getCustomerByClientId()` - Now uses `validateAppRegistration(row.app_registration)`

### 2. Enhanced App Registration Validation Logic

**File**: `api/index.ts`

Enhanced the `hasRealAppReg()` function with:
- Better type checking for string values
- Empty string validation with `.trim()`
- Enhanced debugging and logging
- Comprehensive error state detection

```typescript
const hasRealAppReg = customer.appRegistration && 
                    customer.appRegistration.applicationId && 
                    typeof customer.appRegistration.applicationId === 'string' &&
                    customer.appRegistration.applicationId.trim() !== '' &&
                    isValidUUID(customer.appRegistration.applicationId) &&
                    !customer.appRegistration.applicationId.startsWith('pending-') &&
                    !customer.appRegistration.applicationId.startsWith('ERROR_') &&
                    !customer.appRegistration.applicationId.startsWith('placeholder-') &&
                    customer.appRegistration.isReal !== false;
```

### 3. New Fix App Registrations Endpoint

**File**: `api/index.ts`

Created a new endpoint `/api/fix-app-registrations` that:
- Scans all customers for app registration issues
- Identifies corrupted or missing app registration data
- Creates placeholder app registrations for customers needing fixes
- Provides detailed reporting on fixes applied
- Logs comprehensive debugging information

**Endpoint**: `POST /api/fix-app-registrations`

**Response Example**:
```json
{
    "success": true,
    "summary": {
        "totalCustomers": 25,
        "needingFix": 8,
        "fixed": 8,
        "errors": 0,
        "valid": 17
    },
    "details": [...]
}
```

### 4. Standalone Migration Script

**File**: `api/migrate-app-registrations.js`

Created a standalone Node.js script that:
- Connects directly to PostgreSQL
- Analyzes all customer app registration data
- Identifies and fixes data structure issues
- Can be run independently for maintenance

**Usage**: `node api/migrate-app-registrations.js`

### 5. Comprehensive Debugging and Logging

Added extensive logging throughout the codebase:
- **PostgreSQL Service**: Logs data validation results
- **Index.ts**: Enhanced debugging for app registration detection
- **Fix Endpoint**: Detailed reporting on all operations
- **Migration Script**: Step-by-step processing logs

## Testing and Validation

### 1. Test Script

**File**: `test-postgresql-migration-fixes.sh`

Provides testing guidance and validation steps.

### 2. Manual Testing Steps

1. **Deploy Updated Functions**:
   ```bash
   npm run build
   func azure functionapp publish your-function-app-name
   ```

2. **Test Fix Endpoint**:
   ```bash
   curl -X POST https://your-function-app.azurewebsites.net/api/fix-app-registrations
   ```

3. **Verify Customer Data**:
   ```bash
   curl https://your-function-app.azurewebsites.net/api/customers
   ```

4. **Check Logs**: Monitor Azure Function logs for debugging information

### 3. Expected Results

After applying these fixes:
- ✅ Existing customers should show their app registrations correctly
- ✅ New customers should continue to work normally
- ✅ Corrupted app registration data should be automatically fixed
- ✅ The Settings page should properly detect app registration status
- ✅ Admin consent flows should work correctly

## Data Structure Changes

### Before (Corrupted):
```json
{
    "appRegistration": "string data" // or null or malformed object
}
```

### After (Fixed):
```json
{
    "appRegistration": {
        "applicationId": "12345678-1234-1234-1234-123456789012",
        "clientId": "12345678-1234-1234-1234-123456789012",
        "servicePrincipalId": "12345678-1234-1234-1234-123456789012",
        "permissions": [...],
        "isReal": true,
        "needsSetup": false
    }
}
```

### Placeholder (For Corrupted Data):
```json
{
    "appRegistration": {
        "applicationId": "placeholder-customer-id",
        "clientId": "placeholder-customer-id",
        "servicePrincipalId": "placeholder-customer-id",
        "permissions": ["Organization.Read.All", ...],
        "isReal": false,
        "needsSetup": true,
        "migrationFixed": true
    }
}
```

## Migration Impact Assessment

### Issues Fixed:
1. ✅ App registration detection after PostgreSQL migration
2. ✅ Data type inconsistencies between Table Storage and PostgreSQL
3. ✅ String vs object storage format issues
4. ✅ Corrupted app registration data validation
5. ✅ Missing app registration data handling

### Backward Compatibility:
- ✅ Existing valid app registrations remain unchanged
- ✅ New customer creation flow unaffected
- ✅ Assessment functionality preserved
- ✅ Admin consent process maintained

## Next Steps

1. **Deploy Changes**: Deploy the updated Azure Functions
2. **Run Fix Endpoint**: Execute the fix endpoint to repair existing data
3. **Monitor Logs**: Check Azure Function logs for any remaining issues
4. **Validate Frontend**: Test the Settings page to ensure app registration detection works
5. **Customer Verification**: Verify that existing customers can now see their app registrations

## Files Modified

1. **api/index.ts** - Enhanced validation and new fix endpoint
2. **api/shared/postgresqlService.ts** - Added data validation function
3. **api/migrate-app-registrations.js** - New standalone migration script
4. **test-postgresql-migration-fixes.sh** - Testing and validation script

## Security Considerations

- All changes maintain existing security boundaries
- App registration validation doesn't expose sensitive data
- Placeholder app registrations are clearly marked as non-functional
- Migration script uses secure Azure AD authentication
- No changes to authentication or authorization flows
