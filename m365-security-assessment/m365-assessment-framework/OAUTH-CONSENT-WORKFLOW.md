# OAuth Consent Workflow for Enterprise App Registration

## Overview

This document describes the automated OAuth consent workflow that enables customer admins to grant consent and automatically creates enterprise app registrations in their Azure AD tenants.

## Workflow Process

### 1. URL Generation
The `ConsentUrlGenerator` component creates OAuth consent URLs that include:
- **Client ID**: The multi-tenant application ID
- **Tenant ID**: Customer's Azure AD tenant ID
- **Callback URL**: Points to our consent callback API
- **State Parameter**: Encoded JSON containing customer identification

### 2. Admin Consent Flow
1. Customer admin receives the consent URL
2. Admin clicks the URL and is redirected to Microsoft's consent page
3. Admin reviews and grants permissions to the application
4. Microsoft redirects back to our callback with consent status

### 3. Callback Processing
The `consent-callback` Azure Function:
- Validates consent parameters
- Extracts customer information from state
- Creates enterprise app registration using Microsoft Graph API
- Updates customer record with consent status
- Redirects to result page with status information

### 4. Result Display
The `ConsentResult` component shows:
- Success/failure status
- Customer information
- Enterprise app details
- Next steps for the user

## Technical Components

### Frontend Components

#### ConsentUrlGenerator.tsx
```typescript
// Generates OAuth consent URLs with encoded state
const generateConsentUrl = () => {
  const state = encodeURIComponent(JSON.stringify({
    customerId: selectedCustomer.id,
    clientId: selectedCustomer.application_id,
    tenantId: selectedCustomer.tenant_id
  }));
  
  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?` +
    `client_id=${clientId}&` +
    `response_type=code&` +
    `redirect_uri=${callbackUrl}&` +
    `scope=https://graph.microsoft.com/.default&` +
    `response_mode=query&` +
    `prompt=admin_consent&` +
    `state=${state}`;
};
```

#### ConsentResult.tsx
```typescript
// Displays consent outcome with appropriate messaging and actions
const ConsentResult: React.FC = () => {
  const [searchParams] = useSearchParams();
  const status = searchParams.get('status'); // success, error, partial
  const message = searchParams.get('message');
  const customerName = searchParams.get('customer');
  const appId = searchParams.get('appId');
  
  // Render status-specific UI with action buttons
};
```

### Backend Functions

#### consent-callback.ts
```typescript
// Handles OAuth callback and creates enterprise app
export async function handleConsentCallback(context: Context, req: HttpRequest) {
  // 1. Extract and validate parameters
  const { admin_consent, tenant, state, error } = req.query;
  
  // 2. Parse customer information from state
  const stateData = JSON.parse(decodeURIComponent(state));
  const { customerId, clientId, tenantId } = stateData;
  
  // 3. Create enterprise app registration
  const enterpriseApp = await graphApiService.createEnterpriseApplication(
    tenantId, 
    clientId
  );
  
  // 4. Update customer record
  await customerService.updateConsentStatus(customerId, true);
  
  // 5. Return success response with redirect
  return successResponse(customer, enterpriseApp);
}
```

#### GraphApiService.ts
```typescript
// Creates enterprise app (service principal) in customer tenant
async createEnterpriseApplication(tenantId: string, appId: string) {
  const graphClient = this.getGraphClient(tenantId);
  
  const servicePrincipal = await graphClient.servicePrincipals.post({
    appId: appId,
    accountEnabled: true,
    displayName: "M365 Security Assessment Framework"
  });
  
  return servicePrincipal;
}
```

## URL Parameters and State Management

### Consent URL Parameters
- `client_id`: Multi-tenant application ID
- `response_type`: Always "code"
- `redirect_uri`: Callback URL (encoded)
- `scope`: "https://graph.microsoft.com/.default"
- `prompt`: "admin_consent" (forces admin consent)
- `state`: Base64 encoded JSON with customer data

### State Parameter Structure
```json
{
  "customerId": "uuid-customer-id",
  "clientId": "azure-app-id", 
  "tenantId": "customer-tenant-id"
}
```

### Callback Parameters (from Microsoft)
- `admin_consent`: "True" if consent granted
- `tenant`: Customer's tenant ID
- `state`: Original state parameter
- `error`: Error code if consent failed

### Result Page Parameters
- `status`: "success", "error", or "partial"
- `message`: Detailed status message
- `customer`: Customer name (URL encoded)
- `appId`: Created enterprise app ID

## Error Handling

### Common Error Scenarios
1. **Missing Parameters**: Invalid or missing consent callback parameters
2. **Customer Not Found**: State parameter contains invalid customer ID
3. **Graph API Errors**: Permission issues or API failures
4. **Existing App**: Service principal already exists
5. **Consent Denied**: Admin rejected the consent request

### Error Response Handling
```typescript
// Different redirect URLs based on error type
const errorMappings = {
  'missing_parameters': '/consent-result?status=error&message=Invalid+callback',
  'customer_not_found': '/consent-result?status=error&message=Customer+not+found',
  'graph_api_error': '/consent-result?status=partial&message=Consent+granted+but+app+creation+failed',
  'consent_denied': '/consent-result?status=error&message=Admin+consent+denied'
};
```

## Security Considerations

### State Parameter Validation
- Always validate state parameter format
- Verify customer exists before processing
- Check tenant ID matches expected format

### Permission Requirements
- Application needs `Application.ReadWrite.All` permission
- Service principal creation requires admin consent
- Graph API calls use application permissions

### CORS Configuration
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};
```

## Testing

### Manual Testing Steps
1. Create test customer in the application
2. Generate consent URL using the UI
3. Open URL in browser with admin account
4. Grant consent to the application
5. Verify redirect to success page
6. Check enterprise app exists in customer tenant

### Automated Testing
Run the test script:
```bash
./test-consent-workflow.sh
```

This tests:
- API endpoint availability
- Customer creation/deletion
- Consent URL generation
- Callback endpoint response
- Frontend result page access

## Deployment Considerations

### Environment Variables
```bash
# Required for Graph API access
AZURE_CLIENT_ID=your-app-id
AZURE_CLIENT_SECRET=your-app-secret
AZURE_TENANT_ID=your-tenant-id

# Frontend URL for redirects
FRONTEND_URL=https://your-app.azurestaticapps.net
```

### Azure Function Configuration
- Enable CORS for the consent callback function
- Configure authentication for Graph API access
- Set up proper error handling and logging

### Static Web App Configuration
Add consent result route to staticwebapp.config.json:
```json
{
  "routes": [
    {
      "route": "/consent-result",
      "rewrite": "/index.html"
    }
  ]
}
```

## Troubleshooting

### Common Issues
1. **CORS Errors**: Ensure callback function has proper CORS headers
2. **State Parsing Errors**: Verify state parameter encoding/decoding
3. **Graph API Permissions**: Check application has required permissions
4. **Redirect Issues**: Verify callback URL matches registered redirect URI

### Debug Information
The consent callback logs detailed information:
```typescript
context.log('🏢 Processing consent for:', {
  customerId,
  clientId, 
  tenantId,
  admin_consent: params.admin_consent
});
```

### Error Investigation
Check Azure Function logs for:
- Parameter validation errors
- Graph API response details
- Customer lookup failures
- Service principal creation issues

## Future Enhancements

### Potential Improvements
1. **Retry Logic**: Automatic retry for transient Graph API failures
2. **Notification System**: Email notifications on consent completion
3. **Audit Logging**: Detailed audit trail for compliance
4. **Batch Processing**: Handle multiple app registrations
5. **Custom Permissions**: Configure specific permission sets per customer

### Integration Opportunities
- Integration with Azure Key Vault for secrets
- Connection to Azure Monitor for observability
- Integration with customer notification systems
- Automated testing pipeline for consent workflow
