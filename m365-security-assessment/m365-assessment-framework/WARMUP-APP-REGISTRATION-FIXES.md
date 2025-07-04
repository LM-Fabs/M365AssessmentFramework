# API Warmup and App Registration Fixes

## Issues Fixed

### 1. API Warmup Failures
**Problem**: Test and diagnostics endpoints were timing out during warmup
**Solution**: 
- Added HEAD method support to all warmup endpoints (`test`, `diagnostics`, `assessment/current`)
- Improved response handling for all HTTP methods
- Enhanced CORS handling for API warmup scenarios

**Endpoints Updated**:
- `/api/test` - Now supports GET, HEAD, OPTIONS
- `/api/diagnostics` - Now supports GET, HEAD, OPTIONS 
- `/api/assessment/current` - Now supports GET, HEAD, OPTIONS

### 2. App Registration Failing Without Tenant ID
**Problem**: App registration was failing when only domain was provided despite domain resolution logic
**Solution**:
- Enhanced domain-to-tenant-ID resolution with multiple fallback mechanisms
- Added timeout handling and retry logic for external API calls
- Improved error handling with specific error messages for different failure scenarios
- Added validation for resolved tenant IDs (must be valid GUIDs)
- Enhanced environment variable validation

**Domain Resolution Improvements**:
- OpenID Connect discovery endpoint with timeout (10 seconds)
- Microsoft realm API as fallback (5 seconds)
- Better validation of resolved tenant IDs
- Graceful fallback to using domain as-is if resolution fails

**App Registration Improvements**:
- Retry logic for application creation (up to 3 attempts)
- Better error handling for permission issues
- Enhanced client secret generation with error handling
- Improved service principal creation with error handling
- More detailed error messages for troubleshooting

## Key Changes Made

### 1. API Index (`api/index.ts`)
- Enhanced environment variable validation in `createMultiTenantAppHandler`
- Added HEAD method support to warmup endpoints
- Improved error responses with troubleshooting steps

### 2. GraphApiService (`api/shared/graphApiService.ts`)
- Enhanced `resolveDomainToTenantId()` with:
  - Timeout handling for external API calls
  - Multiple resolution strategies
  - Better error handling and logging
  - GUID validation for resolved tenant IDs
- Improved `createMultiTenantAppRegistration()` with:
  - Retry logic for application creation
  - Enhanced error handling for all API calls
  - Better validation of responses

## Testing

### API Warmup Test
```bash
# Test endpoints that should work for warmup
curl -I https://your-app.azurestaticapps.net/api/test
curl -I https://your-app.azurestaticapps.net/api/diagnostics
curl -I https://your-app.azurestaticapps.net/api/assessment/current
```

### App Registration Test
Use the frontend to create a customer with only a domain (no tenant ID):
1. Go to Settings page
2. Click "Add New Customer" 
3. Enter tenant name and domain only (leave tenant ID empty)
4. Click "Create Customer"
5. Click "Create App Registration" 
6. Should now work with better error messages if it fails

## Error Scenarios Covered

### 1. Missing Environment Variables
- Clear error message indicating which variables are missing
- Troubleshooting steps provided
- No attempt to call Graph API if credentials are missing

### 2. Authentication Failures
- Specific error messages for token issues
- Guidance on checking service principal configuration
- Retry logic for transient failures

### 3. Permission Issues
- Clear indication when Application.ReadWrite.All permission is missing
- Guidance on granting admin consent
- Specific troubleshooting steps

### 4. Domain Resolution Failures
- Graceful fallback to using domain as-is
- Multiple resolution strategies tried
- Timeout handling to prevent hanging

## Expected Behavior After Fixes

1. **API Warmup**: Should complete successfully without 404 errors or timeouts
2. **App Registration**: Should work with domain-only input, with better error messages if it fails
3. **Error Handling**: More specific and actionable error messages
4. **Logging**: Better logging for troubleshooting domain resolution and app creation

## Next Steps

1. Deploy the updated code
2. Test API warmup functionality
3. Test app registration with domain-only input
4. Monitor logs for any remaining issues
5. Validate that domain resolution is working in production

## Troubleshooting

If issues persist:

1. **Check Azure Configuration**:
   - Visit `/api/azure-config` to verify environment variables
   - Ensure service principal has correct permissions

2. **Check Logs**:
   - Look for domain resolution logs in Application Insights
   - Check for specific error messages in app registration flow

3. **Test Domain Resolution Manually**:
   - Try the OpenID Connect discovery URL manually
   - Verify the domain is associated with an Azure AD tenant
