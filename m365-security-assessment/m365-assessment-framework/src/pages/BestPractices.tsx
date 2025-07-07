import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Card } from '../components/ui/Card';
import './BestPractices.css';

interface BestPractice {
  id: string;
  category: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  implementation: string;
  impact: string;
  resources: Array<{
    title: string;
    url: string;
    type: 'documentation' | 'tool' | 'guide';
  }>;
}

const BestPractices: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
  }, [isAuthenticated, navigate]);

  const bestPractices: BestPractice[] = [
    {
      id: 'mfa-enforcement',
      category: 'Identity & Access',
      title: 'Enforce Multi-Factor Authentication (MFA)',
      description: 'Require MFA for all users to significantly reduce the risk of account compromise.',
      priority: 'high',
      implementation: 'Configure Conditional Access policies to require MFA for all users and applications.',
      impact: 'Reduces account compromise risk by up to 99.9%',
      resources: [
        {
          title: 'Microsoft MFA Documentation',
          url: 'https://docs.microsoft.com/en-us/azure/active-directory/authentication/concept-mfa-howitworks',
          type: 'documentation'
        },
        {
          title: 'Conditional Access Best Practices',
          url: 'https://docs.microsoft.com/en-us/azure/active-directory/conditional-access/best-practices',
          type: 'guide'
        }
      ]
    },
    {
      id: 'privileged-access',
      category: 'Identity & Access',
      title: 'Implement Privileged Identity Management (PIM)',
      description: 'Use just-in-time access for administrative roles to minimize security exposure.',
      priority: 'high',
      implementation: 'Enable Azure AD PIM and configure eligible assignments for all administrative roles.',
      impact: 'Reduces privileged access exposure and provides audit trail',
      resources: [
        {
          title: 'Azure AD PIM Documentation',
          url: 'https://docs.microsoft.com/en-us/azure/active-directory/privileged-identity-management/',
          type: 'documentation'
        }
      ]
    },
    {
      id: 'email-security',
      category: 'Email & Collaboration',
      title: 'Configure Advanced Threat Protection',
      description: 'Enable Microsoft Defender for Office 365 to protect against advanced email threats.',
      priority: 'high',
      implementation: 'Configure Safe Attachments, Safe Links, and anti-phishing policies.',
      impact: 'Protects against zero-day attacks and advanced phishing attempts',
      resources: [
        {
          title: 'Defender for Office 365',
          url: 'https://docs.microsoft.com/en-us/microsoft-365/security/office-365-security/',
          type: 'documentation'
        }
      ]
    },
    {
      id: 'data-classification',
      category: 'Data Protection',
      title: 'Implement Information Protection Labels',
      description: 'Classify and protect sensitive data using Microsoft Purview Information Protection.',
      priority: 'medium',
      implementation: 'Create sensitivity labels and configure auto-labeling policies.',
      impact: 'Ensures sensitive data is properly classified and protected',
      resources: [
        {
          title: 'Microsoft Purview Information Protection',
          url: 'https://docs.microsoft.com/en-us/microsoft-365/compliance/information-protection',
          type: 'documentation'
        }
      ]
    },
    {
      id: 'device-compliance',
      category: 'Device Management',
      title: 'Enforce Device Compliance Policies',
      description: 'Ensure all devices meet security requirements before accessing corporate resources.',
      priority: 'medium',
      implementation: 'Configure Intune compliance policies and Conditional Access for device requirements.',
      impact: 'Prevents compromised devices from accessing corporate data',
      resources: [
        {
          title: 'Intune Device Compliance',
          url: 'https://docs.microsoft.com/en-us/mem/intune/protect/device-compliance-get-started',
          type: 'documentation'
        }
      ]
    },
    {
      id: 'backup-strategy',
      category: 'Data Protection',
      title: 'Implement Comprehensive Backup Strategy',
      description: 'Protect against data loss with regular backups of critical Microsoft 365 data.',
      priority: 'medium',
      implementation: 'Use third-party backup solutions or Microsoft 365 retention policies.',
      impact: 'Protects against accidental deletion, corruption, and ransomware',
      resources: [
        {
          title: 'Microsoft 365 Backup Solutions',
          url: 'https://docs.microsoft.com/en-us/microsoft-365/enterprise/backup-and-restore-overview',
          type: 'guide'
        }
      ]
    },
    {
      id: 'security-monitoring',
      category: 'Security Operations',
      title: 'Enable Security Monitoring and Alerting',
      description: 'Use Microsoft Sentinel and Microsoft 365 Defender for comprehensive security monitoring.',
      priority: 'high',
      implementation: 'Configure SIEM solutions and set up automated response playbooks.',
      impact: 'Enables rapid detection and response to security incidents',
      resources: [
        {
          title: 'Microsoft Sentinel',
          url: 'https://docs.microsoft.com/en-us/azure/sentinel/',
          type: 'documentation'
        },
        {
          title: 'Microsoft 365 Defender',
          url: 'https://docs.microsoft.com/en-us/microsoft-365/security/defender/',
          type: 'documentation'
        }
      ]
    },
    {
      id: 'license-optimization',
      category: 'License Management',
      title: 'Optimize License Utilization',
      description: 'Regularly review and optimize Microsoft 365 license assignments to reduce costs.',
      priority: 'low',
      implementation: 'Use license analytics and automated assignment policies.',
      impact: 'Reduces licensing costs and ensures proper feature access',
      resources: [
        {
          title: 'Microsoft 365 Admin Center',
          url: 'https://admin.microsoft.com',
          type: 'tool'
        }
      ]
    }
  ];

  const categories = ['all', ...Array.from(new Set(bestPractices.map(bp => bp.category)))];

  const filteredPractices = bestPractices.filter(practice => {
    const matchesCategory = selectedCategory === 'all' || practice.category === selectedCategory;
    const matchesSearch = searchTerm === '' || 
      practice.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      practice.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'var(--error-color)';
      case 'medium': return 'var(--warning-color)';
      case 'low': return 'var(--success-color)';
      default: return 'var(--text-secondary)';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L2 22h20L12 2zm0 3.99L18.53 20H5.47L12 5.99zM11 16h2v2h-2v-2zm0-6h2v4h-2v-4z"/>
          </svg>
        );
      case 'medium':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 6v6l4 2"/>
          </svg>
        );
      case 'low':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="10"/>
            <path d="M9 12l2 2 4-4"/>
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className="best-practices-page">
      <div className="best-practices-header">
        <h1 className="best-practices-title">Microsoft 365 Security Best Practices</h1>
        <p className="best-practices-subtitle">
          Comprehensive security recommendations to strengthen your Microsoft 365 environment.
        </p>
      </div>

      <div className="best-practices-controls">
        <div className="search-container">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="search-icon">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
          <input
            type="text"
            placeholder="Search best practices..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="category-filters">
          {categories.map(category => (
            <button
              key={category}
              className={`category-filter ${selectedCategory === category ? 'active' : ''}`}
              onClick={() => setSelectedCategory(category)}
            >
              {category === 'all' ? 'All Categories' : category}
            </button>
          ))}
        </div>
      </div>

      <div className="best-practices-summary">
        <div className="summary-stats">
          <div className="stat-item">
            <span className="stat-number">{filteredPractices.length}</span>
            <span className="stat-label">Best Practices</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{filteredPractices.filter(p => p.priority === 'high').length}</span>
            <span className="stat-label">High Priority</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{categories.length - 1}</span>
            <span className="stat-label">Categories</span>
          </div>
        </div>
      </div>

      <div className="best-practices-grid">
        {filteredPractices.map(practice => (
          <Card
            key={practice.id}
            title={practice.title}
            className="best-practice-card"
          >
            <div className="practice-content">
              <div className="practice-meta">
                <span className="practice-category">{practice.category}</span>
                <div 
                  className="practice-priority"
                  style={{ color: getPriorityColor(practice.priority) }}
                >
                  {getPriorityIcon(practice.priority)}
                  <span>{practice.priority.toUpperCase()} PRIORITY</span>
                </div>
              </div>

              <p className="practice-description">{practice.description}</p>

              <div className="practice-details">
                <div className="detail-section">
                  <h4>Implementation</h4>
                  <p>{practice.implementation}</p>
                </div>

                <div className="detail-section">
                  <h4>Business Impact</h4>
                  <p>{practice.impact}</p>
                </div>

                {practice.resources.length > 0 && (
                  <div className="detail-section">
                    <h4>Resources</h4>
                    <div className="resources-list">
                      {practice.resources.map((resource, index) => (
                        <a
                          key={index}
                          href={resource.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="resource-link"
                        >
                          <span className={`resource-type ${resource.type}`}>
                            {resource.type === 'documentation' && '📚'}
                            {resource.type === 'tool' && '🔧'}
                            {resource.type === 'guide' && '📖'}
                          </span>
                          {resource.title}
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                            <polyline points="15,3 21,3 21,9"></polyline>
                            <line x1="10" y1="14" x2="21" y2="3"></line>
                          </svg>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {filteredPractices.length === 0 && (
        <Card
          title="No Best Practices Found"
          description="Try adjusting your search terms or category filter to find relevant best practices."
        >
          <button 
            className="lm-button secondary"
            onClick={() => {
              setSearchTerm('');
              setSelectedCategory('all');
            }}
          >
            Clear Filters
          </button>
        </Card>
      )}
    </div>
  );
};

export default BestPractices;
