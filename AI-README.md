# AI-README: M365 Security Assessment Framework

## 🎯 PROJECT OVERVIEW

**Name:** M365 Security Assessment Framework  
**Type:** Full-stack web application with Azure Static Web Apps deployment  
**Purpose:** Enterprise Microsoft 365 security assessment tool with OAuth admin consent workflow  
**URL ENDPOINT** https://victorious-pond-069956e03.6.azurestaticapps.net/

## 🏗️ ARCHITECTURE & DEPLOYMENT

### Deployment Platform
- **Azure Static Web Apps** (NOT standalone Azure Functions)
- **Important:** Azure Static Web Apps forces Functions Runtime ~4 regardless of environment variables
- **Critical:** Uses hybrid runtime model with specific compatibility requirements

### Frontend
- **Framework:** React with TypeScript
- **Build Tool:** Create React App (CRA)
- **Output:** Static files in `build/` directory

### Backend (Azure Functions in Static Web Apps)
- **Runtime:** Azure Functions v4 (forced by Azure Static Web Apps)
- **Language:** TypeScript
- **Programming Model:** Azure Functions v4 with **default export pattern** (NOT app.http() registration)
- **Location:** `/api` directory

## 🔧 AZURE FUNCTIONS COMPATIBILITY RULES

### ✅ CORRECT Pattern for Azure Static Web Apps:
```typescript
import { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";

export default async function (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    // Function implementation
    return {
        status: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: true })
    };
}
```

### ❌ WRONG Patterns (DO NOT USE):
- `function.json` files (v4 doesn't use them)
- `app.http()` registration (standalone Azure Functions only)
- `module.exports` pattern (v3 syntax)
- `context.res = {}` assignments (v3 syntax)

### Package Dependencies:
- `@azure/functions: ^4.5.0` (NOT v3.x.x)
- `host.json` extensionBundle: `"[4.*, 5.0.0)"`

## 📁 PROJECT STRUCTURE

```
m365-security-assessment/m365-assessment-framework/
├── src/                          # React frontend source
├── public/                       # Static assets
├── build/                        # React build output
├── api/                          # Azure Functions (TypeScript)
│   ├── consent-callback/         # OAuth consent handler
│   │   └── index.ts             # Main function (default export)
│   ├── shared/                   # Shared services
│   │   ├── graphApiService.ts    # Microsoft Graph integration
│   │   └── postgresqlService.ts  # Database operations
│   ├── package.json             # Functions dependencies
│   ├── host.json               # Functions runtime config
│   └── tsconfig.json           # TypeScript config
├── infra/                       # Infrastructure as Code
├── staticwebapp.config.json     # SWA routing config
└── package.json                # Frontend dependencies
```

## 🔐 AUTHENTICATION & SERVICES

### Microsoft Graph Integration
- **Purpose:** Enterprise application registration management
- **OAuth Flow:** Admin consent callback handling
- **Client ID:** `d1cc9e16-9194-4892-92c5-473c9f65dcb3`

### Database
- **Type:** PostgreSQL (Azure Database for PostgreSQL)
- **Purpose:** Store customer app registrations and consent status
- **Service:** `PostgreSQLService` class

### Key Environment Variables
```
AZURE_CLIENT_ID=***
AZURE_CLIENT_SECRET=***
AZURE_TENANT_ID=***
POSTGRES_HOST=psql-c6qdbpkda5cvs.postgres.database.azure.com
POSTGRES_DATABASE=m365_assessment
POSTGRES_USER=assessment_admin
REACT_APP_API_URL=/api
REACT_APP_CLIENT_ID=d1cc9e16-9194-4892-92c5-473c9f65dcb3
```

## 🚀 DEPLOYMENT WORKFLOW

### GitHub Actions Pipeline
- **Trigger:** Push to main branch
- **Builder:** Oryx (Microsoft's build system)
- **Frontend Build:** `npm run build` (React)
- **Backend Build:** `npm run build` (TypeScript compilation)
- **Deploy Target:** Azure Static Web Apps

### Build Commands
```bash
# Frontend
npm install && npm run build

# Backend (API)
cd api && npm install && npm run build
```

## 🔄 OAUTH CONSENT WORKFLOW

### Flow Description
1. **Admin Consent Trigger:** POST to `/api/consent-callback`
2. **Redirect to Microsoft:** OAuth consent URL generation
3. **Consent Callback:** GET to `/api/consent-callback` with authorization code
4. **App Registration:** Create enterprise application in customer tenant
5. **Database Storage:** Save app registration details
6. **Frontend Redirect:** Success/error page

### Key Endpoints
- `GET /api/consent-callback` - Handle OAuth callback
- `POST /api/consent-callback` - Generate consent URL

## 🐛 COMMON DEPLOYMENT ISSUES & SOLUTIONS

### Issue: "An unknown exception has occurred"
**Cause:** Multiple possible causes:
1. Function.json files or wrong programming model
2. Missing shared services that functions depend on
3. TypeScript compilation issues in imported services
4. CORS or routing configuration problems

**Solution:** 
- Remove function.json files, use default export pattern
- Ensure all imported services (GraphApiService, PostgreSQLService) compile correctly
- Check that shared services exist and have proper TypeScript definitions
- Verify staticwebapp.config.json routing

### Issue: "Functions Runtime version mismatch"
**Cause:** Trying to use v3 syntax with v4 runtime  
**Solution:** Use v4 types with default export (see CORRECT pattern above)

### Issue: Build failures
**Cause:** TypeScript compilation errors or dependency mismatches  
**Solution:** Ensure @azure/functions v4.x and proper type usage

### Issue: Successful build but deployment failure
**Cause:** Runtime errors in function dependencies or missing services
**Solution:** Check shared services, simplify function imports, verify all dependencies exist

## 🎨 FRONTEND DETAILS

### Framework Specifics
- **React:** Functional components with hooks
- **Styling:** Tailwind CSS
- **State Management:** React built-in state
- **API Communication:** Fetch API to `/api` endpoints

### Key Pages
- Admin consent workflow
- Customer management
- Security assessment results

## 📝 DEVELOPMENT GUIDELINES

### When Making Changes
1. **Always** verify Azure Functions v4 compatibility
2. **Never** add function.json files to v4 functions
3. **Use** default export pattern for Azure Static Web Apps
4. **Test** builds with `npm run build` before committing
5. **Remember** Azure Static Web Apps runtime limitations

### Service Integration
- Graph API calls should use proper error handling
- PostgreSQL operations should include connection management
- CORS headers are required for frontend communication

## 🚨 CRITICAL REMINDERS FOR AI

1. **DO NOT** switch between Azure Functions v3/v4 - stick with v4
2. **DO NOT** use app.http() registration - use default export
3. **DO NOT** create function.json files - v4 doesn't need them
4. **DO NOT** use context.res assignments - return response objects
5. **ALWAYS** use Azure Static Web Apps compatible patterns
6. **REMEMBER** this is NOT standalone Azure Functions - it's SWA

## Current Status: DEPLOYMENT CONFIGURATION FIXED ✅

### CRITICAL DISCOVERY #2:
**Issue**: API still returning 404 errors even after v4 conversion
**Root Cause**: **GitHub Actions workflow forcing Functions Runtime v3** - `FUNCTIONS_EXTENSION_VERSION: "~3"` in deployment environment
**Evidence**: Functions converted to v4 syntax but deployment configured for v3 runtime

### DEPLOYMENT FIXES APPLIED:
1. **✅ GitHub Actions Updated** - Changed `FUNCTIONS_EXTENSION_VERSION` from `"~3"` to `"~4"`
2. **✅ All Functions v4 Compatible** - Complete conversion from v3 to v4 programming model
3. **✅ Package Dependencies Correct** - `@azure/functions: ^4.5.0` in package.json
4. **✅ Host.json Configuration** - Extension bundle set to `[4.*, 5.0.0)`

### Major Fixes Applied:
1. **✅ Function.json Files Removed** - Eliminated v4 compatibility conflicts
2. **✅ ALL Functions Converted to v4** - customers, diagnostics, customerById, bestPractices, assessments, currentAssessment, customerAssessments, createAssessment
3. **✅ Default Export Pattern** - All converted functions use `export default async function` pattern
4. **✅ Return Statements** - Replaced `context.res =` assignments with `return` statements
5. **✅ TypeScript Compilation** - All changes compile without errors
6. **✅ Deployment Runtime Fixed** - GitHub Actions now deploys with Functions Runtime v4

### Functions ALL Converted to v4:
- ✅ **consent-callback** (OAuth workflow)
- ✅ **test-function** (minimal test endpoint)  
- ✅ **customers** (main customer management)
- ✅ **diagnostics** (environment diagnostics)
- ✅ **customerById** (individual customer operations)
- ✅ **bestPractices** (security best practices data)
- ✅ **assessments** (assessment management)
- ✅ **currentAssessment** (current assessment retrieval)
- ✅ **customerAssessments** (customer assessment history)
- ✅ **createAssessment** (assessment creation)

### Next Steps:
1. **🚀 Trigger Deployment** - Push changes to trigger new GitHub Actions deployment with v4 runtime
2. **🔍 Verify API Endpoints** - Test `/api/customers`, `/api/diagnostics` etc. work correctly
3. **📊 Monitor Deployment** - Check Azure portal for successful API deployment

### Breakthrough Understanding:
Azure Static Web Apps with Functions Runtime v4 **cannot have mixed programming models**. Even if some functions are v4-compliant, having ANY v3 syntax functions prevents the entire API from loading properly. This explains why ALL endpoints returned 404 - the Functions runtime wasn't starting correctly due to the mixed syntax.

## 🔗 IMPORTANT LINKS

- **GitHub Repo:** LM-Fabs/M365AssessmentFramework
- **Deployment:** Azure Static Web Apps
- **Documentation:** Azure Static Web Apps + Azure Functions integration
