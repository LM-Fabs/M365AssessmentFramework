# Customer Lookup Fix for Consent URL Generation

## Issue Identified
The customer lookup for consent URL generation wasn't working because customers were only being loaded when the "Customer Management" section was opened, but the ConsentUrlGenerator component was trying to use the customers state which could be empty.

## Root Cause
In `src/pages/Settings.tsx`, the `loadCustomers()` function was only called when `showCustomerManagement` was true:

```typescript
useEffect(() => {
  if (showCustomerManagement) {
    loadCustomers();
  }
}, [showCustomerManagement]);
```

However, the ConsentUrlGenerator component was using the same `customers` state array, which would be empty if the customer management section hadn't been opened yet.

## Fix Applied

### 1. Added Customer Loading for Consent URL Generator
Added a new useEffect in `src/pages/Settings.tsx` to load customers when the consent URL generator is opened:

```typescript
// Load customers when consent URL generator is opened
useEffect(() => {
  if (showConsentUrlGenerator) {
    loadCustomers();
  }
}, [showConsentUrlGenerator]);
```

### 2. Verified API Endpoint Functionality
Confirmed that the customer API endpoint is working properly:
- ✅ GET /api/customers returns valid data
- ✅ Customer data includes required fields (id, tenantName, tenantId, tenantDomain)
- ✅ Response format: `{"success":true,"data":[...]}`

### 3. Created Debug Tools
Created `debug-customer-loading.sh` script to test customer loading and diagnose issues:
- Tests customer API endpoint
- Counts available customers
- Shows customer details
- Tests consent callback endpoint
- Provides troubleshooting guidance

## Expected Behavior After Fix

1. **When opening ConsentUrlGenerator:**
   - Customers will be automatically loaded
   - Customer dropdown will populate with available customers
   - User can select a customer for consent URL generation

2. **Customer Data Flow:**
   ```
   Settings.tsx opens ConsentUrlGenerator
   → useEffect triggers loadCustomers()
   → CustomerService.getCustomers() called
   → API /customers endpoint fetched
   → customers state updated
   → ConsentUrlGenerator receives populated customers prop
   → Customer dropdown shows available options
   ```

3. **Debug Console Logs:**
   - Check browser console for ConsentUrlGenerator initialization logs
   - Look for "🎯 ConsentUrlGenerator initialized:" with customer count
   - CustomerService logs should show successful API calls

## Testing Steps

1. **Immediate Test:**
   ```bash
   ./debug-customer-loading.sh
   ```

2. **UI Test:**
   - Open Settings page
   - Click "Generate Consent URLs" 
   - Verify customer dropdown is populated
   - Select a customer and verify consent URL generates

3. **Browser Console:**
   - Check for successful customer loading logs
   - Verify no 404 errors for /api/customers
   - Confirm ConsentUrlGenerator shows correct customer count

## Rollback Plan
If issues persist, the fix can be rolled back by removing the added useEffect:
```typescript
// Remove this useEffect if needed:
useEffect(() => {
  if (showConsentUrlGenerator) {
    loadCustomers();
  }
}, [showConsentUrlGenerator]);
```

## Additional Notes
- The fix ensures customers are loaded exactly when needed
- No duplicate loading occurs if customer management was already opened
- Maintains existing customer management functionality
- CustomerService caching prevents unnecessary API calls
- ConsentUrlGenerator debugging logs help identify any remaining issues

## Files Modified
1. `src/pages/Settings.tsx` - Added customer loading for ConsentUrlGenerator
2. `debug-customer-loading.sh` - Created debugging script (new file)

## Verification Commands
```bash
# Test API endpoint
curl "https://victorious-pond-069956e03.6.azurestaticapps.net/api/customers"

# Run debug script
./debug-customer-loading.sh

# Check customer count
curl -s "https://victorious-pond-069956e03.6.azurestaticapps.net/api/customers" | jq '.data | length'
```

The customer lookup should now work properly for consent URL generation!
