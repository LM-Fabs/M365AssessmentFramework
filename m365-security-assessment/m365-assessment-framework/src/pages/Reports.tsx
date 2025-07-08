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

  const securityCategories: SecurityCategory[] = [
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
      // Get the most recent assessment for this customer
      const assessments = await AssessmentService.getInstance().getAssessments();
      const customerAssessments = assessments.filter(a => a.tenantId === selectedCustomer.tenantId);
      
      if (customerAssessments.length === 0) {
        setError('No assessments found for this customer. Create an assessment first.');
        setReportData([]);
        return;
      }

      // Get the most recent assessment
      const latestAssessment = customerAssessments.sort((a, b) => 
        new Date(b.assessmentDate || b.lastModified || 0).getTime() - 
        new Date(a.assessmentDate || a.lastModified || 0).getTime()
      )[0];

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
    const reports: ReportData[] = [];

    // License Management Report
    if (assessment.metrics?.realData?.licenseInfo) {
      const licenseInfo = assessment.metrics.realData.licenseInfo;
      const utilizationRate = licenseInfo.utilizationRate || 
        (licenseInfo.totalLicenses > 0 ? (licenseInfo.assignedLicenses / licenseInfo.totalLicenses) * 100 : 0);

      reports.push({
        category: 'license',
        metrics: {
          totalLicenses: licenseInfo.totalLicenses || 0,
          assignedLicenses: licenseInfo.assignedLicenses || 0,
          unutilizedLicenses: (licenseInfo.totalLicenses || 0) - (licenseInfo.assignedLicenses || 0),
          utilizationRate: Math.round(utilizationRate),
          costData: licenseInfo.costData || null,
          licenseTypes: licenseInfo.licenseTypes || []
        },
        charts: [
          {
            type: 'donut',
            title: 'License Utilization',
            data: [
              { label: 'Assigned', value: licenseInfo.assignedLicenses || 0, color: '#28a745' },
              { label: 'Available', value: (licenseInfo.totalLicenses || 0) - (licenseInfo.assignedLicenses || 0), color: '#dc3545' }
            ]
          },
          {
            type: 'bar',
            title: 'License Types Distribution',
            data: (licenseInfo.licenseTypes || []).map((type: any, index: number) => ({
              label: type.name || `License ${index + 1}`,
              value: type.assignedCount || 0,
              color: `hsl(${index * 60}, 70%, 60%)`
            }))
          }
        ],
        insights: [
          `License utilization is at ${Math.round(utilizationRate)}%`,
          `${(licenseInfo.totalLicenses || 0) - (licenseInfo.assignedLicenses || 0)} licenses are currently unused`,
          utilizationRate < 60 ? 'Consider optimizing license allocation to reduce costs' : 'License utilization is within acceptable range'
        ],
        recommendations: [
          utilizationRate < 60 ? 'Review and reallocate unused licenses' : 'Monitor for capacity planning',
          'Implement regular license usage reviews',
          'Consider upgrading high-usage users to premium licenses'
        ]
      });
    }

    // Secure Score Report
    if (assessment.metrics?.realData?.secureScore) {
      const secureScore = assessment.metrics.realData.secureScore;
      
      reports.push({
        category: 'secureScore',
        metrics: {
          currentScore: secureScore.currentScore || 0,
          maxScore: secureScore.maxScore || 100,
          percentage: Math.round(((secureScore.currentScore || 0) / (secureScore.maxScore || 100)) * 100),
          controlsImplemented: secureScore.controlsImplemented || 0,
          totalControls: secureScore.totalControls || 0,
          improvementActions: secureScore.improvementActions || []
        },
        charts: [
          {
            type: 'gauge',
            title: 'Security Score',
            data: {
              current: secureScore.currentScore || 0,
              max: secureScore.maxScore || 100,
              percentage: Math.round(((secureScore.currentScore || 0) / (secureScore.maxScore || 100)) * 100)
            }
          },
          {
            type: 'bar',
            title: 'Top Improvement Opportunities',
            data: (secureScore.improvementActions || []).slice(0, 5).map((action: any, index: number) => ({
              label: action.title || `Action ${index + 1}`,
              value: action.scoreIncrease || 0,
              color: `hsl(${index * 45}, 70%, 60%)`
            }))
          }
        ],
        insights: [
          `Current secure score: ${secureScore.currentScore || 0}/${secureScore.maxScore || 100}`,
          `${secureScore.controlsImplemented || 0} out of ${secureScore.totalControls || 0} security controls are implemented`,
          secureScore.currentScore < 60 ? 'Security posture needs significant improvement' : 'Security posture is good but can be enhanced'
        ],
        recommendations: [
          'Implement high-impact security controls first',
          'Enable multi-factor authentication for all users',
          'Configure conditional access policies',
          'Regularly review and update security settings'
        ]
      });
    }

    // Identity & Access Report
    const identityMetrics = assessment.metrics?.realData?.identityMetrics || {};
    reports.push({
      category: 'identity',
      metrics: {
        totalUsers: identityMetrics.totalUsers || 0,
        mfaEnabledUsers: identityMetrics.mfaEnabledUsers || 0,
        mfaCoverage: identityMetrics.mfaCoverage || 0,
        adminUsers: identityMetrics.adminUsers || 0,
        guestUsers: identityMetrics.guestUsers || 0,
        conditionalAccessPolicies: identityMetrics.conditionalAccessPolicies || 0
      },
      charts: [
        {
          type: 'donut',
          title: 'MFA Coverage',
          data: [
            { label: 'MFA Enabled', value: identityMetrics.mfaEnabledUsers || 0, color: '#28a745' },
            { label: 'MFA Disabled', value: (identityMetrics.totalUsers || 0) - (identityMetrics.mfaEnabledUsers || 0), color: '#dc3545' }
          ]
        },
        {
          type: 'bar',
          title: 'User Types',
          data: [
            { label: 'Regular Users', value: (identityMetrics.totalUsers || 0) - (identityMetrics.adminUsers || 0) - (identityMetrics.guestUsers || 0), color: '#007bff' },
            { label: 'Admin Users', value: identityMetrics.adminUsers || 0, color: '#fd7e14' },
            { label: 'Guest Users', value: identityMetrics.guestUsers || 0, color: '#6f42c1' }
          ]
        }
      ],
      insights: [
        `${identityMetrics.mfaCoverage || 0}% of users have MFA enabled`,
        `${identityMetrics.adminUsers || 0} admin users require special attention`,
        `${identityMetrics.conditionalAccessPolicies || 0} conditional access policies are configured`
      ],
      recommendations: [
        'Enable MFA for all users, especially administrators',
        'Implement conditional access policies',
        'Regularly review admin user permissions',
        'Monitor and audit guest user access'
      ]
    });

    setReportData(reports);
  };

  const getCurrentTabData = () => {
    return reportData.find(report => report.category === activeTab);
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
              <p className="assessment-date">
                Assessment Date: {new Date(customerAssessment.assessmentDate || customerAssessment.lastModified).toLocaleDateString()}
              </p>
            )}
          </div>

          {/* Category Tabs */}
          <div className="category-tabs">
            {securityCategories.map(category => (
              <button
                key={category.id}
                className={`tab-button ${activeTab === category.id ? 'active' : ''}`}
                onClick={() => setActiveTab(category.id)}
                disabled={!reportData.find(r => r.category === category.id)}
              >
                <span className="tab-icon">{category.icon}</span>
                <span className="tab-label">{category.name}</span>
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {currentTabData && (
            <div className="tab-content">
              <div className="tab-header">
                <h3>{securityCategories.find(c => c.id === activeTab)?.name}</h3>
                <p>{securityCategories.find(c => c.id === activeTab)?.description}</p>
              </div>

              {/* Key Metrics */}
              <div className="metrics-grid">
                {Object.entries(currentTabData.metrics).map(([key, value]) => (
                  <div key={key} className="metric-card">
                    <div className="metric-label">{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</div>
                    <div className="metric-value">{typeof value === 'number' ? value.toLocaleString() : String(value)}</div>
                  </div>
                ))}
              </div>

              {/* Charts */}
              <div className="charts-grid">
                {currentTabData.charts.map((chart, index) => (
                  <div key={index} className="chart-card">
                    {renderChart(chart)}
                  </div>
                ))}
              </div>

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
            </div>
          )}
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
