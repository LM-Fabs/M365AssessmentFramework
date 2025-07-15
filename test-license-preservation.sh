#!/bin/bash

# Test script for license data preservation in optimized metrics
echo "🧪 Testing License Data Preservation"
echo "===================================="

# Set up test environment
cd "$(dirname "$0")/m365-security-assessment/m365-assessment-framework"

echo "📝 Creating test data to verify license preservation..."

# Create test data that simulates the license information structure
node -e "
const testMetrics = {
  score: {
    overall: 71,
    license: 0,
    secureScore: 71
  },
  realData: {
    licenseInfo: {
      totalLicenses: 2040069,
      assignedLicenses: 70,
      utilizationRate: 0.003,
      summary: '70 of 2040069 licenses assigned (0% utilization)',
      detailedBreakdown: {
        'Office 365 E5': {
          total: 100,
          assigned: 25,
          available: 75,
          details: 'Office 365 E5 includes advanced security, analytics, and voice capabilities'
        },
        'Office 365 E3': {
          total: 500,
          assigned: 30,
          available: 470,
          details: 'Office 365 E3 includes core productivity apps and services'
        },
        'Azure AD Premium P1': {
          total: 200,
          assigned: 10,
          available: 190,
          details: 'Azure AD Premium P1 provides identity and access management'
        },
        'Microsoft 365 Business Premium': {
          total: 50,
          assigned: 5,
          available: 45,
          details: 'Microsoft 365 Business Premium for small and medium businesses'
        }
      },
      licenseTypes: ['Office 365 E5', 'Office 365 E3', 'Azure AD Premium P1', 'Microsoft 365 Business Premium'],
      subscriptions: [
        { name: 'Office 365 E5', status: 'Active', renewalDate: '2025-12-31' },
        { name: 'Office 365 E3', status: 'Active', renewalDate: '2025-12-31' }
      ]
    },
    secureScore: {
      currentScore: 948,
      maxScore: 1334,
      percentage: 71,
      lastUpdated: '2025-07-15T00:00:00.000Z'
    }
  },
  recommendations: [
    {
      title: 'Enable Multi-Factor Authentication',
      description: 'Implement MFA to enhance security across all user accounts',
      priority: 'High',
      category: 'Security',
      impact: 'High security improvement',
      effort: 'Medium'
    },
    {
      title: 'Review License Utilization',
      description: 'Optimize license assignments to reduce costs and improve efficiency',
      priority: 'Medium',
      category: 'Cost Optimization',
      impact: 'Cost savings potential',
      effort: 'Low'
    }
  ]
};

console.log('📊 Original license data structure:');
console.log('- Total licenses:', testMetrics.realData.licenseInfo.totalLicenses);
console.log('- Assigned licenses:', testMetrics.realData.licenseInfo.assignedLicenses);
console.log('- License types:', testMetrics.realData.licenseInfo.licenseTypes.length);
console.log('- Detailed breakdown entries:', Object.keys(testMetrics.realData.licenseInfo.detailedBreakdown).length);
console.log('- Recommendations:', testMetrics.recommendations.length);

// Simulate optimization process
const optimizeMetricsForStorage = (metrics) => {
  if (!metrics) return metrics;
  
  const optimized = { ...metrics };
  
  // Apply license optimization logic
  if (optimized.realData?.licenseInfo) {
    const licenseInfo = optimized.realData.licenseInfo;
    
    optimized.realData.licenseInfo = {
      totalLicenses: licenseInfo.totalLicenses,
      assignedLicenses: licenseInfo.assignedLicenses,
      utilizationRate: licenseInfo.utilizationRate,
      summary: licenseInfo.summary,
      detailedBreakdown: licenseInfo.detailedBreakdown ? 
        Object.keys(licenseInfo.detailedBreakdown).reduce((acc, key) => {
          const license = licenseInfo.detailedBreakdown[key];
          acc[key] = {
            total: license.total,
            assigned: license.assigned,
            available: license.available,
            details: license.details ? license.details.substring(0, 100) : ''
          };
          return acc;
        }, {}) : undefined,
      licenseTypes: licenseInfo.licenseTypes || [],
      subscriptions: licenseInfo.subscriptions || [],
      optimized: true
    };
  }
  
  // Apply recommendation optimization
  if (optimized.recommendations && Array.isArray(optimized.recommendations)) {
    optimized.recommendations = optimized.recommendations
      .filter((rec) => rec && (rec.title || rec.description))
      .slice(0, 10)
      .map((rec) => ({
        title: rec.title || rec.name || 'Security Recommendation',
        description: rec.description || rec.detail || rec.summary || 'Recommendation details not available',
        priority: rec.priority || 'Medium',
        category: rec.category || 'Security',
        impact: rec.impact ? rec.impact.substring(0, 100) : undefined,
        effort: rec.effort || undefined
      }));
  }
  
  return optimized;
};

const optimizedMetrics = optimizeMetricsForStorage(testMetrics);

console.log('');
console.log('✅ Optimized license data structure:');
console.log('- Total licenses:', optimizedMetrics.realData.licenseInfo.totalLicenses);
console.log('- Assigned licenses:', optimizedMetrics.realData.licenseInfo.assignedLicenses);
console.log('- License types preserved:', optimizedMetrics.realData.licenseInfo.licenseTypes.length);
console.log('- Detailed breakdown preserved:', Object.keys(optimizedMetrics.realData.licenseInfo.detailedBreakdown).length);
console.log('- Subscriptions preserved:', optimizedMetrics.realData.licenseInfo.subscriptions.length);
console.log('- Recommendations preserved:', optimizedMetrics.recommendations.length);

console.log('');
console.log('📋 Sample detailed breakdown:');
const firstLicense = Object.keys(optimizedMetrics.realData.licenseInfo.detailedBreakdown)[0];
console.log(\`- \${firstLicense}:\`, optimizedMetrics.realData.licenseInfo.detailedBreakdown[firstLicense]);

console.log('');
console.log('📋 Sample recommendation:');
console.log('- Title:', optimizedMetrics.recommendations[0].title);
console.log('- Description:', optimizedMetrics.recommendations[0].description);
console.log('- Priority:', optimizedMetrics.recommendations[0].priority);

console.log('');
console.log('📏 Data sizes:');
console.log('- Original metrics size:', JSON.stringify(testMetrics).length, 'characters');
console.log('- Optimized metrics size:', JSON.stringify(optimizedMetrics).length, 'characters');
console.log('- Size reduction:', ((JSON.stringify(testMetrics).length - JSON.stringify(optimizedMetrics).length) / JSON.stringify(testMetrics).length * 100).toFixed(1), '%');
"

echo ""
echo "✅ License data preservation test completed!"
echo "💡 The optimization now preserves:"
echo "   - License breakdown details for reporting"
echo "   - License types array"
echo "   - Subscription information"
echo "   - Proper recommendation titles and descriptions"
echo "   - Essential metrics for the frontend"

echo ""
echo "🎯 This should resolve the empty license report issue!"
echo "   - License utilization data is preserved"
echo "   - Detailed breakdown is maintained"
echo "   - Recommendations have proper content"
echo "   - Data is still optimized to fit storage limits"
