# RBAC and Tenant-Restricted Sign-In Implementation Guide

## Overview
This guide provides detailed instructions for implementing Role-Based Access Control (RBAC) and tenant-restricted sign-in for the M365 Assessment Framework. These security measures ensure that only authorized users from your specific tenant can access the application.

## Table of Contents
1. [Tenant-Restricted Sign-In](#tenant-restricted-sign-in)
2. [Role-Based Access Control (RBAC)](#role-based-access-control-rbac)
3. [Azure AD App Registration Configuration](#azure-ad-app-registration-configuration)
4. [Backend Implementation](#backend-implementation)
5. [Frontend Implementation](#frontend-implementation)
6. [Testing and Validation](#testing-and-validation)

## Tenant-Restricted Sign-In

### 1. Azure AD App Registration Settings

#### A. Configure Single Tenant Application
1. Navigate to Azure Portal → Azure Active Directory → App registrations
2. Select your M365 Assessment Framework app registration
3. Go to **Authentication** tab
4. Under **Supported account types**, select:
   - **Accounts in this organizational directory only (Single tenant)**
   - This restricts sign-in to users from your specific tenant only

#### B. Configure Redirect URIs
```json
{
  "redirectUris": [
    "https://your-domain.azurestaticapps.net/auth/callback",
    "https://localhost:3000/auth/callback"  // For development
  ],
  "replyUrlsWithType": [
    {
      "url": "https://your-domain.azurestaticapps.net/auth/callback",
      "type": "Web"
    }
  ]
}
```

#### C. Configure Token Configuration (Optional)
Add optional claims to include additional user information:
```json
{
  "optionalClaims": {
    "idToken": [
      {
        "name": "email",
        "essential": false
      },
      {
        "name": "preferred_username",
        "essential": false
      },
      {
        "name": "groups",
        "essential": false
      }
    ]
  }
}
```

### 2. Environment Configuration

Update your environment variables to enforce tenant restrictions:

```bash
# .env or Azure Static Web Apps Configuration
AZURE_CLIENT_ID=your-client-id
AZURE_TENANT_ID=your-specific-tenant-id  # Critical: Use your specific tenant ID
AZURE_CLIENT_SECRET=your-client-secret
ALLOWED_TENANT_ID=your-specific-tenant-id  # Additional validation
ORGANIZATION_DOMAIN=yourcompany.onmicrosoft.com
```

### 3. Backend Validation

Create a tenant validation middleware in your API:

```typescript
// api/middleware/tenantValidation.ts
export interface TenantValidationOptions {
  allowedTenantId: string;
  allowedDomains?: string[];
}

export function validateTenant(options: TenantValidationOptions) {
  return (req: any, res: any, next: any) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No authentication token provided' });
    }

    try {
      // Decode JWT token (use proper JWT validation library)
      const decoded = jwt.decode(token) as any;
      
      // Validate tenant ID
      if (decoded.tid !== options.allowedTenantId) {
        console.warn(`Unauthorized tenant access attempt: ${decoded.tid}`);
        return res.status(403).json({ 
          error: 'Access denied: Invalid tenant',
          code: 'INVALID_TENANT'
        });
      }

      // Optional: Validate email domain
      if (options.allowedDomains && decoded.email) {
        const emailDomain = decoded.email.split('@')[1];
        if (!options.allowedDomains.includes(emailDomain)) {
          console.warn(`Unauthorized domain access attempt: ${emailDomain}`);
          return res.status(403).json({ 
            error: 'Access denied: Invalid email domain',
            code: 'INVALID_DOMAIN'
          });
        }
      }

      // Add tenant info to request
      req.tenant = {
        id: decoded.tid,
        user: decoded
      };

      next();
    } catch (error) {
      console.error('Token validation error:', error);
      return res.status(401).json({ error: 'Invalid authentication token' });
    }
  };
}
```

## Role-Based Access Control (RBAC)

### 1. Azure AD Security Groups Setup

#### A. Create Security Groups
1. Navigate to Azure Portal → Azure Active Directory → Groups
2. Create the following security groups:

```
- M365Assessment-Admins          (Full access)
- M365Assessment-Analysts        (Read/write access to assessments)
- M365Assessment-Viewers         (Read-only access)
- M365Assessment-CustomerManagers (Customer management access)
```

#### B. Assign Users to Groups
1. Add appropriate users to each security group
2. Ensure users have the correct permissions based on their role

### 2. App Registration Configuration for Groups

#### A. Enable Group Claims
1. Go to your app registration → Token configuration
2. Add group claims:
   ```json
   {
     "groupMembershipClaims": "SecurityGroup",
     "optionalClaims": {
       "idToken": [
         {
           "name": "groups",
           "essential": false
         }
       ]
     }
   }
   ```

#### B. API Permissions
Add Microsoft Graph permissions to read group memberships:
```
- Group.Read.All (Application permission)
- User.Read (Delegated permission)
```

### 3. Backend RBAC Implementation

```typescript
// api/middleware/rbacMiddleware.ts
export enum Role {
  ADMIN = 'M365Assessment-Admins',
  ANALYST = 'M365Assessment-Analysts',
  VIEWER = 'M365Assessment-Viewers',
  CUSTOMER_MANAGER = 'M365Assessment-CustomerManagers'
}

export interface RBACOptions {
  requiredRoles: Role[];
  requireAll?: boolean; // If true, user must have ALL roles, otherwise ANY role
}

export function requireRole(options: RBACOptions) {
  return async (req: any, res: any, next: any) => {
    try {
      const userGroups = req.tenant?.user?.groups || [];
      const userRoles = userGroups.filter((group: string) => 
        Object.values(Role).includes(group as Role)
      );

      if (userRoles.length === 0) {
        return res.status(403).json({ 
          error: 'Access denied: No valid roles assigned',
          code: 'NO_ROLES'
        });
      }

      const hasRequiredRole = options.requireAll
        ? options.requiredRoles.every(role => userRoles.includes(role))
        : options.requiredRoles.some(role => userRoles.includes(role));

      if (!hasRequiredRole) {
        return res.status(403).json({ 
          error: 'Access denied: Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS',
          requiredRoles: options.requiredRoles,
          userRoles
        });
      }

      // Add user roles to request for further use
      req.userRoles = userRoles;
      next();
    } catch (error) {
      console.error('RBAC validation error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };
}

// Usage examples:
export const adminOnly = requireRole({ requiredRoles: [Role.ADMIN] });
export const analystOrAdmin = requireRole({ requiredRoles: [Role.ANALYST, Role.ADMIN] });
export const viewerOrHigher = requireRole({ requiredRoles: [Role.VIEWER, Role.ANALYST, Role.ADMIN] });
```

### 4. API Endpoint Protection

```typescript
// api/customers/index.ts - Example protected endpoint
import { validateTenant } from '../middleware/tenantValidation';
import { requireRole, Role } from '../middleware/rbacMiddleware';

const app = new Hono();

// Apply tenant validation to all routes
app.use('*', validateTenant({
  allowedTenantId: process.env.ALLOWED_TENANT_ID!,
  allowedDomains: ['yourcompany.onmicrosoft.com', 'yourcompany.com']
}));

// Customer management - Admin or Customer Manager only
app.get('/customers', requireRole({ 
  requiredRoles: [Role.ADMIN, Role.CUSTOMER_MANAGER] 
}), async (c) => {
  // Implementation
});

// Assessment creation - Analyst or Admin
app.post('/assessments', requireRole({ 
  requiredRoles: [Role.ANALYST, Role.ADMIN] 
}), async (c) => {
  // Implementation
});

// Reports viewing - Any valid role
app.get('/reports/:id', requireRole({ 
  requiredRoles: [Role.VIEWER, Role.ANALYST, Role.ADMIN] 
}), async (c) => {
  // Implementation
});
```

### 5. Frontend RBAC Implementation

```typescript
// src/hooks/useRBAC.ts
import { useAuth } from './useAuth';

export enum Permission {
  VIEW_DASHBOARD = 'view_dashboard',
  MANAGE_CUSTOMERS = 'manage_customers',
  CREATE_ASSESSMENTS = 'create_assessments',
  DELETE_ASSESSMENTS = 'delete_assessments',
  MANAGE_SETTINGS = 'manage_settings',
  VIEW_ALL_REPORTS = 'view_all_reports'
}

const rolePermissions: Record<string, Permission[]> = {
  [Role.ADMIN]: [
    Permission.VIEW_DASHBOARD,
    Permission.MANAGE_CUSTOMERS,
    Permission.CREATE_ASSESSMENTS,
    Permission.DELETE_ASSESSMENTS,
    Permission.MANAGE_SETTINGS,
    Permission.VIEW_ALL_REPORTS
  ],
  [Role.ANALYST]: [
    Permission.VIEW_DASHBOARD,
    Permission.CREATE_ASSESSMENTS,
    Permission.VIEW_ALL_REPORTS
  ],
  [Role.CUSTOMER_MANAGER]: [
    Permission.VIEW_DASHBOARD,
    Permission.MANAGE_CUSTOMERS,
    Permission.VIEW_ALL_REPORTS
  ],
  [Role.VIEWER]: [
    Permission.VIEW_DASHBOARD,
    Permission.VIEW_ALL_REPORTS
  ]
};

export function useRBAC() {
  const { user } = useAuth();
  const userRoles = user?.groups || [];

  const hasPermission = (permission: Permission): boolean => {
    return userRoles.some(role => 
      rolePermissions[role]?.includes(permission)
    );
  };

  const hasAnyRole = (roles: string[]): boolean => {
    return roles.some(role => userRoles.includes(role));
  };

  const hasAllRoles = (roles: string[]): boolean => {
    return roles.every(role => userRoles.includes(role));
  };

  return {
    userRoles,
    hasPermission,
    hasAnyRole,
    hasAllRoles,
    isAdmin: hasAnyRole([Role.ADMIN]),
    isAnalyst: hasAnyRole([Role.ANALYST]),
    isViewer: hasAnyRole([Role.VIEWER]),
    isCustomerManager: hasAnyRole([Role.CUSTOMER_MANAGER])
  };
}
```

```typescript
// src/components/ProtectedComponent.tsx
import React from 'react';
import { useRBAC, Permission } from '../hooks/useRBAC';

interface ProtectedComponentProps {
  permission?: Permission;
  roles?: string[];
  requireAll?: boolean;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export const ProtectedComponent: React.FC<ProtectedComponentProps> = ({
  permission,
  roles,
  requireAll = false,
  fallback = null,
  children
}) => {
  const { hasPermission, hasAnyRole, hasAllRoles } = useRBAC();

  let hasAccess = true;

  if (permission) {
    hasAccess = hasAccess && hasPermission(permission);
  }

  if (roles) {
    hasAccess = hasAccess && (requireAll ? hasAllRoles(roles) : hasAnyRole(roles));
  }

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
```

### 6. Navigation Updates with RBAC

Update the Navigation component to respect user roles:

```typescript
// src/components/layout/Navigation.tsx - Updated navItems
const Navigation: React.FC<NavigationProps> = ({ userName, onLogout }) => {
  const { hasPermission } = useRBAC();

  const navItems: NavItem[] = [
    {
      path: '/',
      label: 'Dashboard',
      icon: <DashboardIcon />,
      permission: Permission.VIEW_DASHBOARD
    },
    {
      path: '/best-practices',
      label: 'Best Practices',
      icon: <BestPracticesIcon />,
      permission: Permission.VIEW_ALL_REPORTS
    },
    {
      path: '/reports',
      label: 'Reports',
      icon: <ReportsIcon />,
      permission: Permission.VIEW_ALL_REPORTS
    },
    {
      path: '/settings',
      label: 'Assessment Settings',
      icon: <SettingsIcon />,
      permission: Permission.MANAGE_SETTINGS
    }
  ].filter(item => !item.permission || hasPermission(item.permission));

  // Rest of component...
};
```

## Testing and Validation

### 1. Tenant Restriction Testing

```bash
# Test with invalid tenant
curl -H "Authorization: Bearer <token-from-different-tenant>" \
     https://your-api.azurestaticapps.net/api/customers

# Expected: 403 Forbidden with "INVALID_TENANT" error
```

### 2. RBAC Testing Matrix

| Role | Dashboard | Create Assessment | Manage Customers | Settings | Expected Result |
|------|-----------|------------------|------------------|----------|----------------|
| Admin | ✓ | ✓ | ✓ | ✓ | Full access |
| Analyst | ✓ | ✓ | ✗ | ✗ | Limited access |
| Viewer | ✓ | ✗ | ✗ | ✗ | Read-only |
| No Role | ✗ | ✗ | ✗ | ✗ | Access denied |

### 3. Automated Tests

```typescript
// tests/rbac.test.ts
describe('RBAC Implementation', () => {
  test('Admin can access all endpoints', async () => {
    const adminToken = generateTokenWithRoles([Role.ADMIN]);
    // Test all endpoints
  });

  test('Viewer cannot create assessments', async () => {
    const viewerToken = generateTokenWithRoles([Role.VIEWER]);
    const response = await request(app)
      .post('/api/assessments')
      .set('Authorization', `Bearer ${viewerToken}`);
    
    expect(response.status).toBe(403);
  });

  test('Invalid tenant is rejected', async () => {
    const invalidTenantToken = generateTokenWithTenant('invalid-tenant-id');
    const response = await request(app)
      .get('/api/customers')
      .set('Authorization', `Bearer ${invalidTenantToken}`);
    
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('INVALID_TENANT');
  });
});
```

## Security Best Practices

### 1. Token Security
- Implement proper JWT validation with signature verification
- Use short-lived access tokens (1 hour) with refresh tokens
- Store tokens securely (httpOnly cookies for web apps)

### 2. Logging and Monitoring
```typescript
// Enhanced logging for security events
export function logSecurityEvent(event: {
  type: 'TENANT_VIOLATION' | 'RBAC_VIOLATION' | 'AUTH_FAILURE';
  userId?: string;
  tenantId?: string;
  endpoint: string;
  details: any;
}) {
  console.warn('[SECURITY]', {
    timestamp: new Date().toISOString(),
    ...event
  });
  
  // Send to monitoring service (Application Insights, etc.)
}
```

### 3. Regular Auditing
- Review group memberships monthly
- Audit access logs for suspicious activity
- Monitor for cross-tenant access attempts
- Regular security assessments of the application

## Implementation Checklist

### Azure AD Configuration
- [ ] Set app registration to single tenant
- [ ] Configure proper redirect URIs
- [ ] Create security groups
- [ ] Assign users to appropriate groups
- [ ] Configure group claims in token
- [ ] Set up API permissions

### Backend Implementation
- [ ] Implement tenant validation middleware
- [ ] Implement RBAC middleware
- [ ] Protect all API endpoints
- [ ] Add comprehensive logging
- [ ] Implement error handling

### Frontend Implementation
- [ ] Create useRBAC hook
- [ ] Update navigation based on roles
- [ ] Implement ProtectedComponent
- [ ] Add role-based UI elements
- [ ] Handle permission errors gracefully

### Testing
- [ ] Test tenant restrictions
- [ ] Test all role combinations
- [ ] Verify error responses
- [ ] Test token validation
- [ ] Performance testing with middleware

### Documentation
- [ ] Document role definitions
- [ ] Create user access guides
- [ ] Maintain security procedures
- [ ] Document incident response

## Conclusion

This implementation provides comprehensive tenant restriction and RBAC for the M365 Assessment Framework. The solution ensures that:

1. **Only your tenant users can access the application**
2. **Users have appropriate permissions based on their roles**
3. **All security events are logged and monitored**
4. **The UI adapts based on user permissions**
5. **API endpoints are properly protected**

Regular reviews and updates of these security measures are essential to maintain the integrity and security of your assessment framework.
