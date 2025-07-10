import React, { useState, useEffect } from 'react';
import { useCustomer } from '../contexts/CustomerContext';
import { Customer, CustomerService } from '../services/customerService';
import { AssessmentService } from '../services/assessmentService';
import './Reports.css';

interface SecurityCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
}

interface ReportData {
  category: string;
  metrics: any;
  charts: any[];
  insights: string[];
  recommendations: string[];
}

const Reports: React.FC = () => {
  const { selectedCustomer, setSelectedCustomer } = useCustomer();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [activeTab, setActiveTab] = useState<string>('license');
  const [customerAssessment, setCustomerAssessment] = useState<any>(null);
  const [reportData, setReportData] = useState<ReportData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creatingAssessment, setCreatingAssessment] = useState(false);
  const [createAssessmentResult, setCreateAssessmentResult] = useState<string | null>(null);
  
  // Function to format license names for better readability
  const formatLicenseName = (rawName: string): string => {
    if (!rawName) return 'Unknown License';
    
    // Common license name mappings for better readability
    const nameMap: { [key: string]: string } = {
      'MICROSOFT_365_E3': 'Microsoft 365 E3',
      'MICROSOFT_365_E5': 'Microsoft 365 E5',
      'MICROSOFT_365_F3': 'Microsoft 365 F3',
      'MICROSOFT_365_F1': 'Microsoft 365 F1',
      'OFFICE_365_E3': 'Office 365 E3',
      'OFFICE_365_E5': 'Office 365 E5',
      'OFFICE_365_F3': 'Office 365 F3',
      'ENTERPRISEPACK': 'Office 365 E3',
      'ENTERPRISEPREMIUM': 'Office 365 E5',
      'DESKLESSPACK': 'Office 365 F3',
      'SPE_E3': 'Microsoft 365 E3',
      'SPE_E5': 'Microsoft 365 E5',
      'SPE_F1': 'Microsoft 365 F1',
      'POWER_BI_PRO': 'Power BI Pro',
      'POWER_BI_PREMIUM': 'Power BI Premium',
      'TEAMS_EXPLORATORY': 'Microsoft Teams Exploratory',
      'AAD_PREMIUM': 'Azure Active Directory Premium',
      'AAD_PREMIUM_P2': 'Azure Active Directory Premium P2',
      'EXCHANGE_S_ENTERPRISE': 'Exchange Online Plan 2',
      'EXCHANGE_S_STANDARD': 'Exchange Online Plan 1',
      'PROJECTPROFESSIONAL': 'Project Online Professional',
      'VISIOONLINE_PLAN1': 'Visio Online Plan 1',
      'VISIOCLIENT': 'Visio Pro for Office 365'
    };
    
    // Check if we have a direct mapping
    if (nameMap[rawName.toUpperCase()]) {
      return nameMap[rawName.toUpperCase()];
    }
    
    // Otherwise, clean up the name
    return rawName
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };
  
  // Utility: Test assessment creation for debugging API/store
  const handleTestCreateAssessment = async () => {
    setCreatingAssessment(true);
    setCreateAssessmentResult(null);
    setError(null);
    try {
      if (!selectedCustomer) {
        setCreateAssessmentResult('No customer selected.');
        setCreatingAssessment(false);
        return;
      }
      const assessment = await AssessmentService.getInstance().createAssessmentForCustomer({
        customerId: selectedCustomer.id,
        tenantId: selectedCustomer.tenantId,
        assessmentName: `Test Assessment ${new Date().toISOString()}`,
        includedCategories: ['license', 'secureScore'],
        notificationEmail: '', // No email property on Customer, use empty string
        autoSchedule: false,
        scheduleFrequency: 'monthly',
      });
      setCreateAssessmentResult(`Assessment created: ${assessment.id || JSON.stringify(assessment)}`);
      // Optionally reload assessments
      await loadCustomerAssessment();
    } catch (err: any) {
      setCreateAssessmentResult('Error creating assessment: ' + (err?.message || err?.toString()));
      setError('Error creating assessment: ' + (err?.message || err?.toString()));
    } finally {
      setCreatingAssessment(false);
    }
  };

  const securityCategories: SecurityCategory[] = [
    {
      id: 'error',
      name: 'Assessment Issues',
      icon: '⚠️',
      description: 'Data collection issues and troubleshooting steps'
    },
    {
      id: 'license',
      name: 'License Management',
      icon: '📊',
      description: 'License utilization, costs, and optimization opportunities'
    },
    {
      id: 'secureScore',
      name: 'Secure Score',
      icon: '🛡️',
      description: 'Security posture analysis and improvement recommendations'
    },
    {
      id: 'identity',
      name: 'Identity & Access',
      icon: '👤',
      description: 'User management, MFA coverage, and access policies'
    },
    {
      id: 'dataProtection',
      name: 'Data Protection',
      icon: '🔒',
      description: 'DLP policies, encryption, and data governance'
    },
    {
      id: 'compliance',
      name: 'Compliance',
      icon: '📋',
      description: 'Regulatory compliance status and audit readiness'
    }
  ];

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    if (selectedCustomer) {
      loadCustomerAssessment();
    }
  }, [selectedCustomer]);

  const loadCustomers = async () => {
    try {
      const customersData = await CustomerService.getInstance().getCustomers();
      setCustomers(customersData);
    } catch (error) {
      console.error('Error loading customers:', error);
      setError('Failed to load customers');
    }
  };

  const loadCustomerAssessment = async () => {
    if (!selectedCustomer) return;

    setLoading(true);
    setError(null);

    try {
      // Get all assessments
      const assessments: any[] = await AssessmentService.getInstance().getAssessments();
      
      // Filter for assessments belonging to this customer
      // TEMPORARILY ALLOW TEST ASSESSMENTS for debugging - in production, filter them out
      const customerAssessments = assessments.filter((a: any) =>
        a.tenantId === selectedCustomer.tenantId &&
        (a.date || a.assessmentDate || a.lastModified)
        // Temporarily commenting out test assessment filter to see the secure score data
        // && !a.assessmentName?.includes('Test Assessment') 
        // && !a.assessmentName?.includes('Debug')
        // && !a.assessmentName?.toLowerCase().includes('test')
        // && !a.assessmentName?.toLowerCase().includes('debug')
      );

      if (customerAssessments.length === 0) {
        setError('No assessments found for this customer.');
        setCustomerAssessment(null);
        setReportData([]);
        return;
      }

      console.log(`Found ${customerAssessments.length} assessments for customer after filtering`);
      console.log('Assessment IDs:', customerAssessments.map(a => a.id));
      console.log('Assessment names:', customerAssessments.map(a => a.assessmentName || 'unnamed'));

      // Categorize assessments by status and data quality
      const validAssessments = customerAssessments.filter((a: any) => 
        a.status === 'completed' && 
        a.metrics && 
        typeof a.metrics === 'object' &&
        !a.metrics.error &&
        (a.metrics.realData || a.metrics.score) // Accept assessments with real data or basic score
      );

      const errorAssessments = customerAssessments.filter((a: any) => 
        a.status === 'completed_with_size_limit' || 
        (a.metrics && a.metrics.error) ||
        (a.metrics && a.metrics.dataIssue && !a.metrics.realData)
      );

      const apiFailureAssessments = customerAssessments.filter((a: any) => 
        a.metrics && a.metrics.dataIssue && a.metrics.dataIssue.reason
      );

      console.log(`Assessment breakdown: ${validAssessments.length} valid, ${errorAssessments.length} with errors, ${apiFailureAssessments.length} with API failures`);

      let latestAssessment: any = null;

      if (validAssessments.length > 0) {
        // Use the most recent valid assessment - sort by date descending
        latestAssessment = validAssessments.sort((a: any, b: any) => {
          const dateA = new Date(a.date || a.assessmentDate || a.lastModified || 0).getTime();
          const dateB = new Date(b.date || b.assessmentDate || b.lastModified || 0).getTime();
          return dateB - dateA; // Most recent first
        })[0];
        
        console.log('✅ Selected most recent valid assessment:', latestAssessment.id, 'from', latestAssessment.date || latestAssessment.assessmentDate);
      } else if (errorAssessments.length > 0) {
        // Show the most recent assessment even if it has issues, with appropriate error message
        const recentErrorAssessment = errorAssessments.sort((a: any, b: any) =>
          new Date(b.date || b.assessmentDate || b.lastModified || 0).getTime() -
          new Date(a.date || a.assessmentDate || a.lastModified || 0).getTime()
        )[0];

        let errorMessage = 'Assessment data has issues: ';
        if (recentErrorAssessment.status === 'completed_with_size_limit') {
          errorMessage += 'Data was too large to store completely. ';
        }
        if (recentErrorAssessment.metrics?.dataIssue) {
          errorMessage += recentErrorAssessment.metrics.dataIssue.reason || 'Graph API access failed. ';
        }
        if (recentErrorAssessment.metrics?.error) {
          errorMessage += 'Storage error occurred. ';
        }
        errorMessage += `Found ${customerAssessments.length} total assessments for this customer.`;
        
        setError(errorMessage);
        setCustomerAssessment(recentErrorAssessment);
        setReportData([]);
        return;
      } else {
        setError(`Found ${customerAssessments.length} assessments but none have valid data. This may indicate API authentication issues.`);
        setCustomerAssessment(null);
        setReportData([]);
        return;
      }

      // Set assessment date for consistency
      if (!latestAssessment.assessmentDate) {
        latestAssessment.assessmentDate = latestAssessment.date || latestAssessment.lastModified;
      }

      setCustomerAssessment(latestAssessment);
      generateReportData(latestAssessment);

    } catch (error) {
      console.error('Error loading customer assessment:', error);
      setError('Failed to load customer assessment data');
    } finally {
      setLoading(false);
    }
  };

  const generateReportData = (assessment: any) => {
    console.log('=== GENERATING REPORT DATA ===');
    console.log('Full assessment object:', assessment);
    console.log('Assessment metrics:', assessment.metrics);
    console.log('Assessment realData:', assessment.metrics?.realData);
    
    const reports: ReportData[] = [];

    // Check if assessment has data issues
    if (assessment.metrics?.error || assessment.metrics?.dataIssue) {
      const errorReport: ReportData = {
        category: 'error',
        metrics: {
          hasError: true,
          errorMessage: assessment.metrics.error || assessment.metrics.dataIssue?.reason || 'Unknown error',
          troubleshooting: assessment.metrics.dataIssue?.troubleshooting || [],
          assessmentDate: assessment.date || assessment.assessmentDate
        },
        charts: [],
        insights: [
          assessment.metrics.dataIssue?.reason || 'Assessment encountered an error during data collection',
          'This may be due to authentication issues or missing permissions',
          'Please check the troubleshooting steps below'
        ],
        recommendations: assessment.metrics.dataIssue?.troubleshooting || [
          'Verify app registration credentials',
          'Ensure admin consent is granted',
          'Check required permissions are configured'
        ]
      };
      reports.push(errorReport);
      setReportData(reports);
      return;
    }

    // License Management Report
    const licenseInfo =
      assessment.metrics?.realData?.licenseInfo ||
      assessment.metrics?.license ||
      assessment.metrics?.licenses;

    if (licenseInfo && (Array.isArray(licenseInfo) ? licenseInfo.length > 0 : typeof licenseInfo === 'object')) {
      const info = Array.isArray(licenseInfo) ? licenseInfo[0] : licenseInfo;
      if (info && typeof info === 'object' && (info.totalLicenses !== undefined || info.assignedLicenses !== undefined)) {
        const totalLicenses = Number(info.totalLicenses) || 0;
        const assignedLicenses = Number(info.assignedLicenses) || 0;
        const utilizationRate = info.utilizationRate !== undefined
          ? Number(info.utilizationRate)
          : (totalLicenses > 0 ? (assignedLicenses / totalLicenses) * 100 : 0);

        // Process license details from the API response structure
        const licenseDetails = info.licenseDetails || [];
        console.log('Processing license details:', licenseDetails);

        // Group license details by SKU and sum up the values
        const licenseTypeMap = new Map<string, { name: string; assigned: number; total: number }>();
        
        licenseDetails.forEach((license: any) => {
          const skuName = license.skuPartNumber || license.skuDisplayName || license.servicePlanName || 'Unknown License';
          const assignedUnits = Number(license.assignedUnits) || 0;
          const totalUnits = Number(license.totalUnits) || 0;
          
          console.log(`Processing license: ${skuName}, assigned: ${assignedUnits}, total: ${totalUnits}`);
          
          if (licenseTypeMap.has(skuName)) {
            const existing = licenseTypeMap.get(skuName)!;
            existing.assigned += assignedUnits;
            existing.total += totalUnits;
          } else {
            licenseTypeMap.set(skuName, {
              name: skuName,
              assigned: assignedUnits,
              total: totalUnits
            });
          }
        });

        // Convert to array and filter out licenses with 0 assigned
        const processedLicenseTypes = Array.from(licenseTypeMap.values())
          .filter(license => license.assigned > 0)
          .sort((a, b) => b.assigned - a.assigned)
          .slice(0, 10); // Show top 10 license types

        console.log('Processed license types:', processedLicenseTypes);

        reports.push({
          category: 'license',
          metrics: {
            totalLicenses,
            assignedLicenses,
            unutilizedLicenses: totalLicenses - assignedLicenses,
            utilizationRate: Math.round(utilizationRate),
            costData: info.costData || null,
            licenseTypes: processedLicenseTypes,
            summary: info.summary || `${assignedLicenses} of ${totalLicenses} licenses assigned (${Math.round(utilizationRate)}% utilization)`
          },
          charts: [], // No charts needed - we use table view
          insights: [
            `License utilization is at ${Math.round(utilizationRate)}%`,
            `${totalLicenses - assignedLicenses} licenses are currently unused`,
            utilizationRate < 60 ? 'Consider optimizing license allocation to reduce costs' : 'License utilization is within acceptable range',
            `Top license type: ${processedLicenseTypes[0] ? formatLicenseName(processedLicenseTypes[0].name) : 'None'} with ${processedLicenseTypes[0]?.assigned || 0} assignments`
          ],
          recommendations: [
            utilizationRate < 60 ? 'Review and reallocate unused licenses' : 'Monitor for capacity planning',
            'Implement regular license usage reviews',
            'Consider upgrading high-usage users to premium licenses'
          ]
        });
      }
    }

    // Secure Score Report
    const secureScore = assessment.metrics?.realData?.secureScore || assessment.metrics?.secureScore;
    console.log('=== SECURE SCORE PROCESSING ===');
    console.log('Secure score raw data:', secureScore);
    console.log('Secure score type:', typeof secureScore);
    console.log('Has currentScore:', secureScore?.currentScore !== undefined);
    console.log('Has maxScore:', secureScore?.maxScore !== undefined);
    console.log('Has improvementActions:', secureScore?.improvementActions);
    console.log('Is unavailable:', secureScore?.unavailable);
    console.log('Assessment date:', assessment.date || assessment.assessmentDate);
    console.log('Assessment ID:', assessment.id);
    
    if (secureScore && typeof secureScore === 'object' && !secureScore.unavailable && (secureScore.currentScore !== undefined || secureScore.maxScore !== undefined)) {
      console.log('=== SECURE SCORE FOUND - PROCESSING ===');
      const currentScore = Number(secureScore.currentScore) || 0;
      const maxScore = Number(secureScore.maxScore) || 100;
      const percentage = secureScore.percentage || (maxScore > 0 ? Math.round((currentScore / maxScore) * 100) : 0);
      
      console.log('Processed scores:', { currentScore, maxScore, percentage });
      
      // Process control scores from the API response (not improvementActions)
      const controlScores = (secureScore.controlScores || []).map((control: any, index: number) => ({
        controlName: control.controlName || `Security Control ${index + 1}`,
        category: control.category || 'General',
        currentScore: Number(control.currentScore) || 0,
        maxScore: Number(control.maxScore) || 0,
        implementationStatus: control.implementationStatus || 'Not Implemented',
        scoreGap: Number(control.maxScore || 0) - Number(control.currentScore || 0)
      }));
      
      console.log('Processed control scores count:', controlScores.length);
      
      // Calculate summary metrics
      const totalImplemented = controlScores.filter((c: any) => c.implementationStatus === 'Implemented' || c.currentScore > 0).length;
      const totalControls = controlScores.length;
      const controlsRemaining = totalControls - totalImplemented;
      const potentialScoreIncrease = controlScores.reduce((sum: number, control: any) => sum + control.scoreGap, 0);
      
      console.log('=== ADDING SECURE SCORE REPORT ===');
      console.log('Report object to be added:', {
        category: 'secureScore',
        metricsKeys: Object.keys({
          currentScore,
          maxScore,
          percentage,
          controlsImplemented: totalImplemented,
          totalControls,
          controlsRemaining,
          controlScores: controlScores.slice(0, 20),
          potentialScoreIncrease,
          averageControlScore: totalControls > 0 ? Math.round(controlScores.reduce((sum: number, control: any) => sum + control.currentScore, 0) / totalControls) : 0,
          implementationRate: totalControls > 0 ? Math.round((totalImplemented / totalControls) * 100) : 0
        })
      });
      
      reports.push({
        category: 'secureScore',
        metrics: {
          currentScore,
          maxScore,
          percentage,
          controlsImplemented: totalImplemented,
          totalControls,
          controlsRemaining,
          controlScores: controlScores.slice(0, 20), // Show top 20 controls
          potentialScoreIncrease,
          averageControlScore: totalControls > 0 ? Math.round(controlScores.reduce((sum: number, control: any) => sum + control.currentScore, 0) / totalControls) : 0,
          implementationRate: totalControls > 0 ? Math.round((totalImplemented / totalControls) * 100) : 0
        },
        charts: [], // No charts needed - we use table view
        insights: [
          `Current secure score: ${currentScore} out of ${maxScore} points (${percentage}%)`,
          `${totalImplemented} out of ${totalControls} security controls are implemented`,
          `${controlsRemaining} security controls remaining to implement`,
          `Potential score increase: ${potentialScoreIncrease.toFixed(1)} points available`,
          percentage < 40 ? 'Security posture needs immediate attention' : 
          percentage < 70 ? 'Security posture needs significant improvement' : 
          percentage < 85 ? 'Good security posture with room for improvement' : 
          'Excellent security posture - maintain current practices'
        ],
        recommendations: [
          'Focus on high-impact security controls first',
          'Prioritize controls with low implementation complexity',
          'Implement Multi-Factor Authentication for all users',
          'Enable Conditional Access policies',
          'Configure security defaults and advanced threat protection',
          'Regularly review and update security settings'
        ]
      });
    } else {
      console.log('=== NO SECURE SCORE DATA FOUND ===');
      console.log('Secure score object:', secureScore);
    }

    // Identity & Access Report
    const identityMetrics = assessment.metrics?.realData?.identityMetrics || assessment.metrics?.identityMetrics || {};
    if (
      identityMetrics &&
      (identityMetrics.totalUsers !== undefined || identityMetrics.mfaEnabledUsers !== undefined || identityMetrics.adminUsers !== undefined)
    ) {
      const totalUsers = Number(identityMetrics.totalUsers) || 0;
      const mfaEnabledUsers = Number(identityMetrics.mfaEnabledUsers) || 0;
      const mfaDisabledUsers = totalUsers - mfaEnabledUsers;
      const mfaCoverage = identityMetrics.mfaCoverage !== undefined ? Number(identityMetrics.mfaCoverage) : (totalUsers > 0 ? Math.round((mfaEnabledUsers / totalUsers) * 100) : 0);
      const adminUsers = Number(identityMetrics.adminUsers) || 0;
      const guestUsers = Number(identityMetrics.guestUsers) || 0;
      const regularUsers = totalUsers - adminUsers - guestUsers;
      const conditionalAccessPolicies = Number(identityMetrics.conditionalAccessPolicies) || 0;
      
      // Create user breakdown data for table
      const userBreakdown = [
        { type: 'Regular Users', count: regularUsers, percentage: totalUsers > 0 ? Math.round((regularUsers / totalUsers) * 100) : 0, risk: 'Low' },
        { type: 'Admin Users', count: adminUsers, percentage: totalUsers > 0 ? Math.round((adminUsers / totalUsers) * 100) : 0, risk: 'High' },
        { type: 'Guest Users', count: guestUsers, percentage: totalUsers > 0 ? Math.round((guestUsers / totalUsers) * 100) : 0, risk: 'Medium' }
      ];
      
      reports.push({
        category: 'identity',
        metrics: {
          totalUsers,
          mfaEnabledUsers,
          mfaDisabledUsers,
          mfaCoverage,
          adminUsers,
          guestUsers,
          regularUsers,
          conditionalAccessPolicies,
          userBreakdown,
          mfaGap: mfaDisabledUsers,
          securityRisk: mfaCoverage < 50 ? 'High' : mfaCoverage < 80 ? 'Medium' : 'Low'
        },
        charts: [], // No charts needed - we use table view
        insights: [
          `${mfaCoverage}% of users have MFA enabled (${mfaEnabledUsers} out of ${totalUsers} users)`,
          `${mfaDisabledUsers} users are at risk due to missing MFA protection`,
          `${adminUsers} admin users require special attention and should have MFA enabled`,
          `${conditionalAccessPolicies} conditional access policies are configured`,
          `${guestUsers} guest users need regular access review`
        ],
        recommendations: [
          'Enable MFA for all users, especially administrators',
          'Implement conditional access policies for high-risk scenarios',
          'Regularly review admin user permissions and access',
          'Monitor and audit guest user access quarterly',
          'Consider implementing privileged identity management (PIM)',
          'Enforce strong password policies'
        ]
      });
    }

    console.log('=== FINAL REPORTS ARRAY ===');
    console.log('Reports generated:', reports.length);
    console.log('Report categories:', reports.map(r => r.category));
    setReportData(reports);
  };

  // REMOVED: generateFallbackData (no more mockup/fallback data)

  const getCurrentTabData = () => {
    const tabData = reportData.find(report => report.category === activeTab);
    console.log('=== GET CURRENT TAB DATA ===');
    console.log('Active tab:', activeTab);
    console.log('Available report categories:', reportData.map(r => r.category));
    console.log('Found tab data:', tabData ? 'YES' : 'NO');
    if (tabData) {
      console.log('Tab data metrics keys:', Object.keys(tabData.metrics));
      if (activeTab === 'secureScore') {
        console.log('Secure score tab data:', tabData.metrics);
      }
    }
    return tabData;
  };

  const renderChart = (chart: any) => {
    switch (chart.type) {
      case 'donut':
        return (
          <div className="chart-container donut-chart">
            <h4>{chart.title}</h4>
            <div className="donut-visual">
              {chart.data.map((item: any, index: number) => (
                <div key={index} className="donut-segment" style={{ color: item.color }}>
                  <span className="segment-value">{item.value}</span>
                  <span className="segment-label">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        );
      
      case 'bar':
        return (
          <div className="chart-container bar-chart">
            <h4>{chart.title}</h4>
            <div className="bar-visual">
              {chart.data.map((item: any, index: number) => (
                <div key={index} className="bar-item">
                  <div className="bar-label">{item.label}</div>
                  <div className="bar-container">
                    <div 
                      className="bar-fill" 
                      style={{ 
                        width: `${(item.value / Math.max(...chart.data.map((d: any) => d.value))) * 100}%`,
                        backgroundColor: item.color 
                      }}
                    >
                      <span className="bar-value">{item.value}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      
      case 'gauge':
        return (
          <div className="chart-container gauge-chart">
            <h4>{chart.title}</h4>
            <div className="gauge-visual">
              <div className="gauge-meter">
                <div 
                  className="gauge-fill" 
                  style={{ 
                    transform: `rotate(${(chart.data.percentage / 100) * 180}deg)` 
                  }}
                />
                <div className="gauge-center">
                  <span className="gauge-value">{chart.data.current}</span>
                  <span className="gauge-max">/ {chart.data.max}</span>
                </div>
              </div>
              <div className="gauge-percentage">{chart.data.percentage}%</div>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  const renderLicenseTable = (licenseTypes: any[]) => {
    if (!licenseTypes || licenseTypes.length === 0) {
      return (
        <div className="no-license-data">
          <p>No license data available</p>
        </div>
      );
    }

    return (
      <div className="license-table-container">
        <h4>License Details</h4>
        <div className="license-table-wrapper">
          <table className="license-table">
            <thead>
              <tr>
                <th>License Type</th>
                <th>Used</th>
                <th>Free</th>
                <th>Total</th>
                <th>Utilization</th>
              </tr>
            </thead>
            <tbody>
              {licenseTypes.map((license, index) => {
                const free = license.total - license.assigned;
                const utilization = license.total > 0 ? Math.round((license.assigned / license.total) * 100) : 0;
                return (
                  <tr key={index}>
                    <td className="license-name-cell">
                      <span className="license-name-text">
                        {formatLicenseName(license.name)}
                      </span>
                    </td>
                    <td className="used-cell">{license.assigned.toLocaleString()}</td>
                    <td className="free-cell">{free.toLocaleString()}</td>
                    <td className="total-cell">{license.total.toLocaleString()}</td>
                    <td className="utilization-cell">
                      <div className="utilization-bar-container">
                        <div 
                          className="utilization-bar-fill" 
                          style={{ 
                            width: `${utilization}%`,
                            backgroundColor: utilization >= 80 ? '#dc3545' : utilization >= 60 ? '#fd7e14' : '#28a745'
                          }}
                        />
                        <span className="utilization-text">{utilization}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderSecureScoreTable = (metrics: any) => {
    console.log('=== RENDER SECURE SCORE TABLE ===');
    console.log('Metrics received:', metrics);
    console.log('Metrics type:', typeof metrics);
    console.log('Has currentScore:', metrics?.currentScore !== undefined);
    console.log('currentScore value:', metrics?.currentScore);
    
    if (!metrics || metrics.currentScore === undefined) {
      return (
        <div className="no-secure-score-data">
          <h4>🛡️ Secure Score Data Not Available</h4>
          <p>The secure score data could not be retrieved for this assessment.</p>
          <div className="permission-guidance">
            <h5>🔍 Common reasons:</h5>
            <ul>
              <li>This assessment was created before the <strong>SecurityEvents.Read.All</strong> permission was granted</li>
              <li>Admin consent was not available when this assessment was created</li>
              <li>The assessment is from an older version that didn't support secure score</li>
            </ul>
            <h5>🔧 Quick fix:</h5>
            <ol>
              <li>Click the <strong>"Create Test Assessment (Debug)"</strong> button above to create a new assessment</li>
              <li>The new assessment should include secure score data if permissions are correctly configured</li>
              <li>If the new assessment still doesn't work, then check the app registration permissions</li>
            </ol>
            <div className="technical-note">
              <strong>Note:</strong> Since you mentioned the "Create Test Assessment (Debug)" function is working and showing actual secure score data, the permissions are correctly configured. You likely need to create a new assessment to see the secure score data.
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="secure-score-container">
        {/* Score Overview */}
        <div className="score-overview">
          <h4>Security Score Overview</h4>
          <div className="score-metrics">
            <div className="score-metric">
              <span className="metric-label">Current Score</span>
              <span className="metric-value">{metrics.currentScore || 0}</span>
            </div>
            <div className="score-metric">
              <span className="metric-label">Maximum Score</span>
              <span className="metric-value">{metrics.maxScore || 100}</span>
            </div>
            <div className="score-metric">
              <span className="metric-label">Percentage</span>
              <span className="metric-value">{metrics.percentage || 0}%</span>
            </div>
            <div className="score-metric">
              <span className="metric-label">Controls Implemented</span>
              <span className="metric-value">{metrics.controlsImplemented || 0}</span>
            </div>
            <div className="score-metric">
              <span className="metric-label">Total Controls</span>
              <span className="metric-value">{metrics.totalControls || 0}</span>
            </div>
            <div className="score-metric">
              <span className="metric-label">Potential Increase</span>
              <span className="metric-value">+{metrics.potentialScoreIncrease || 0}</span>
            </div>
          </div>
        </div>

        {/* Security Controls Table */}
        <div className="security-controls-table">
          <h4>Security Controls Breakdown</h4>
          {metrics.controlScores && metrics.controlScores.length > 0 ? (
            <div className="table-wrapper">
              <table className="secure-score-table">
                <thead>
                  <tr>
                    <th>Control Name</th>
                    <th>Category</th>
                    <th>Current Score</th>
                    <th>Max Score</th>
                    <th>Gap</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.controlScores.map((control: any, index: number) => (
                    <tr key={index} className={control.implementationStatus === 'Not Implemented' ? 'not-implemented' : 'implemented'}>
                      <td className="control-name-cell">
                        <div className="control-name">{control.controlName}</div>
                      </td>
                      <td className="category-cell">
                        <span className={`category-badge ${control.category.toLowerCase()}`}>
                          {control.category}
                        </span>
                      </td>
                      <td className="current-score-cell">
                        <span className="score-value">{control.currentScore}</span>
                      </td>
                      <td className="max-score-cell">
                        <span className="score-value">{control.maxScore}</span>
                      </td>
                      <td className="score-gap-cell">
                        <div className="score-gap">
                          {control.scoreGap > 0 ? `+${control.scoreGap}` : '0'}
                        </div>
                      </td>
                      <td className="status-cell">
                        <span className={`status-badge ${control.implementationStatus.toLowerCase().replace(' ', '-')}`}>
                          {control.implementationStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="no-controls-data">
              <p>No security controls data available in the assessment.</p>
              <p>This may indicate that the secure score data collection was incomplete.</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderIdentityTable = (metrics: any) => {
    if (!metrics || metrics.totalUsers === undefined) {
      return (
        <div className="no-identity-data">
          <p>No identity data available</p>
        </div>
      );
    }

    return (
      <div className="identity-container">
        {/* MFA Overview */}
        <div className="mfa-overview">
          <h4>Multi-Factor Authentication Status</h4>
          <div className="mfa-metrics">
            <div className="mfa-metric enabled">
              <span className="metric-label">MFA Enabled</span>
              <span className="metric-value">{metrics.mfaEnabledUsers || 0}</span>
              <span className="metric-percentage">{metrics.mfaCoverage || 0}%</span>
            </div>
            <div className="mfa-metric disabled">
              <span className="metric-label">MFA Disabled</span>
              <span className="metric-value">{metrics.mfaDisabledUsers || 0}</span>
              <span className="metric-percentage">{100 - (metrics.mfaCoverage || 0)}%</span>
            </div>
            <div className="mfa-metric total">
              <span className="metric-label">Total Users</span>
              <span className="metric-value">{metrics.totalUsers || 0}</span>
              <span className="metric-percentage">100%</span>
            </div>
            <div className="mfa-metric policies">
              <span className="metric-label">CA Policies</span>
              <span className="metric-value">{metrics.conditionalAccessPolicies || 0}</span>
              <span className="metric-percentage">Active</span>
            </div>
          </div>
          <div className="security-risk-indicator">
            <span className="risk-label">Security Risk Level:</span>
            <span className={`risk-badge ${metrics.securityRisk?.toLowerCase() || 'unknown'}`}>
              {metrics.securityRisk || 'Unknown'}
            </span>
          </div>
        </div>

        {/* User Types Breakdown */}
        <div className="user-types-table">
          <h4>User Types Breakdown</h4>
          <div className="table-wrapper">
            <table className="identity-table">
              <thead>
                <tr>
                  <th>User Type</th>
                  <th>Count</th>
                  <th>Percentage</th>
                  <th>Risk Level</th>
                  <th>MFA Required</th>
                </tr>
              </thead>
              <tbody>
                {(metrics.userBreakdown || []).map((userType: any, index: number) => (
                  <tr key={index}>
                    <td className="user-type-cell">
                      <span className="user-type-name">{userType.type}</span>
                    </td>
                    <td className="count-cell">{userType.count.toLocaleString()}</td>
                    <td className="percentage-cell">
                      <div className="percentage-bar-container">
                        <div 
                          className="percentage-bar-fill" 
                          style={{ 
                            width: `${userType.percentage}%`,
                            backgroundColor: userType.type === 'Admin Users' ? '#fd7e14' : 
                                           userType.type === 'Guest Users' ? '#6f42c1' : '#007bff'
                          }}
                        />
                        <span className="percentage-text">{userType.percentage}%</span>
                      </div>
                    </td>
                    <td className="risk-cell">
                      <span className={`risk-badge ${userType.risk.toLowerCase()}`}>
                        {userType.risk}
                      </span>
                    </td>
                    <td className="mfa-required-cell">
                      <span className={`mfa-badge ${userType.type === 'Admin Users' ? 'mandatory' : 'recommended'}`}>
                        {userType.type === 'Admin Users' ? 'Mandatory' : 'Recommended'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const currentTabData = getCurrentTabData();

  return (
    <div className="reports-page">
      <div className="page-header">
        <h1>Security Reports</h1>
        <p>Comprehensive security analysis across all categories</p>
      </div>

      {/* Customer Selection */}
      <div className="customer-selection-section">
        <div className="form-group">
          <label htmlFor="customer-select">Select Customer:</label>
          <select
            id="customer-select"
            value={selectedCustomer?.id || ''}
            onChange={(e) => {
              const customer = customers.find(c => c.id === e.target.value);
              setSelectedCustomer(customer || null);
            }}
            className="form-select"
          >
            <option value="">Choose a customer for reports...</option>
            {customers.map(customer => (
              <option key={customer.id} value={customer.id}>
                {customer.tenantName}
              </option>
            ))}
          </select>
        </div>
      </div>


      {/* Production mode: Debug buttons are hidden */}
      {process.env.NODE_ENV === 'development' && selectedCustomer && (
        <div style={{ margin: '1em 0', display: 'flex', gap: '1em', alignItems: 'center' }}>
          <button onClick={handleTestCreateAssessment} disabled={creatingAssessment} style={{ padding: '0.5em 1em', fontWeight: 'bold' }}>
            {creatingAssessment ? 'Creating Test Assessment...' : 'Create Test Assessment (Debug)'}
          </button>
          <button onClick={loadCustomerAssessment} disabled={loading} style={{ padding: '0.5em 1em', fontWeight: 'bold', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px' }}>
            {loading ? 'Refreshing...' : 'Refresh Assessments'}
          </button>
          {createAssessmentResult && (
            <div style={{ marginTop: '0.5em', color: createAssessmentResult.startsWith('Error') ? 'red' : 'green' }}>
              {createAssessmentResult}
            </div>
          )}
        </div>
      )}

      {/* App Registration/Consent Data Issue Warning */}
      {selectedCustomer && customerAssessment && customerAssessment.metrics && customerAssessment.metrics.dataIssue && (
        <div className="data-issue-warning" style={{
          background: '#fff3cd',
          color: '#856404',
          border: '1px solid #ffeeba',
          borderRadius: '6px',
          padding: '1em',
          margin: '1em 0',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75em'
        }}>
          <span style={{ fontSize: '1.5em' }}>⚠️</span>
          <div>
            <div style={{ marginBottom: '0.5em' }}>
              <strong>Assessment Data Issue:</strong> {customerAssessment.metrics.dataIssue}
            </div>
            <div>
              <span>
                This usually means the Microsoft 365 app registration for this customer is not set up or admin consent is missing.<br />
                <b>Action required:</b> An admin must complete the app registration and grant admin consent for this customer to enable real data collection.<br />
                <br />
                <b>How to fix:</b>
                <ol style={{ margin: '0.5em 0 0 1.5em' }}>
                  <li>Go to the <b>Azure Portal</b> &rarr; <b>App registrations</b> and ensure the app is registered for this tenant.</li>
                  <li>Grant <b>admin consent</b> for the required Microsoft Graph API permissions.</li>
                  <li>Return to this dashboard and re-run the assessment.</li>
                </ol>
                If you need help, see the <a href="https://learn.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app" target="_blank" rel="noopener noreferrer">Microsoft Docs: Register an application</a>.<br />
                <br />
                <i>After completing these steps, create a new assessment to see real data.</i>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="loading-section">
          <div className="loading-spinner"></div>
          <p>Loading security reports...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="error-section">
          <div className="error-message">
            <h3>Unable to Load Reports</h3>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Reports Interface */}
      {selectedCustomer && !loading && !error && reportData.length > 0 && (
        <div className="reports-interface">
          <div className="reports-header">
            <h2>Security Reports for {selectedCustomer.tenantName}</h2>
            {customerAssessment && (
              <div className="assessment-info">
                <p className="assessment-date">
                  Assessment Date: {new Date(customerAssessment.assessmentDate || customerAssessment.lastModified).toLocaleDateString()}
                </p>
                <p className="assessment-id">
                  Assessment ID: {customerAssessment.id}
                </p>
                <div className="assessment-hint">
                  <span>💡 If you don't see secure score data, try creating a new assessment using the "Create Test Assessment (Debug)" button above.</span>
                </div>
              </div>
            )}
          </div>

          {/* Category Tabs */}
          <div className="category-tabs">
            {securityCategories.map(category => (
              <button
                key={category.id}
                className={`tab-button ${activeTab === category.id ? 'active' : ''}`}
                onClick={() => setActiveTab(category.id)}
              >
                <span className="tab-icon">{category.icon}</span>
                <span className="tab-label">{category.name}</span>
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="tab-content">
            <div className="tab-header">
              <h3>{securityCategories.find(c => c.id === activeTab)?.name}</h3>
              <p>{securityCategories.find(c => c.id === activeTab)?.description}</p>
            </div>

            {currentTabData ? (
              <>
                {/* Key Metrics */}
                {Object.keys(currentTabData.metrics).length > 0 && (
                  <div className="metrics-grid">
                    {Object.entries(currentTabData.metrics).map(([key, value]) => (
                      <div key={key} className="metric-card">
                        <div className="metric-label">{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</div>
                        <div className="metric-value">
                          {key === 'licenseTypes' ? (
                            <div className="license-types-list">
                              {Array.isArray(value) ? value.map((license: any, index: number) => (
                                <div key={index} className="license-type-item">
                                  <span className="license-name">{license.name}</span>
                                  <span className="license-count">{license.assigned}</span>
                                </div>
                              )) : (
                                <div className="no-license-data">No license data available</div>
                              )}
                            </div>
                          ) : (
                            typeof value === 'number' ? value.toLocaleString() : String(value)
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Charts or Custom Tables */}
                {activeTab === 'license' ? (
                  // Always show license table for license tab
                  <div className="charts-grid">
                    {renderLicenseTable(currentTabData.metrics.licenseTypes || [])}
                  </div>
                ) : activeTab === 'secureScore' ? (
                  // Always show secure score table for secure score tab
                  <div className="charts-grid">
                    {renderSecureScoreTable(currentTabData.metrics)}
                  </div>
                ) : activeTab === 'identity' ? (
                  // Always show identity table for identity tab
                  <div className="charts-grid">
                    {renderIdentityTable(currentTabData.metrics)}
                  </div>
                ) : (
                  // Show charts for other tabs
                  currentTabData.charts.length > 0 && (
                    <div className="charts-grid">
                      {currentTabData.charts.map((chart, index) => (
                        <div key={index} className="chart-card">
                          {renderChart(chart)}
                        </div>
                      ))}
                    </div>
                  )
                )}

                {/* Insights and Recommendations */}
                <div className="insights-recommendations">
                  <div className="insights-section">
                    <h4>Key Insights</h4>
                    <ul>
                      {currentTabData.insights.map((insight, index) => (
                        <li key={index}>{insight}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="recommendations-section">
                    <h4>Recommendations</h4>
                    <ul>
                      {currentTabData.recommendations.map((recommendation, index) => (
                        <li key={index}>{recommendation}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </>
            ) : (
              <div className="no-tab-data">
                <div className="no-data-message">
                  <h4>No Data Available</h4>
                  <p>This security category requires an assessment to display information.</p>
                  <p>Create an assessment for {selectedCustomer.tenantName} to see detailed analysis here.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* No Data State */}
      {selectedCustomer && !loading && !error && reportData.length === 0 && (
        <div className="no-data-section">
          <div className="no-data-message">
            <h3>No Report Data Available</h3>
            <p>Create an assessment for {selectedCustomer.tenantName} to generate security reports.</p>
          </div>
        </div>
      )}

      {/* No Customer Selected */}
      {!selectedCustomer && (
        <div className="no-selection-section">
          <div className="no-selection-message">
            <h3>Select a Customer</h3>
            <p>Choose a customer from the dropdown above to view their detailed security reports.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
