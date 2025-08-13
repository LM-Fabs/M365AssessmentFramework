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
  // Function to identify free licenses
  const isFreeLicense = (skuPartNumber: string): boolean => {
    const freeLicenses = [
      'POWER_BI_STANDARD',
      'TEAMS_EXPLORATORY',
      'MICROSOFT_BUSINESS_CENTER',
      'FLOW_FREE',
      'POWERAPPS_VIRAL',
      'STREAM',
      'WHITEBOARD_PLAN1',
      'FORMS_PLAN_E1',
      'SWAY',
      'MCOPSTNC', // Microsoft 365 Phone System
      'TEAMS_FREE',
      'POWER_VIRTUAL_AGENTS_VIRAL'
    ];
    
    return freeLicenses.includes(skuPartNumber) || 
           skuPartNumber.toLowerCase().includes('free') ||
           skuPartNumber.toLowerCase().includes('trial') ||
           skuPartNumber.toLowerCase().includes('viral');
  };

  // Filter out free licenses for utilization calculation
  const paidLicenseDetails = licenseInfo.licenseDetails.filter(license => !isFreeLicense(license.skuPartNumber));
  const freeLicenseDetails = licenseInfo.licenseDetails.filter(license => isFreeLicense(license.skuPartNumber));
  
  // Calculate totals for paid licenses only
  const paidTotalLicenses = paidLicenseDetails.reduce((sum, license) => sum + license.totalUnits, 0);
  const paidAssignedLicenses = paidLicenseDetails.reduce((sum, license) => sum + license.assignedUnits, 0);
  const paidAvailableLicenses = paidTotalLicenses - paidAssignedLicenses;
  
  // Calculate totals for free licenses
  const freeTotalLicenses = freeLicenseDetails.reduce((sum, license) => sum + license.totalUnits, 0);
  const freeAssignedLicenses = freeLicenseDetails.reduce((sum, license) => sum + license.assignedUnits, 0);
  
  // Overall totals (for display purposes)
  const overallTotalLicenses = licenseInfo.totalLicenses;
  const overallAssignedLicenses = licenseInfo.assignedLicenses;
  const overallAvailableLicenses = licenseInfo.availableLicenses;
  
  // Utilization rate based on PAID licenses only
  const utilizationRate = paidTotalLicenses > 0 ? (paidAssignedLicenses / paidTotalLicenses) * 100 : 0;

  const getUtilizationColor = (rate: number): string => {
    if (rate >= 90) return '#28a745'; // Green - Excellent utilization (high usage is good)
    if (rate >= 80) return '#20c997'; // Teal - Good utilization
    if (rate >= 60) return '#ffc107'; // Yellow - Moderate utilization
    if (rate >= 40) return '#fd7e14'; // Orange - Fair utilization (some waste)
    return '#dc3545'; // Red - Poor utilization (significant waste)
  };

  const getUtilizationStatus = (rate: number): string => {
    if (rate >= 90) return 'Excellent - High license utilization';
    if (rate >= 80) return 'Good - Efficient license usage';
    if (rate >= 60) return 'Moderate - Acceptable utilization level';
    if (rate >= 40) return 'Fair - Some unused licenses';
    return 'Poor - Significant unused capacity, consider reducing licenses';
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
      // Free licenses have 0 cost
      if (isFreeLicense(license.skuPartNumber)) {
        return; // Skip free licenses
      }
      
      const unitCost = costMap[license.skuPartNumber] || 15; // Default €15/month for paid licenses
      totalMonthlyCost += license.assignedUnits * unitCost;
    });

    return totalMonthlyCost.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
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
              <div className="card-value">{overallTotalLicenses.toLocaleString()}</div>
              <small>{freeTotalLicenses > 0 ? `(${freeTotalLicenses.toLocaleString()} free)` : ''}</small>
            </div>
          </div>
          
          <div className="summary-card">
            <div className="card-header">
              <h3>Assigned</h3>
              <div className="card-value assigned">{overallAssignedLicenses.toLocaleString()}</div>
              <small>{freeAssignedLicenses > 0 ? `(${freeAssignedLicenses.toLocaleString()} free)` : ''}</small>
            </div>
          </div>
          
          <div className="summary-card">
            <div className="card-header">
              <h3>Available</h3>
              <div className="card-value available">{overallAvailableLicenses.toLocaleString()}</div>
            </div>
          </div>
          
          <div className="summary-card">
            <div className="card-header">
              <h3>Paid License Utilization</h3>
              <div className="card-value" style={{ color: getUtilizationColor(utilizationRate) }}>
                {utilizationRate.toFixed(1)}%
              </div>
              <small>Excludes free licenses</small>
            </div>
          </div>
        </div>

        <div className="utilization-bar">
          <div className="utilization-label">
            <span>Paid License Utilization</span>
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
          <small style={{ marginTop: '8px', display: 'block', color: '#666' }}>
            Based on {paidTotalLicenses.toLocaleString()} paid licenses ({paidAssignedLicenses.toLocaleString()} assigned)
          </small>
        </div>

        <div className="cost-estimate">
          <h4>💰 Estimated Monthly Cost (Paid Licenses): {getTotalCost()}</h4>
          <small>*Based on approximate list prices for paid licenses only. Free licenses excluded. Actual costs may vary based on your Microsoft agreement.</small>
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
                const isFree = isFreeLicense(license.skuPartNumber);
                
                return (
                  <div key={`${license.skuId}-${index}`} className={`table-row ${isFree ? 'free-license' : ''}`}>
                    <div className="col-license">
                      <div className="license-name">
                        {formatLicenseName(license.skuPartNumber)}
                        {isFree && <span className="free-badge">FREE</span>}
                      </div>
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
