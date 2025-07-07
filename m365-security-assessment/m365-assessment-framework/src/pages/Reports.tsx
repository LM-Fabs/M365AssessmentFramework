import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { CustomerService, Customer } from '../services/customerService';
import CustomerSelector from '../components/ui/CustomerSelector';
import { Card } from '../components/ui/Card';
import { Assessment } from '../models/Assessment';
import './Reports.css';

interface ReportData {
  assessmentId: string;
  tenantName: string;
  tenantDomain: string;
  date: Date;
  overallScore: number;
  categoryScores: {
    license: number;
    secureScore: number;
  };
  licenseInfo?: {
    totalUsers: number;
    assignedLicenses: number;
    availableLicenses: number;
    utilizationRate: number;
    estimatedMonthlyCost: number;
  };
}

const Reports: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [reportData, setReportData] = useState<ReportData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState<'30' | '90' | '365' | 'all'>('90');
  
  const customerService = CustomerService.getInstance();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
  }, [isAuthenticated, navigate]);

  // Load customer assessments when customer is selected
  useEffect(() => {
    const loadAssessments = async () => {
      if (selectedCustomer) {
        setLoading(true);
        try {
          const customerAssessments = await customerService.getCustomerAssessments(selectedCustomer.id);
          setAssessments(customerAssessments);
          
          // Transform assessments into report data
          const reports: ReportData[] = customerAssessments.map(assessment => ({
            assessmentId: assessment.id,
            tenantName: selectedCustomer.tenantName,
            tenantDomain: selectedCustomer.tenantDomain,
            date: new Date(assessment.lastModified),
            overallScore: assessment.metrics?.score?.overall || 0,
            categoryScores: {
              license: assessment.metrics?.score?.license || 0,
              secureScore: assessment.metrics?.score?.secureScore || 0,
            },
            licenseInfo: assessment.metrics?.license ? {
              totalUsers: assessment.metrics.license.totalLicenses || 0,
              assignedLicenses: assessment.metrics.license.assignedLicenses || 0,
              availableLicenses: (assessment.metrics.license.totalLicenses || 0) - (assessment.metrics.license.assignedLicenses || 0),
              utilizationRate: assessment.metrics.license.utilizationRate || 0,
              estimatedMonthlyCost: 0, // This would need to be calculated based on license pricing
            } : undefined
          }));
          
          setReportData(reports);
        } catch (error) {
          console.error('Failed to load assessments:', error);
          setError('Failed to load assessment data for reports.');
          setAssessments([]);
          setReportData([]);
        } finally {
          setLoading(false);
        }
      } else {
        setAssessments([]);
        setReportData([]);
      }
    };

    loadAssessments();
  }, [selectedCustomer]);

  const handleCustomerSelect = (customer: Customer | null) => {
    setSelectedCustomer(customer);
    setError(null);
  };

  const filterDataByTimeframe = (data: ReportData[]) => {
    if (selectedTimeframe === 'all') return data;
    
    const days = parseInt(selectedTimeframe);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return data.filter(item => item.date >= cutoffDate);
  };

  const filteredData = filterDataByTimeframe(reportData);

  const getScoreTrend = () => {
    if (filteredData.length < 2) return null;
    
    const sortedData = [...filteredData].sort((a, b) => a.date.getTime() - b.date.getTime());
    const firstScore = sortedData[0].overallScore;
    const lastScore = sortedData[sortedData.length - 1].overallScore;
    const change = lastScore - firstScore;
    
    return {
      change,
      direction: change > 0 ? 'up' : change < 0 ? 'down' : 'stable',
      percentage: firstScore > 0 ? Math.abs((change / firstScore) * 100) : 0
    };
  };

  const getLicenseUtilizationAverage = () => {
    const validData = filteredData.filter(d => d.licenseInfo);
    if (validData.length === 0) return 0;
    
    const totalUtilization = validData.reduce((sum, d) => sum + (d.licenseInfo?.utilizationRate || 0), 0);
    return totalUtilization / validData.length;
  };

  const getTotalEstimatedCost = () => {
    const latestData = filteredData.find(d => d.licenseInfo);
    return latestData?.licenseInfo?.estimatedMonthlyCost || 0;
  };

  const scoreTrend = getScoreTrend();
  const avgLicenseUtilization = getLicenseUtilizationAverage();
  const totalCost = getTotalEstimatedCost();

  const handleViewAssessment = (assessmentId: string) => {
    navigate(`/assessment-results/${assessmentId}`);
  };

  const handleExportReport = () => {
    if (filteredData.length === 0) return;

    const csvContent = [
      ['Date', 'Overall Score', 'License Score', 'Secure Score', 'License Utilization (%)', 'Estimated Monthly Cost ($)'],
      ...filteredData.map(item => [
        item.date.toLocaleDateString(),
        item.overallScore.toString(),
        item.categoryScores.license.toString(),
        item.categoryScores.secureScore.toString(),
        item.licenseInfo ? (item.licenseInfo.utilizationRate * 100).toFixed(1) : 'N/A',
        item.licenseInfo ? item.licenseInfo.estimatedMonthlyCost.toFixed(2) : 'N/A'
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `security-report-${selectedCustomer?.tenantName}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="reports-page">
      <div className="reports-header">
        <h1 className="reports-title">Security Assessment Reports</h1>
        <p className="reports-subtitle">
          Analyze trends, track progress, and generate comprehensive security reports.
        </p>
      </div>

      <div className="reports-controls">
        <div className="customer-selection">
          <CustomerSelector
            selectedCustomer={selectedCustomer}
            onCustomerSelect={handleCustomerSelect}
            placeholder="Select a customer to view reports..."
            showCreateNew={false}
          />
        </div>

        {selectedCustomer && (
          <div className="report-filters">
            <div className="timeframe-selector">
              <label>Time Period:</label>
              <select 
                value={selectedTimeframe} 
                onChange={(e) => setSelectedTimeframe(e.target.value as any)}
                className="timeframe-select"
              >
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
                <option value="365">Last year</option>
                <option value="all">All time</option>
              </select>
            </div>

            <button 
              className="lm-button secondary"
              onClick={handleExportReport}
              disabled={filteredData.length === 0}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14,2 14,8 20,8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10,9 9,9 8,9"></polyline>
              </svg>
              Export CSV
            </button>
          </div>
        )}
      </div>

      {error && (
        <Card title="Error" className="error-card">
          <div className="error-message">{error}</div>
        </Card>
      )}

      {loading && (
        <div className="loading-container">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span>Loading report data...</span>
        </div>
      )}

      {!selectedCustomer && !loading && (
        <Card
          title="Select a Customer"
          description="Choose a customer from the dropdown above to view their security assessment reports and analytics."
        >
          <p className="text-sm text-gray-600">
            Reports provide insights into security trends, license utilization, and assessment history.
          </p>
        </Card>
      )}

      {selectedCustomer && !loading && filteredData.length === 0 && (
        <Card
          title="No Report Data Available"
          description={`No assessment data found for ${selectedCustomer.tenantName} in the selected time period.`}
        >
          <button 
            className="lm-button primary" 
            onClick={() => navigate('/assessments')}
          >
            Create Assessment
          </button>
        </Card>
      )}

      {selectedCustomer && !loading && filteredData.length > 0 && (
        <div className="reports-content">
          <div className="report-summary">
            <h2 className="section-title">Executive Summary</h2>
            <div className="summary-cards">
              <div className="summary-card">
                <h3>Total Assessments</h3>
                <div className="summary-value">{filteredData.length}</div>
                <div className="summary-label">in selected period</div>
              </div>

              <div className="summary-card">
                <h3>Security Score Trend</h3>
                <div className="summary-value">
                  {scoreTrend ? (
                    <span className={`trend ${scoreTrend.direction}`}>
                      {scoreTrend.direction === 'up' && '↗️'}
                      {scoreTrend.direction === 'down' && '↘️'}
                      {scoreTrend.direction === 'stable' && '➡️'}
                      {scoreTrend.percentage.toFixed(1)}%
                    </span>
                  ) : (
                    'N/A'
                  )}
                </div>
                <div className="summary-label">vs previous period</div>
              </div>

              <div className="summary-card">
                <h3>Avg License Utilization</h3>
                <div className="summary-value">{(avgLicenseUtilization * 100).toFixed(1)}%</div>
                <div className="summary-label">across assessments</div>
              </div>

              <div className="summary-card">
                <h3>Estimated Monthly Cost</h3>
                <div className="summary-value">${totalCost.toLocaleString()}</div>
                <div className="summary-label">current licenses</div>
              </div>
            </div>
          </div>

          <div className="assessment-history">
            <h2 className="section-title">Assessment History</h2>
            <div className="history-table">
              <div className="table-header">
                <span>Date</span>
                <span>Overall Score</span>
                <span>License Score</span>
                <span>Secure Score</span>
                <span>License Utilization</span>
                <span>Actions</span>
              </div>
              {filteredData.map((item) => (
                <div key={item.assessmentId} className="table-row">
                  <span className="date-cell">{item.date.toLocaleDateString()}</span>
                  <span className="score-cell">
                    <div className={`score-badge ${item.overallScore >= 80 ? 'high' : item.overallScore >= 60 ? 'medium' : 'low'}`}>
                      {item.overallScore}%
                    </div>
                  </span>
                  <span className="score-cell">{item.categoryScores.license}%</span>
                  <span className="score-cell">{item.categoryScores.secureScore}%</span>
                  <span className="utilization-cell">
                    {item.licenseInfo 
                      ? `${(item.licenseInfo.utilizationRate * 100).toFixed(1)}%`
                      : 'N/A'
                    }
                  </span>
                  <span className="actions-cell">
                    <button 
                      className="lm-button small primary"
                      onClick={() => handleViewAssessment(item.assessmentId)}
                    >
                      View Details
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
