# README.md

# M365 Security Assessment Framework

## Overview

The M365 Security Assessment Framework is a comprehensive web application designed for security consultants to evaluate and monitor Microsoft 365 tenant security postures. The application provides real-time security metrics, historical comparisons, and actionable recommendations based on Microsoft best practices.

## Features

### 1. Security Assessment
- Real-time security metrics collection through Microsoft Graph API
- Comprehensive scoring across six security domains:
  - Identity & Access Management
  - Data Protection
  - Endpoint Security
  - Cloud Apps Security
  - Information Protection
  - Threat Protection
- Historical trend analysis and comparison
- Best practices alignment checks

### 2. Dashboard & Visualization
- Interactive security score cards
- Metric trend visualization
- Category-specific deep dives
- Custom threshold settings

### 3. Recommendations Engine
- Actionable security recommendations
- Priority-based implementation guidance
- Reference documentation links
- Impact and effort estimations

### 4. Assessment History
- Historical assessment tracking
- Progress monitoring
- Trend analysis
- Comparative reporting

## Architecture

### Frontend (React Application)
```
src/
├── components/         # Reusable UI components
├── pages/             # Main application pages
├── hooks/             # Custom React hooks
├── services/          # API and service integrations
├── models/            # TypeScript interfaces
├── config/            # Configuration files
└── utils/            # Helper functions
```

### Backend (Azure Functions)
```
api/
├── CreateEnterpriseApp/     # Enterprise app creation
├── GetAssessment/          # Assessment retrieval
├── GetBestPractices/       # Best practices data
├── SaveAssessment/         # Assessment storage
└── shared/                # Shared utilities
```

## Core Components

### 1. Authentication (`src/hooks/useAuth.ts`)
- Handles Microsoft authentication using MSAL
- Manages token acquisition and renewal
- Provides authentication state management

### 2. Graph Integration (`src/services/graphService.ts`)
- Manages Microsoft Graph API interactions
- Collects security metrics and tenant data
- Handles API permissions and access

### 3. Assessment Service (`src/services/assessmentService.ts`)
- Manages assessment data
- Handles assessment creation and storage
- Provides comparison capabilities

### 4. Security Scoring (`src/utils/scoring.ts`)
- Implements scoring algorithms
- Calculates category-specific scores
- Determines overall security posture

## Configuration & Customization

### Environment Variables
Required environment variables in `.env`:
```
REACT_APP_CLIENT_ID=<your-azure-ad-client-id>
REACT_APP_TENANT_ID=<your-azure-ad-tenant-id>
REACT_APP_API_URL=/api
```

### Customizing Security Categories
1. Modify `src/shared/constants.ts`:
```typescript
export const SECURITY_CATEGORIES = {
  // Add or modify security categories
};

export const METRIC_WEIGHTS = {
  // Adjust scoring weights
};
```

### Adding New Metrics
1. Update `src/models/Metrics.ts` interface
2. Add collection logic in `src/services/graphService.ts`
3. Add scoring logic in `src/utils/scoring.ts`
4. Update visualization in relevant components

### Custom Recommendations
1. Modify `src/utils/comparison.ts`:
- Add new gap analysis rules
- Customize recommendation generation
- Update impact calculations

## Deployment

### Prerequisites
- Node.js 16.x or later
- Azure subscription
- Azure Static Web Apps service
- Azure Functions service

### Deployment Steps
1. Configure Azure Static Web App:
   ```bash
   az staticwebapp create ...
   ```

2. Set up GitHub Actions:
   - Add required secrets to repository
   - Configure deployment workflow

3. Deploy to Azure:
   - Push changes to main branch
   - GitHub Actions will handle deployment

### Required GitHub Secrets
- AZURE_CLIENT_ID
- AZURE_TENANT_ID
- AZURE_SUBSCRIPTION_ID
- AZURE_STATIC_WEB_APPS_API_TOKEN
- AZURE_FUNCTION_APP_NAME

## Development

### Local Development
1. Install dependencies:
   ```bash
   npm install
   ```

2. Start development server:
   ```bash
   npm run dev
   ```

3. Run tests:
   ```bash
   npm test
   ```

### Adding New Features

#### 1. Understanding Feature Dependencies
The framework consists of several interconnected layers:

- **Data Layer** (`src/models/`): Defines core data structures
  - `Assessment.ts` - Assessment data model
  - `Metrics.ts` - Security metrics definitions
  - `Tenant.ts` - Tenant information model

- **Services Layer** (`src/services/`): Handles API and data operations
  - `graphService.ts` - Microsoft Graph API interactions
  - `assessmentService.ts` - Assessment operations
  - `storageService.ts` - Data persistence

- **UI Layer** (`src/components/`): React components for visualization
  - `SecurityScoreCard` - Overall security scoring
  - `MetricsDisplay` - Detailed metrics visualization
  - `ComparisonView` - Comparative analysis
  - `RecommendationsList` - Security recommendations

- **API Layer** (`api/`): Azure Functions backend
  - `CreateEnterpriseApp` - Enterprise application management
  - `GetAssessment` - Assessment retrieval
  - `SaveAssessment` - Assessment persistence
  - `GetBestPractices` - Security best practices

#### 2. Development Workflow

##### 2.1 Adding New Security Metrics

1. **Update Data Model**:
   ```typescript
   // In src/models/Metrics.ts
   export interface Metrics {
     newCategory: {
       metricName: number;
       subMetrics: {
         value: number;
         status: string;
       };
     };
   }
   ```

2. **Implement Data Collection**:
   - Add Graph API calls in `graphService.ts`
   - Add data processing logic
   - Update security scoring calculations

3. **Add Visualization**:
   - Create/update components
   - Integrate with existing dashboards
   - Add comparative analysis support

##### 2.2 Adding Analysis Features

1. **Implement Analysis Logic**:
   - Add analysis functions in `utils/comparison.ts`
   - Update recommendation generation
   - Implement best practices comparison

2. **Update Services**:
   - Add methods in `assessmentService.ts`
   - Create new API endpoints if needed
   - Update data processing logic

3. **Create Visualization**:
   - Add new visualization components
   - Update existing dashboards
   - Implement user interaction handlers

##### 2.3 Adding API Endpoints

1. **Create Azure Function**:
   - Add function configuration
   - Implement request handling
   - Add authentication and authorization
   - Implement error handling

2. **Update Service Layer**:
   - Add corresponding service methods
   - Implement data validation
   - Add error handling

3. **Connect UI Components**:
   - Create/update React hooks
   - Add loading and error states
   - Implement data refresh logic

#### 3. Best Practices

##### 3.1 Data Management
- Use TypeScript interfaces for all data structures
- Implement proper error handling
- Cache data when appropriate using React hooks
- Validate all API responses
- Use proper TypeScript types and avoid `any`

##### 3.2 Component Architecture
- Keep components focused and reusable
- Use custom hooks for shared logic
- Follow established styling patterns
- Implement proper loading and error states
- Use React.memo() for performance optimization

##### 3.3 Security
- Validate all inputs
- Maintain proper authentication checks
- Follow Azure security best practices
- Implement proper RBAC
- Use secure communication protocols

#### 4. Key Relationships

1. **Data Flow**:
   ```
   Graph API → GraphService → Hooks → Components → UI
   ```

2. **Assessment Flow**:
   ```
   User Input → AssessmentForm → AssessmentService → Azure Functions → Storage
   ```

3. **Security Analysis**:
   ```
   Metrics → Comparison Utils → Recommendations → SecurityScoreCard
   ```

#### 5. Testing Changes

1. **Unit Testing**:
   - Test utilities and services
   - Verify calculations
   - Test component rendering
   - Mock external dependencies

2. **Integration Testing**:
   - Test API endpoints
   - Verify data flow
   - Test authentication
   - Validate error handling

3. **UI Testing**:
   - Test component interactions
   - Verify responsive design
   - Test accessibility
   - Validate user workflows

When adding new features, always:
1. Start with the data model
2. Implement service layer changes
3. Create/update API endpoints
4. Add UI components
5. Implement proper testing
6. Document changes

## Troubleshooting

### Common Issues
1. Authentication Problems
   - Verify Azure AD app registration
   - Check required permissions
   - Validate environment variables

2. API Errors
   - Check Azure Function logs
   - Verify Graph API permissions
   - Validate token acquisition

3. Deployment Issues
   - Review GitHub Actions logs
   - Verify Azure credentials
   - Check resource configuration

## License

This project is licensed under the MIT License. See the LICENSE file for details.

# End