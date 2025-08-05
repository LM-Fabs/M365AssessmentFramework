/**
 * Identity & Access Report Component
 * 
 * Based on EntraAuthReport UI patterns from https://github.com/azurebeard/EntraAuthReport
 * Displays comprehensive authentication methods analysis with filtering, search, and export capabilities
 */

import React, { useState, useEffect, useMemo } from 'react';
import IdentityAccessService, { 
    IdentityAccessReport, 
    UserRegistrationDetails, 
    AuthenticationMethod 
} from '../services/identityAccessService';
import './IdentityAccessReport.css';

interface IdentityAccessReportProps {
    customerId?: string;
    assessmentId?: string;
}

const IdentityAccessReportComponent: React.FC<IdentityAccessReportProps> = ({
    customerId,
    assessmentId
}) => {
    const [report, setReport] = useState<IdentityAccessReport | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [activeFilter, setActiveFilter] = useState<string>('all');
    const [filters, setFilters] = useState({
        hideDisabledMethods: false,
        hideExternalUsers: false,
        hideSyncUsers: false
    });

    const identityAccessService = useMemo(() => new IdentityAccessService({
        enableDebugLogs: process.env.NODE_ENV === 'development'
    }), []);

    useEffect(() => {
        generateReport();
    }, [customerId, assessmentId]);

    const generateReport = async () => {
        setLoading(true);
        setError(null);

        try {
            const reportData = await identityAccessService.generateIdentityAccessReport();
            setReport(reportData);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to generate identity & access report');
            console.error('Identity & Access Report Error:', err);
        } finally {
            setLoading(false);
        }
    };

    const filteredUsers = useMemo(() => {
        if (!report) return [];

        let users = identityAccessService.searchUsers(report.users, searchTerm);

        // Apply active filter
        const filterCriteria = {
            showStrongAuthOnly: activeFilter === 'strong',
            showWeakAuthOnly: activeFilter === 'weak',
            showPasswordlessOnly: activeFilter === 'passwordless',
            showMixedAuthOnly: activeFilter === 'mixed',
            showPrivilegedOnly: activeFilter === 'privileged',
            hideExternalUsers: filters.hideExternalUsers,
            hideSyncUsers: filters.hideSyncUsers
        };

        return identityAccessService.filterUsers(users, filterCriteria);
    }, [report, searchTerm, activeFilter, filters, identityAccessService]);

    const handleExportCSV = () => {
        if (!report) return;

        const csvData = identityAccessService.exportToCSV(report);
        const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `Identity_Access_Report_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const toggleFilter = (filterType: string) => {
        setActiveFilter(filterType === activeFilter ? 'all' : filterType);
    };

    const toggleSwitch = (switchType: keyof typeof filters) => {
        setFilters(prev => ({
            ...prev,
            [switchType]: !prev[switchType]
        }));
    };

    if (loading) {
        return (
            <div className="identity-access-report">
                <div className="loading-container">
                    <div className="loading-spinner"></div>
                    <p>Generating Identity & Access Report...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="identity-access-report">
                <div className="error-container">
                    <h3>Error Loading Identity & Access Report</h3>
                    <p>{error}</p>
                    <button onClick={generateReport} className="retry-button">
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    if (!report) {
        return (
            <div className="identity-access-report">
                <p>No identity & access report data available.</p>
            </div>
        );
    }

    return (
        <div className="identity-access-report">
            {/* Header */}
            <div className="report-header">
                <div className="header-content">
                    <div>
                        <h1>Microsoft Entra Authentication Methods Report</h1>
                        <div className="header-subtitle">
                            Overview of authentication methods registered by users
                        </div>
                        <div className="author-info">
                            <span className="author-label">Generated by M365 Assessment Framework</span>
                        </div>
                    </div>
                    <div className="report-info">
                        <div className="report-org">{report.organizationName}</div>
                        <div className="report-date">
                            Generated: {new Date(report.reportDate).toLocaleDateString()}
                        </div>
                    </div>
                </div>
            </div>

            {/* Summary Statistics */}
            <div className="content-container">
                <div className="summary-stats">
                    <div className="stat-card">
                        <div className="stat-title">Total Users</div>
                        <div className="stat-value">{report.summary.totalUsers}</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-title">MFA Capable</div>
                        <div className="stat-value">{report.summary.mfaCapableUsers}</div>
                        <div className="stat-percentage">{report.summary.mfaCapablePercentage}% of users</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-title">Strong Auth</div>
                        <div className="stat-value">{report.summary.strongAuthUsers}</div>
                        <div className="stat-percentage">{report.summary.strongAuthPercentage}% of users</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-title">Passwordless</div>
                        <div className="stat-value">{report.summary.passwordlessUsers}</div>
                        <div className="stat-percentage">{report.summary.passwordlessPercentage}% of users</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-title">Mixed Auth</div>
                        <div className="stat-value">{report.summary.mixedAuthUsers}</div>
                        <div className="stat-percentage">{report.summary.mixedAuthPercentage}% of users</div>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="progress-container">
                    <div className="progress-title">Passwordless Capability Progress</div>
                    <div className="progress-bar-container">
                        <div 
                            className="progress-bar" 
                            style={{ width: `${report.summary.passwordlessPercentage}%` }}
                        >
                            <div className="progress-text">
                                {report.summary.passwordlessPercentage}% Complete
                            </div>
                        </div>
                    </div>
                    <div className="progress-info">
                        <span>Progress toward passwordless authentication</span>
                        <span>{report.summary.passwordlessUsers} of {report.summary.totalUsers} users</span>
                    </div>
                    <div className="progress-legend">
                        <div className="legend-item">
                            <div className="legend-color" style={{ backgroundColor: '#57A773' }}></div>
                            <span>{report.summary.passwordlessUsers} users passwordless capable</span>
                        </div>
                        <div className="legend-item">
                            <div className="legend-color" style={{ backgroundColor: '#e0e0e0' }}></div>
                            <span>{report.summary.totalUsers - report.summary.passwordlessUsers} users still need passwordless capability</span>
                        </div>
                    </div>
                </div>

                {/* Search and Filters */}
                <div className="search-container">
                    <input
                        type="text"
                        id="searchBox"
                        placeholder="Search by User Principal Name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="filter-container">
                    <button
                        className={`filter-button ${activeFilter === 'all' ? 'active' : ''}`}
                        onClick={() => toggleFilter('all')}
                    >
                        All Users ({report.summary.totalUsers})
                    </button>
                    <button
                        className={`filter-button ${activeFilter === 'strong' ? 'active' : ''}`}
                        onClick={() => toggleFilter('strong')}
                    >
                        Strong Auth ({report.summary.strongAuthUsers})
                    </button>
                    <button
                        className={`filter-button ${activeFilter === 'weak' ? 'active' : ''}`}
                        onClick={() => toggleFilter('weak')}
                    >
                        Weak Only
                    </button>
                    <button
                        className={`filter-button ${activeFilter === 'passwordless' ? 'active' : ''}`}
                        onClick={() => toggleFilter('passwordless')}
                    >
                        Passwordless ({report.summary.passwordlessUsers})
                    </button>
                    <button
                        className={`filter-button ${activeFilter === 'mixed' ? 'active' : ''}`}
                        onClick={() => toggleFilter('mixed')}
                    >
                        Mixed ({report.summary.mixedAuthUsers})
                    </button>
                    <button
                        className={`filter-button ${activeFilter === 'privileged' ? 'active' : ''}`}
                        onClick={() => toggleFilter('privileged')}
                    >
                        Privileged ({report.summary.privilegedUsers})
                    </button>

                    <div className="button-group">
                        <button onClick={handleExportCSV} className="export-csv-button">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                            </svg>
                            Export CSV
                        </button>
                    </div>
                </div>

                {/* Toggle Switches */}
                <div className="switches-group">
                    <div className="switch-container">
                        <div className="switch">
                            <input
                                type="checkbox"
                                id="hideDisabledSwitch"
                                checked={filters.hideDisabledMethods}
                                onChange={() => toggleSwitch('hideDisabledMethods')}
                            />
                            <span className="slider"></span>
                        </div>
                        <label htmlFor="hideDisabledSwitch" className="switch-label">
                            Hide Disabled Methods
                        </label>
                    </div>

                    <div className="switch-container">
                        <div className="switch">
                            <input
                                type="checkbox"
                                id="hideETXUsersSwitch"
                                checked={filters.hideExternalUsers}
                                onChange={() => toggleSwitch('hideExternalUsers')}
                            />
                            <span className="slider"></span>
                        </div>
                        <label htmlFor="hideETXUsersSwitch" className="switch-label">
                            Hide External Users
                        </label>
                    </div>

                    <div className="switch-container">
                        <div className="switch">
                            <input
                                type="checkbox"
                                id="hideSyncUsersSwitch"
                                checked={filters.hideSyncUsers}
                                onChange={() => toggleSwitch('hideSyncUsers')}
                            />
                            <span className="slider"></span>
                        </div>
                        <label htmlFor="hideSyncUsersSwitch" className="switch-label">
                            Hide Sync Users
                        </label>
                    </div>
                </div>

                {/* Authentication Methods Table */}
                <div className="table-container">
                    <table id="authMethodsTable">
                        <thead>
                            <tr>
                                <th>User Principal Name</th>
                                <th>Default MFA Method</th>
                                <th>MFA Capable</th>
                                <th>Passwordless Capable</th>
                                {report.authenticationMethods.map((method, index) => (
                                    <th 
                                        key={index}
                                        className={`diagonal-header ${method.strength === 'Strong' ? 'strong-method' : 'weak-method'}`}
                                        style={{
                                            display: filters.hideDisabledMethods && 
                                                     report.methodsDisabledByPolicy.some(disabled => disabled.type === method.type)
                                                     ? 'none' : ''
                                        }}
                                    >
                                        <div>{method.name}</div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map((user, userIndex) => (
                                <tr
                                    key={userIndex}
                                    data-hasstrong={user.hasStrongMethods ? 'true' : 'false'}
                                    data-weakonly={user.hasWeakMethods && !user.hasStrongMethods ? 'true' : 'false'}
                                    data-mixed={user.hasMixedMethods ? 'true' : 'false'}
                                    data-passwordless={user.isPasswordlessCapable ? 'true' : 'false'}
                                    data-mfacapable={user.isMfaCapable ? 'true' : 'false'}
                                    data-privileged={user.isPrivileged ? 'true' : 'false'}
                                    data-externaluser={user.isExternalUser ? 'true' : 'false'}
                                    data-syncuser={user.isSyncUser ? 'true' : 'false'}
                                >
                                    <td>{user.userPrincipalName}</td>
                                    <td>{user.defaultMfaMethod || '-'}</td>
                                    <td>
                                        {user.isMfaCapable ? (
                                            <span className="checkmark">✓</span>
                                        ) : (
                                            <span className="x-mark">✗</span>
                                        )}
                                    </td>
                                    <td>
                                        {user.isPasswordlessCapable ? (
                                            <span className="checkmark">✓</span>
                                        ) : (
                                            <span className="x-mark">✗</span>
                                        )}
                                    </td>
                                    {report.authenticationMethods.map((method, methodIndex) => (
                                        <td
                                            key={methodIndex}
                                            style={{
                                                display: filters.hideDisabledMethods && 
                                                         report.methodsDisabledByPolicy.some(disabled => disabled.type === method.type)
                                                         ? 'none' : ''
                                            }}
                                        >
                                            {user.methodsRegistered.includes(method.type) ? (
                                                <span className="checkmark">✓</span>
                                            ) : (
                                                <span className="x-mark">✗</span>
                                            )}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Results Count */}
                <div className="results-info">
                    Showing {filteredUsers.length} of {report.users.length} users
                    {searchTerm && ` (filtered by "${searchTerm}")`}
                    {activeFilter !== 'all' && ` (${activeFilter} filter active)`}
                </div>

                {/* Footer */}
                <div className="footer">
                    <p>Authentication Methods report generated via Microsoft Graph API | {report.organizationName}</p>
                </div>
            </div>
        </div>
    );
};

export default IdentityAccessReportComponent;
