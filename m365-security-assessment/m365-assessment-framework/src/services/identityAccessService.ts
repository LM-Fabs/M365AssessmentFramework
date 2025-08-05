/**
 * Identity & Access Report Service
 * 
 * Based on EntraAuthReport patterns from https://github.com/azurebeard/EntraAuthReport
 * Provides comprehensive authentication methods analysis including:
 * - Strong authentication percentage
 * - Passwordless capabilities  
 * - MFA statistics
 * - User authentication method details
 * - Privileged user analysis
 */

import axios from 'axios';

// Authentication method types with strength classification
export interface AuthenticationMethod {
    type: string;
    name: string;
    strength: 'Strong' | 'Weak';
    altName?: string;
}

export interface UserRegistrationDetails {
    userPrincipalName: string;
    isMfaCapable: boolean;
    isPasswordlessCapable: boolean;
    defaultMfaMethod: string;
    methodsRegistered: string[];
    isPrivileged?: boolean;
    isExternalUser?: boolean;
    isSyncUser?: boolean;
    hasStrongMethods?: boolean;
    hasWeakMethods?: boolean;
    hasMixedMethods?: boolean;
}

export interface AuthenticationMethodPolicy {
    type: string;
    displayName: string;
    state: 'Enabled' | 'Disabled';
    includeTargets?: string[];
}

export interface IdentityAccessReport {
    organizationName: string;
    reportDate: string;
    summary: {
        totalUsers: number;
        mfaCapableUsers: number;
        mfaCapablePercentage: number;
        strongAuthUsers: number;
        strongAuthPercentage: number;
        passwordlessUsers: number;
        passwordlessPercentage: number;
        mixedAuthUsers: number;
        mixedAuthPercentage: number;
        privilegedUsers: number;
        privilegedUsersNotPhishResistant: number;
    };
    users: UserRegistrationDetails[];
    authenticationMethods: AuthenticationMethod[];
    policies: AuthenticationMethodPolicy[];
    methodsDisabledByPolicy: AuthenticationMethod[];
    methodsEnabledByPolicy: AuthenticationMethod[];
}

export interface IdentityAccessServiceConfig {
    cacheTimeout?: number; // Cache timeout in milliseconds (default: 30 minutes)
    enableDebugLogs?: boolean;
}

class IdentityAccessService {
    private cache: Map<string, { data: any; timestamp: number }> = new Map();
    private config: IdentityAccessServiceConfig;

    // Authentication method definitions following EntraAuthReport patterns
    private static readonly ALL_METHODS: AuthenticationMethod[] = [
        // Strong methods (passwordless and MFA)
        { type: 'microsoftAuthenticatorPasswordless', name: 'Microsoft Authenticator Passwordless', strength: 'Strong' },
        { type: 'fido2SecurityKey', name: 'Fido2 Security Key', strength: 'Strong', altName: 'Fido2' },
        { type: 'passKeyDeviceBound', name: 'Device Bound Passkey', strength: 'Strong', altName: 'Fido2' },
        { type: 'passKeyDeviceBoundAuthenticator', name: 'Microsoft Authenticator Passkey', strength: 'Strong', altName: 'Fido2' },
        { type: 'passKeyDeviceBoundWindowsHello', name: 'Windows Hello Passkey', strength: 'Strong', altName: 'Fido2' },
        { type: 'microsoftAuthenticatorPush', name: 'Microsoft Authenticator App', strength: 'Strong', altName: 'MicrosoftAuthenticator' },
        { type: 'softwareOneTimePasscode', name: 'Software OTP', strength: 'Strong', altName: 'SoftwareOath' },
        { type: 'hardwareOneTimePasscode', name: 'Hardware OTP', strength: 'Strong', altName: 'HardwareOath' },
        { type: 'windowsHelloForBusiness', name: 'Windows Hello for Business', strength: 'Strong', altName: 'windowsHelloForBusiness' },
        { type: 'temporaryAccessPass', name: 'Temporary Access Pass', strength: 'Strong', altName: 'TemporaryAccessPass' },
        { type: 'macOsSecureEnclaveKey', name: 'MacOS Secure Enclave Key', strength: 'Strong' },
        
        // Weak methods
        { type: 'SMS', name: 'SMS', strength: 'Weak', altName: 'SMS' },
        { type: 'Voice Call', name: 'Voice Call', strength: 'Weak', altName: 'voice' },
        { type: 'email', name: 'Email', strength: 'Weak', altName: 'Email' },
        { type: 'alternateMobilePhone', name: 'Alternative Mobile Phone', strength: 'Weak', altName: 'Voice' },
        { type: 'securityQuestion', name: 'Security Questions', strength: 'Weak', altName: 'Security Questions' }
    ];

    constructor(config: IdentityAccessServiceConfig = {}) {
        this.config = {
            cacheTimeout: config.cacheTimeout || 30 * 60 * 1000, // 30 minutes default
            enableDebugLogs: config.enableDebugLogs || false
        };
    }

    private log(message: string, data?: any): void {
        if (this.config.enableDebugLogs) {
            console.log(`[IdentityAccessService] ${message}`, data || '');
        }
    }

    private isValidCacheEntry(cacheKey: string): boolean {
        const cached = this.cache.get(cacheKey);
        if (!cached) return false;
        
        const isValid = Date.now() - cached.timestamp < this.config.cacheTimeout!;
        if (!isValid) {
            this.cache.delete(cacheKey);
        }
        return isValid;
    }

    private setCacheEntry(cacheKey: string, data: any): void {
        this.cache.set(cacheKey, {
            data,
            timestamp: Date.now()
        });
    }

    private getCacheEntry(cacheKey: string): any | null {
        if (this.isValidCacheEntry(cacheKey)) {
            return this.cache.get(cacheKey)!.data;
        }
        return null;
    }

    /**
     * Get organization information
     */
    private async getOrganizationInfo(): Promise<{ displayName: string }> {
        const cacheKey = 'organization_info';
        const cached = this.getCacheEntry(cacheKey);
        if (cached) {
            this.log('Returning cached organization info');
            return cached;
        }

        try {
            this.log('Fetching organization information from Microsoft Graph API');
            
            // TODO: Replace with actual Microsoft Graph API call
            // const response = await axios.get('/api/graph/organization');
            
            // Mock implementation for now
            const orgInfo = {
                displayName: 'Organization Name' // Will be replaced with actual API call
            };

            this.setCacheEntry(cacheKey, orgInfo);
            return orgInfo;
        } catch (error) {
            this.log('Error fetching organization info:', error);
            throw new Error('Failed to fetch organization information');
        }
    }

    /**
     * Get user registration details from Microsoft Graph API
     */
    private async getUserRegistrationDetails(): Promise<UserRegistrationDetails[]> {
        const cacheKey = 'user_registration_details';
        const cached = this.getCacheEntry(cacheKey);
        if (cached) {
            this.log('Returning cached user registration details');
            return cached;
        }

        try {
            this.log('Fetching user registration details from Microsoft Graph API');
            
            // TODO: Replace with actual Microsoft Graph API call
            // const response = await axios.get('/api/graph/reports/authenticationMethods/userRegistrationDetails?$top=20000&$orderby=userPrincipalName');
            
            // Mock implementation for now - will be replaced with actual API calls
            const userRegistrations: UserRegistrationDetails[] = [];

            this.setCacheEntry(cacheKey, userRegistrations);
            return userRegistrations;
        } catch (error) {
            this.log('Error fetching user registration details:', error);
            throw new Error('Failed to fetch user registration details');
        }
    }

    /**
     * Get authentication method policies
     */
    private async getAuthenticationMethodPolicies(): Promise<AuthenticationMethodPolicy[]> {
        const cacheKey = 'auth_method_policies';
        const cached = this.getCacheEntry(cacheKey);
        if (cached) {
            this.log('Returning cached authentication method policies');
            return cached;
        }

        try {
            this.log('Fetching authentication method policies from Microsoft Graph API');
            
            // TODO: Replace with actual Microsoft Graph API call
            // const response = await axios.get('/api/graph/policies/authenticationmethodspolicy');
            
            // Mock implementation for now
            const policies: AuthenticationMethodPolicy[] = [];

            this.setCacheEntry(cacheKey, policies);
            return policies;
        } catch (error) {
            this.log('Error fetching authentication method policies:', error);
            throw new Error('Failed to fetch authentication method policies');
        }
    }

    /**
     * Get privileged users (directory role members)
     */
    private async getPrivilegedUsers(): Promise<string[]> {
        const cacheKey = 'privileged_users';
        const cached = this.getCacheEntry(cacheKey);
        if (cached) {
            this.log('Returning cached privileged users');
            return cached;
        }

        try {
            this.log('Fetching privileged users from Microsoft Graph API');
            
            // TODO: Replace with actual Microsoft Graph API calls
            // For P2 licenses: Use PIM roles
            // const eligiblePIM = await axios.get('/api/graph/roleManagement/directory/roleEligibilitySchedules?$expand=*');
            // const assignedPIM = await axios.get('/api/graph/roleManagement/directory/roleAssignmentSchedules?$expand=*');
            
            // For other licenses: Use directory roles
            // const directoryRoles = await axios.get('/api/graph/directoryRoles');
            
            // Mock implementation for now
            const privilegedUsers: string[] = [];

            this.setCacheEntry(cacheKey, privilegedUsers);
            return privilegedUsers;
        } catch (error) {
            this.log('Error fetching privileged users:', error);
            throw new Error('Failed to fetch privileged users');
        }
    }

    /**
     * Enhance user registration details with additional analysis
     */
    private enhanceUserRegistrationDetails(
        users: UserRegistrationDetails[], 
        privilegedUsers: string[]
    ): UserRegistrationDetails[] {
        const strongMethodTypes = IdentityAccessService.ALL_METHODS
            .filter(m => m.strength === 'Strong')
            .map(m => m.type);
        
        const weakMethodTypes = IdentityAccessService.ALL_METHODS
            .filter(m => m.strength === 'Weak')
            .map(m => m.type);

        return users.map(user => {
            const hasStrongMethods = user.methodsRegistered.some(method => 
                strongMethodTypes.includes(method)
            );
            
            const hasWeakMethods = user.methodsRegistered.some(method => 
                weakMethodTypes.includes(method)
            );

            const hasMixedMethods = hasStrongMethods && hasWeakMethods;
            
            const isPrivileged = privilegedUsers.includes(user.userPrincipalName);
            
            const isExternalUser = user.userPrincipalName.includes('#EXT#');
            
            const isSyncUser = user.userPrincipalName.startsWith('Sync_') || 
                              user.userPrincipalName.startsWith('ADToAADSyncServiceAccount');

            return {
                ...user,
                hasStrongMethods,
                hasWeakMethods,
                hasMixedMethods,
                isPrivileged,
                isExternalUser,
                isSyncUser
            };
        });
    }

    /**
     * Calculate summary statistics
     */
    private calculateSummaryStatistics(users: UserRegistrationDetails[]): IdentityAccessReport['summary'] {
        const totalUsers = users.length;
        const mfaCapableUsers = users.filter(u => u.isMfaCapable).length;
        const strongAuthUsers = users.filter(u => u.hasStrongMethods).length;
        const passwordlessUsers = users.filter(u => u.isPasswordlessCapable).length;
        const mixedAuthUsers = users.filter(u => u.hasMixedMethods).length;
        const privilegedUsers = users.filter(u => u.isPrivileged).length;
        
        // Privileged users not using phish-resistant methods (FIDO2, Passkeys)
        const phishResistantMethods = [
            'fido2SecurityKey',
            'passKeyDeviceBound', 
            'passKeyDeviceBoundAuthenticator',
            'passKeyDeviceBoundWindowsHello'
        ];
        
        const privilegedUsersNotPhishResistant = users.filter(u => 
            u.isPrivileged && 
            !u.methodsRegistered.some(method => phishResistantMethods.includes(method))
        ).length;

        return {
            totalUsers,
            mfaCapableUsers,
            mfaCapablePercentage: totalUsers > 0 ? Math.round((mfaCapableUsers / totalUsers) * 100 * 100) / 100 : 0,
            strongAuthUsers,
            strongAuthPercentage: totalUsers > 0 ? Math.round((strongAuthUsers / totalUsers) * 100 * 100) / 100 : 0,
            passwordlessUsers,
            passwordlessPercentage: totalUsers > 0 ? Math.round((passwordlessUsers / totalUsers) * 100 * 100) / 100 : 0,
            mixedAuthUsers,
            mixedAuthPercentage: totalUsers > 0 ? Math.round((mixedAuthUsers / totalUsers) * 100 * 100) / 100 : 0,
            privilegedUsers,
            privilegedUsersNotPhishResistant
        };
    }

    /**
     * Filter methods by policy state
     */
    private filterMethodsByPolicy(
        policies: AuthenticationMethodPolicy[]
    ): { enabled: AuthenticationMethod[], disabled: AuthenticationMethod[] } {
        const enabledPolicies = policies.filter(p => p.state === 'Enabled');
        const disabledPolicies = policies.filter(p => p.state === 'Disabled');

        const methodsEnabledByPolicy = IdentityAccessService.ALL_METHODS.filter(method =>
            enabledPolicies.some(policy => 
                method.altName && policy.displayName === method.altName
            )
        );

        const methodsDisabledByPolicy = IdentityAccessService.ALL_METHODS.filter(method =>
            disabledPolicies.some(policy => 
                method.altName && policy.displayName === method.altName
            )
        );

        return {
            enabled: methodsEnabledByPolicy,
            disabled: methodsDisabledByPolicy
        };
    }

    /**
     * Generate comprehensive identity & access report
     */
    public async generateIdentityAccessReport(): Promise<IdentityAccessReport> {
        try {
            this.log('Starting identity & access report generation');

            // Fetch all required data
            const [orgInfo, userRegistrations, policies, privilegedUsers] = await Promise.all([
                this.getOrganizationInfo(),
                this.getUserRegistrationDetails(),
                this.getAuthenticationMethodPolicies(),
                this.getPrivilegedUsers()
            ]);

            // Enhance user data with analysis
            const enhancedUsers = this.enhanceUserRegistrationDetails(userRegistrations, privilegedUsers);

            // Calculate summary statistics
            const summary = this.calculateSummaryStatistics(enhancedUsers);

            // Filter methods by policy
            const { enabled: methodsEnabledByPolicy, disabled: methodsDisabledByPolicy } = 
                this.filterMethodsByPolicy(policies);

            const report: IdentityAccessReport = {
                organizationName: orgInfo.displayName,
                reportDate: new Date().toISOString(),
                summary,
                users: enhancedUsers,
                authenticationMethods: IdentityAccessService.ALL_METHODS,
                policies,
                methodsEnabledByPolicy,
                methodsDisabledByPolicy
            };

            this.log('Identity & access report generated successfully', {
                totalUsers: summary.totalUsers,
                mfaCapablePercentage: summary.mfaCapablePercentage,
                strongAuthPercentage: summary.strongAuthPercentage,
                passwordlessPercentage: summary.passwordlessPercentage
            });

            return report;

        } catch (error) {
            this.log('Error generating identity & access report:', error);
            throw new Error(`Failed to generate identity & access report: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Get filtered users by criteria (following EntraAuthReport patterns)
     */
    public filterUsers(
        users: UserRegistrationDetails[],
        criteria: {
            showStrongAuthOnly?: boolean;
            showWeakAuthOnly?: boolean;
            showPasswordlessOnly?: boolean;
            showMixedAuthOnly?: boolean;
            showPrivilegedOnly?: boolean;
            hideExternalUsers?: boolean;
            hideSyncUsers?: boolean;
            hideDisabledMethods?: boolean;
        }
    ): UserRegistrationDetails[] {
        let filteredUsers = [...users];

        if (criteria.showStrongAuthOnly) {
            filteredUsers = filteredUsers.filter(u => u.hasStrongMethods);
        }

        if (criteria.showWeakAuthOnly) {
            filteredUsers = filteredUsers.filter(u => u.hasWeakMethods && !u.hasStrongMethods);
        }

        if (criteria.showPasswordlessOnly) {
            filteredUsers = filteredUsers.filter(u => u.isPasswordlessCapable);
        }

        if (criteria.showMixedAuthOnly) {
            filteredUsers = filteredUsers.filter(u => u.hasMixedMethods);
        }

        if (criteria.showPrivilegedOnly) {
            filteredUsers = filteredUsers.filter(u => u.isPrivileged);
        }

        if (criteria.hideExternalUsers) {
            filteredUsers = filteredUsers.filter(u => !u.isExternalUser);
        }

        if (criteria.hideSyncUsers) {
            filteredUsers = filteredUsers.filter(u => !u.isSyncUser);
        }

        return filteredUsers;
    }

    /**
     * Search users by UPN
     */
    public searchUsers(users: UserRegistrationDetails[], searchTerm: string): UserRegistrationDetails[] {
        if (!searchTerm.trim()) return users;
        
        const term = searchTerm.toLowerCase();
        return users.filter(user => 
            user.userPrincipalName.toLowerCase().includes(term)
        );
    }

    /**
     * Export report data to CSV format (following EntraAuthReport export functionality)
     */
    public exportToCSV(report: IdentityAccessReport): string {
        const headers = [
            'User Principal Name',
            'Default MFA Method',
            'MFA Capable',
            'Passwordless Capable',
            ...IdentityAccessService.ALL_METHODS.map(m => m.name)
        ];

        const csvRows = [headers.join(',')];

        report.users.forEach(user => {
            const row = [
                `"${user.userPrincipalName}"`,
                `"${user.defaultMfaMethod || ''}"`,
                user.isMfaCapable ? 'Yes' : 'No',
                user.isPasswordlessCapable ? 'Yes' : 'No',
                ...IdentityAccessService.ALL_METHODS.map(method => 
                    user.methodsRegistered.includes(method.type) ? 'Yes' : 'No'
                )
            ];
            csvRows.push(row.join(','));
        });

        return csvRows.join('\r\n');
    }

    /**
     * Clear all cached data
     */
    public clearCache(): void {
        this.cache.clear();
        this.log('Cache cleared');
    }

    /**
     * Get cache statistics
     */
    public getCacheStats(): { entries: number; keys: string[] } {
        return {
            entries: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }
}

export default IdentityAccessService;
