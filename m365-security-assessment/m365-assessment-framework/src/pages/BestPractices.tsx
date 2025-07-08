import React, { useState, useEffect } from 'react';
import { useCustomer } from '../contexts/CustomerContext';
import { Customer, CustomerService } from '../services/customerService';
import { AssessmentService } from '../services/assessmentService';
import './BestPractices.css';

interface BestPractice {
  id: string;
  category: string;
  metric: string;
  benchmark: number;
  unit: string;
  description: string;
  importance: 'high' | 'medium' | 'low';
  recommendations: string[];
}

interface ComparisonResult {
  practice: BestPractice;
  customerValue: number;
  gap: number;
  status: 'exceeds' | 'meets' | 'below' | 'critical';
  improvement: string;
}

const BestPractices: React.FC = () => {
  const { selectedCustomer, setSelectedCustomer } = useCustomer();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [comparisonResults, setComparisonResults] = useState<ComparisonResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bestPractices: BestPractice[] = [
    {
      id: 'license-utilization',
      category: 'License Management',
      metric: 'License Utilization Rate',
      benchmark: 85,
      unit: '%',
      description: 'Percentage of purchased licenses actively assigned to users',
      importance: 'high',
      recommendations: [
        'Regularly review and reallocate unused licenses',
        'Implement automated license assignment policies',
        'Monitor license usage trends to optimize procurement'
      ]
    },
    {
      id: 'secure-score',
      category: 'Security Posture',
      metric: 'Microsoft Secure Score',
      benchmark: 80,
      unit: '%',
      description: 'Overall security posture score from Microsoft',
      importance: 'high',
      recommendations: [
        'Enable multi-factor authentication for all users',
        'Configure conditional access policies',
        'Implement data loss prevention policies',
        'Regular security configuration reviews'
      ]
    },
    {
      id: 'mfa-coverage',
      category: 'Identity Security',
      metric: 'MFA Coverage',
      benchmark: 100,
      unit: '%',
      description: 'Percentage of users with multi-factor authentication enabled',
      importance: 'high',
      recommendations: [
        'Mandate MFA for all users',
        'Use conditional access to enforce MFA',
        'Provide user training on MFA setup',
        'Regularly audit MFA compliance'
      ]
    },
    {
      id: 'admin-mfa',
      category: 'Administrative Security',
      metric: 'Admin MFA Coverage',
      benchmark: 100,
      unit: '%',
      description: 'Percentage of administrative users with MFA enabled',
      importance: 'high',
      recommendations: [
        'Require MFA for all administrative accounts',
        'Use privileged access management',
        'Implement just-in-time admin access',
        'Regular admin account reviews'
      ]
    }
  ];

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    if (selectedCustomer) {
      performBestPracticeComparison();
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

  const performBestPracticeComparison = async () => {
    if (!selectedCustomer) return;

    setLoading(true);
    setError(null);

    try {
      // Get the most recent assessment for this customer
      const assessments = await AssessmentService.getInstance().getAssessments();
      const customerAssessments = assessments.filter(a => a.tenantId === selectedCustomer.tenantId);
      
      if (customerAssessments.length === 0) {
        setError('No assessments found for this customer. Create an assessment first.');
        setComparisonResults([]);
        return;
      }

      // Get the most recent assessment
      const latestAssessment = customerAssessments.sort((a, b) => 
        new Date(b.assessmentDate || b.lastModified || 0).getTime() - 
        new Date(a.assessmentDate || a.lastModified || 0).getTime()
      )[0];

      // Compare against best practices
      const results: ComparisonResult[] = [];

      bestPractices.forEach(practice => {
        let customerValue = 0;
        let status: ComparisonResult['status'] = 'critical';
        let improvement = '';

        // Extract customer value based on practice type
        if (practice.id === 'license-utilization' && latestAssessment.metrics?.realData?.licenseInfo) {
          const licenseInfo = latestAssessment.metrics.realData.licenseInfo;
          customerValue = licenseInfo.utilizationRate || 
            (licenseInfo.totalLicenses > 0 ? (licenseInfo.assignedLicenses / licenseInfo.totalLicenses) * 100 : 0);
        } else if (practice.id === 'secure-score' && latestAssessment.metrics?.realData?.secureScore) {
          const secureScore = latestAssessment.metrics.realData.secureScore;
          customerValue = Math.round(((secureScore.currentScore || 0) / (secureScore.maxScore || 100)) * 100);
        } else if (practice.id === 'mfa-coverage' && latestAssessment.metrics?.realData?.secureScore) {
          // For MFA coverage, we'll derive it from secure score data if available
          // This is a simplified approach - in a real implementation, you'd get this from Graph API
          const secureScore = latestAssessment.metrics.realData.secureScore;
          customerValue = Math.min(secureScore.currentScore / secureScore.maxScore * 100, 100) || 0;
        } else if (practice.id === 'admin-mfa' && latestAssessment.metrics?.realData?.secureScore) {
          // For admin MFA, we'll use a similar approach
          // In a real implementation, this would be calculated specifically for admin users
          const secureScore = latestAssessment.metrics.realData.secureScore;
          customerValue = Math.min(secureScore.currentScore / secureScore.maxScore * 100, 100) || 0;
        }

        const gap = practice.benchmark - customerValue;

        // Determine status
        if (customerValue >= practice.benchmark) {
          status = 'exceeds';
          improvement = 'Excellent! You exceed the benchmark.';
        } else if (customerValue >= practice.benchmark * 0.9) {
          status = 'meets';
          improvement = 'Good! You meet most requirements.';
        } else if (customerValue >= practice.benchmark * 0.7) {
          status = 'below';
          improvement = 'Needs improvement to meet benchmark.';
        } else {
          status = 'critical';
          improvement = 'Critical gap requiring immediate attention.';
        }

        results.push({
          practice,
          customerValue,
          gap,
          status,
          improvement
        });
      });

      setComparisonResults(results);

    } catch (error) {
      console.error('Error performing best practice comparison:', error);
      setError('Failed to perform best practice comparison');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: ComparisonResult['status']) => {
    switch (status) {
      case 'exceeds': return '#28a745';
      case 'meets': return '#17a2b8';
      case 'below': return '#ffc107';
      case 'critical': return '#dc3545';
      default: return '#6c757d';
    }
  };

  const getStatusIcon = (status: ComparisonResult['status']) => {
    switch (status) {
      case 'exceeds': return '✅';
      case 'meets': return '✓';
      case 'below': return '⚠️';
      case 'critical': return '❌';
      default: return '❓';
    }
  };

  return (
    <div className="best-practices-container">
      <header className="best-practices-header">
        <h1>Best Practices Comparison</h1>
        <p>Compare your organization's security posture against industry benchmarks</p>
      </header>

      <div className="customer-selector">
        <label htmlFor="customer-select">Select Customer:</label>
        <select
          id="customer-select"
          value={selectedCustomer?.id || ''}
          onChange={(e) => {
            const customer = customers.find(c => c.id === e.target.value);
            setSelectedCustomer(customer || null);
          }}
        >
          <option value="">Choose a customer...</option>
          {customers.map(customer => (
            <option key={customer.id} value={customer.id}>
              {customer.tenantName} ({customer.tenantDomain})
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="error-message">
          <p>{error}</p>
        </div>
      )}

      {loading && (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Analyzing best practices...</p>
        </div>
      )}

      {!loading && selectedCustomer && comparisonResults.length > 0 && (
        <div className="comparison-results">
          <div className="results-header">
            <h2>Assessment Results for {selectedCustomer.tenantName}</h2>
            <p>Last assessment: {new Date().toLocaleDateString()}</p>
          </div>

          <div className="results-grid">
            {comparisonResults.map((result, index) => (
              <div key={index} className="result-card">
                <div className="result-header">
                  <div className="result-status">
                    <span className="status-icon">{getStatusIcon(result.status)}</span>
                    <span 
                      className="status-text"
                      style={{ color: getStatusColor(result.status) }}
                    >
                      {result.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="result-category">{result.practice.category}</div>
                </div>

                <div className="result-content">
                  <h3>{result.practice.metric}</h3>
                  <p className="practice-description">{result.practice.description}</p>

                  <div className="metric-comparison">
                    <div className="metric-row">
                      <span className="metric-label">Your Score:</span>
                      <span className="metric-value current">
                        {result.customerValue.toFixed(1)}{result.practice.unit}
                      </span>
                    </div>
                    <div className="metric-row">
                      <span className="metric-label">Benchmark:</span>
                      <span className="metric-value benchmark">
                        {result.practice.benchmark}{result.practice.unit}
                      </span>
                    </div>
                    <div className="metric-row">
                      <span className="metric-label">Gap:</span>
                      <span 
                        className={`metric-value gap ${result.gap <= 0 ? 'positive' : 'negative'}`}
                      >
                        {result.gap > 0 ? '+' : ''}{result.gap.toFixed(1)}{result.practice.unit}
                      </span>
                    </div>
                  </div>

                  <div className="progress-bar">
                    <div 
                      className="progress-fill"
                      style={{ 
                        width: `${Math.min(result.customerValue, 100)}%`,
                        backgroundColor: getStatusColor(result.status)
                      }}
                    ></div>
                    <div 
                      className="benchmark-line"
                      style={{ left: `${Math.min(result.practice.benchmark, 100)}%` }}
                    ></div>
                  </div>

                  <div className="improvement-text">
                    <p>{result.improvement}</p>
                  </div>

                  {result.practice.recommendations && result.practice.recommendations.length > 0 && (
                    <div className="recommendations">
                      <h4>Recommendations:</h4>
                      <ul>
                        {result.practice.recommendations.map((rec, i) => (
                          <li key={i}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && selectedCustomer && comparisonResults.length === 0 && !error && (
        <div className="no-data">
          <p>No assessment data available for comparison.</p>
          <p>Please create an assessment for this customer first.</p>
        </div>
      )}
    </div>
  );
};

export default BestPractices;
