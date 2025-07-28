# Multi-Tenant Azure AD Workflow Guide

## ✅ **CORRECT Multi-Tenant Approach** (Now Implemented)

Based on official Microsoft documentation, here's the correct workflow for multi-tenant applications:

### 1. **ONE Multi-Tenant App Registration** (In YOUR Azure Tenant)
- Register **one application** in your Azure AD tenant
- Configure it as **"Multi-tenant"** (Accounts in any organizational directory)
- Configure all required permissions (User.Read.All, Directory.Read.All, etc.)
- Use the **same Client ID** for all customers

### 2. **Customer Admin Consent Process**
- Generate an admin consent URL for each customer tenant:
  ```
  https://login.microsoftonline.com/{customer-tenant-id}/adminconsent?client_id={your-app-client-id}&redirect_uri={your-redirect-uri}
  ```
- Customer tenant admin clicks the URL and consents to **your existing app**
- After consent, your app appears as an "Enterprise Application" in their tenant
- **No new app registration is created** in the customer tenant

### 3. **Access Customer Data**
- Use the **same Client ID** to authenticate with customer tenants
- Azure AD automatically routes to the correct tenant based on user login
- Your app can access the customer's Microsoft 365 data using the consented permissions

## 🔧 **Current Implementation**

### Frontend (`ConsentUrlGeneratorEmbedded.tsx`)
- ✅ Uses one master Client ID from `M365_ASSESSMENT_CONFIG.clientId`
- ✅ Generates correct admin consent URL format: `/adminconsent` (not `/v2.0/adminconsent`)
- ✅ Uses customer's tenant ID in the consent URL
- ✅ Removed individual app creation UI (not needed for multi-tenant)

### Backend (`local.settings.json`)
- ✅ Set `CREATE_INDIVIDUAL_APPS: "false"` to use multi-tenant approach
- ✅ Uses shared app registration for all customers

### Configuration (`adminConsentService.ts`)
- ✅ `M365_ASSESSMENT_CONFIG.clientId` returns your master app's Client ID
- ✅ Configured with all required Microsoft Graph permissions
- ✅ Proper redirect URI configuration

## 📋 **Setup Checklist**

### In YOUR Azure Tenant:
1. ✅ Register app as **Multi-tenant** (`Accounts in any organizational directory`)
2. ✅ Configure API permissions (all permissions from `requiredPermissions` array)
3. ✅ Add redirect URI for consent callback
4. ✅ Copy Client ID to `M365_ASSESSMENT_CONFIG.clientId`

### For Each Customer:
1. ✅ Get customer's Tenant ID (automatic from customer data)
2. ✅ Generate admin consent URL using consent generator
3. ✅ Send URL to customer tenant admin
4. ✅ Customer admin clicks URL and consents
5. ✅ Your app appears in their "Enterprise Applications"
6. ✅ You can now access their tenant using the same Client ID

## 🚫 **Incorrect Approaches** (Removed)

### ❌ Individual App Creation
- Creating separate app registrations in each customer tenant
- Requires Application.ReadWrite.All permissions
- More complex to manage multiple Client IDs
- Not the standard multi-tenant pattern

### ❌ Wrong URL Formats
- Using `/v2.0/adminconsent` (for OAuth flows, not admin consent)
- Using wrong tenant ID (should be customer's, not yours)
- Including `scope` parameter in admin consent URL (not needed)

## 📚 **References**

- [Microsoft Docs: Building Multi-tenant applications](https://learn.microsoft.com/en-us/sharepoint/dev/sp-add-ins-modernize/multi-tenant-applications)
- [Microsoft Docs: Admin consent endpoint](https://learn.microsoft.com/en-us/graph/auth-v2-service#step-2-request-administrator-consent)
- [Microsoft Docs: Consent experience](https://learn.microsoft.com/en-us/azure/active-directory/develop/application-consent-experience)

## 🔍 **How to Verify It's Working**

1. **Generate consent URL** using the ConsentUrlGeneratorEmbedded component
2. **Customer admin clicks URL** - should see consent page with your app's permissions
3. **After consent** - your app appears in customer's Enterprise Applications
4. **Test access** - use the same Client ID to authenticate and access customer data

## 🎯 **Benefits of This Approach**

- ✅ **Official Microsoft pattern** for multi-tenant applications
- ✅ **Single app registration** to manage (easier maintenance)
- ✅ **Same Client ID** for all customers (simpler authentication logic)
- ✅ **No special permissions required** (no Application.ReadWrite.All needed)
- ✅ **Scalable** - works for any number of customers
- ✅ **Standard enterprise workflow** that customers understand
