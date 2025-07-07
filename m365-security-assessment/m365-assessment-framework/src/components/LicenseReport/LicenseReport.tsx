import React from 'react';
import './LicenseReport.css';

interface LicenseDetail {
  skuId: string;
  skuPartNumber: string;
  servicePlanName: string;
  totalUnits: number;
  assignedUnits: number;
  consumedUnits: number;
  capabilityStatus: string;
}

interface LicenseInfo {
  totalLicenses: number;
  assignedLicenses: number;
  availableLicenses: number;
  licenseDetails: LicenseDetail[];
  utilizationRate?: number;
  summary?: string;
}

interface LicenseReportProps {
  licenseInfo: LicenseInfo;
  tenantName?: string;
  assessmentDate?: string;
}

export const LicenseReport: React.FC<LicenseReportProps> = ({
  licenseInfo,
  tenantName,
  assessmentDate
}) => {
  const utilizationRate = licenseInfo.utilizationRate || 
    (licenseInfo.totalLicenses > 0 ? (licenseInfo.assignedLicenses / licenseInfo.totalLicenses) * 100 : 0);

  const getUtilizationColor = (rate: number): string => {
    if (rate >= 90) return '#dc3545'; // Red - Very high usage
    if (rate >= 80) return '#fd7e14'; // Orange - High usage  
    if (rate >= 60) return '#ffc107'; // Yellow - Moderate usage
    if (rate >= 40) return '#20c997'; // Teal - Good usage
    return '#6c757d'; // Gray - Low usage
  };

  const getUtilizationStatus = (rate: number): string => {
    if (rate >= 90) return 'Critical - Consider purchasing additional licenses';
    if (rate >= 80) return 'High - Monitor closely for capacity planning';
    if (rate >= 60) return 'Moderate - Good utilization level';
    if (rate >= 40) return 'Fair - Room for optimization';
    return 'Low - Significant unused capacity';
  };

  const getLicenseCategory = (skuPartNumber: string): string => {
    if (skuPartNumber.includes('E5') || skuPartNumber.includes('PREMIUM')) return 'Premium';
    if (skuPartNumber.includes('E3') || skuPartNumber.includes('STANDARD')) return 'Standard';
    if (skuPartNumber.includes('E1') || skuPartNumber.includes('BASIC')) return 'Basic';
    if (skuPartNumber.includes('F1') || skuPartNumber.includes('FIRSTLINE')) return 'Frontline';
    return 'Other';
  };

  const formatLicenseName = (skuPartNumber: string): string => {
    // Common Microsoft 365 license mappings
    const licenseNames: { [key: string]: string } = {
      'SPE_E5': 'Microsoft 365 E5',
      'SPE_E3': 'Microsoft 365 E3',
      'SPE_E1': 'Microsoft 365 E1',
      'ENTERPRISEPACK': 'Office 365 E3',
      'ENTERPRISEPREMIUM': 'Office 365 E5',
      'STANDARDPACK': 'Office 365 E1',
      'DESKLESSPACK': 'Microsoft 365 F1',
      'SPE_F1': 'Microsoft 365 F3',
      'TEAMS_EXPLORATORY': 'Microsoft Teams Exploratory',
      'POWER_BI_STANDARD': 'Power BI (free)',
      'POWER_BI_PRO': 'Power BI Pro',
      'PROJECT_PROFESSIONAL': 'Project Plan 3',
      'VISIO_PLAN2_DEPT': 'Visio Plan 2'
    };

    return licenseNames[skuPartNumber] || skuPartNumber.replace(/_/g, ' ');
  };

  const getTotalCost = (): string => {
    // Approximate cost calculation (actual costs vary by agreement)
    const costMap: { [key: string]: number } = {
      'SPE_E5': 57, 'SPE_E3': 36, 'SPE_E1': 12,
      'ENTERPRISEPACK': 23, 'ENTERPRISEPREMIUM': 35,
      'STANDARDPACK': 8, 'DESKLESSPACK': 4,
      'SPE_F1': 8, 'POWER_BI_PRO': 10
    };

    let totalMonthlyCost = 0;
    licenseInfo.licenseDetails.forEach(license => {
      const unitCost = costMap[license.skuPartNumber] || 15; // Default $15/month
      totalMonthlyCost += license.assignedUnits * unitCost;
    });

    return totalMonthlyCost.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  };

  const groupedLicenses = licenseInfo.licenseDetails.reduce((groups, license) => {
    const category = getLicenseCategory(license.skuPartNumber);
    if (!groups[category]) groups[category] = [];
    groups[category].push(license);
    return groups;
  }, {} as { [key: string]: LicenseDetail[] });

  return (
    <div className="license-report">
      <div className="license-report-header">
        <h2>📊 License Usage Report</h2>
        {tenantName && <div className="tenant-info">Tenant: {tenantName}</div>}
        {assessmentDate && <div className="assessment-date">Assessment Date: {new Date(assessmentDate).toLocaleDateString()}</div>}
      </div>

      {/* Executive Summary */}
      <div className="license-summary">
        <div className="summary-cards">
          <div className="summary-card">
            <div className="card-header">
              <h3>Total Licenses</h3>
              <div className="card-value">{licenseInfo.totalLicenses.toLocaleString()}</div>
            </div>
          </div>
          
          <div className="summary-card">
            <div className="card-header">
              <h3>Assigned</h3>
              <div className="card-value assigned">{licenseInfo.assignedLicenses.toLocaleString()}</div>
            </div>
          </div>
          
          <div className="summary-card">
            <div className="card-header">
              <h3>Available</h3>
              <div className="card-value available">{licenseInfo.availableLicenses.toLocaleString()}</div>
            </div>
          </div>
          
          <div className="summary-card">
            <div className="card-header">
              <h3>Utilization</h3>
              <div className="card-value" style={{ color: getUtilizationColor(utilizationRate) }}>
                {utilizationRate.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>

        <div className="utilization-bar">
          <div className="utilization-label">
            <span>License Utilization</span>
            <span className="utilization-status">{getUtilizationStatus(utilizationRate)}</span>
          </div>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ 
                width: `${Math.min(utilizationRate, 100)}%`,
                backgroundColor: getUtilizationColor(utilizationRate)
              }}
            />
          </div>
        </div>

        <div className="cost-estimate">
          <h4>💰 Estimated Monthly Cost: {getTotalCost()}</h4>
          <small>*Based on approximate list prices. Actual costs may vary based on your Microsoft agreement.</small>
        </div>
      </div>

      {/* Detailed License Breakdown */}
      <div className="license-details">
        <h3>License Breakdown by Category</h3>
        
        {Object.entries(groupedLicenses).map(([category, licenses]) => (
          <div key={category} className="license-category">
            <h4 className={`category-header ${category.toLowerCase()}`}>{category} Licenses</h4>
            
            <div className="license-table">
              <div className="table-header">
                <div className="col-license">License Type</div>
                <div className="col-total">Total</div>
                <div className="col-assigned">Assigned</div>
                <div className="col-available">Available</div>
                <div className="col-utilization">Utilization</div>
                <div className="col-status">Status</div>
              </div>
              
              {licenses.map((license, index) => {
                const licenseUtilization = license.totalUnits > 0 
                  ? (license.assignedUnits / license.totalUnits) * 100 
                  : 0;
                
                return (
                  <div key={`${license.skuId}-${index}`} className="table-row">
                    <div className="col-license">
                      <div className="license-name">{formatLicenseName(license.skuPartNumber)}</div>
                      <div className="license-sku">{license.skuPartNumber}</div>
                    </div>
                    <div className="col-total">{license.totalUnits.toLocaleString()}</div>
                    <div className="col-assigned">{license.assignedUnits.toLocaleString()}</div>
                    <div className="col-available">{(license.totalUnits - license.assignedUnits).toLocaleString()}</div>
                    <div className="col-utilization">
                      <div className="utilization-cell">
                        <span style={{ color: getUtilizationColor(licenseUtilization) }}>
                          {licenseUtilization.toFixed(1)}%
                        </span>
                        <div className="mini-progress">
                          <div 
                            className="mini-progress-fill"
                            style={{ 
                              width: `${Math.min(licenseUtilization, 100)}%`,
                              backgroundColor: getUtilizationColor(licenseUtilization)
                            }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="col-status">
                      <span className={`status-badge ${license.capabilityStatus.toLowerCase()}`}>
                        {license.capabilityStatus}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Recommendations */}
      <div className="license-recommendations">
        <h3>💡 Recommendations</h3>
        <div className="recommendations-list">
          {utilizationRate < 40 && (
            <div className="recommendation low-usage">
              <div className="rec-icon">⚠️</div>
              <div className="rec-content">
                <strong>Low License Utilization:</strong> Consider reducing unused licenses to optimize costs. 
                Current utilization is {utilizationRate.toFixed(1)}%.
              </div>
            </div>
          )}
          
          {utilizationRate > 90 && (
            <div className="recommendation high-usage">
              <div className="rec-icon">🚨</div>
              <div className="rec-content">
                <strong>High License Utilization:</strong> Consider purchasing additional licenses to avoid service disruptions. 
                Current utilization is {utilizationRate.toFixed(1)}%.
              </div>
            </div>
          )}
          
          {utilizationRate >= 60 && utilizationRate <= 80 && (
            <div className="recommendation optimal">
              <div className="rec-icon">✅</div>
              <div className="rec-content">
                <strong>Optimal Utilization:</strong> Your license utilization is at a healthy level ({utilizationRate.toFixed(1)}%). 
                Continue monitoring for future capacity planning.
              </div>
            </div>
          )}

          <div className="recommendation general">
            <div className="rec-icon">📋</div>
            <div className="rec-content">
              <strong>Regular Review:</strong> Conduct monthly license reviews to identify unused licenses and plan for growth.
            </div>
          </div>

          <div className="recommendation security">
            <div className="rec-icon">🛡️</div>
            <div className="rec-content">
              <strong>Security Features:</strong> Ensure you're leveraging security features included in your premium licenses 
              like Conditional Access and Advanced Threat Protection.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LicenseReport;
