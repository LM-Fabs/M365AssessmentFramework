#!/bin/bash

# Test script for enhanced chunking mechanism in TableStorageService
echo "🧪 Testing Enhanced Chunking Mechanism"
echo "======================================"

# Set up test environment
cd "$(dirname "$0")/m365-security-assessment/m365-assessment-framework"

echo "📝 Creating test data for chunking..."

# Create a large test payload to simulate Secure Score assessment data
cat > test-large-payload.json << 'EOF'
{
  "metrics": {
    "score": {
      "overall": 71,
      "license": 0,
      "secureScore": 71
    },
    "realData": {
      "secureScore": {
        "currentScore": 948,
        "maxScore": 1334,
        "percentage": 71,
        "summary": "Security score: 948/1334 (71%)",
        "lastUpdated": "2025-01-15T10:30:00Z",
        "controlScores": []
      },
      "licenseInfo": {
        "totalLicenses": 2040069,
        "assignedLicenses": 70,
        "utilizationRate": 0.003,
        "summary": "70 of 2040069 licenses assigned (0% utilization)",
        "detailedBreakdown": {}
      },
      "tenantInfo": {
        "tenantId": "70adb6e8-c6f7-4f25-a75f-9bca098db644",
        "tenantName": "mwtips",
        "tenantDomain": "modernworkplace.tips"
      }
    },
    "assessmentType": "real-data",
    "dataCollected": true,
    "recommendations": []
  },
  "tenantId": "70adb6e8-c6f7-4f25-a75f-9bca098db644",
  "customerId": "customer-test-123",
  "score": 71
}
EOF

# Generate large control scores to simulate real Secure Score data
echo "📊 Generating large control scores data..."
node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('test-large-payload.json', 'utf8'));

// Generate 150 control scores to simulate a large Secure Score response
const controlScores = [];
for (let i = 0; i < 150; i++) {
  controlScores.push({
    controlName: 'Control ' + i + ' - ' + 'This is a very long control name that describes security control implementation requirements and best practices for Microsoft 365 security baseline configuration',
    category: 'Identity Protection and Access Management Category ' + (i % 5),
    description: 'This is a detailed description of the security control that explains what it does, why it is important, and how it should be implemented in a Microsoft 365 environment. This description includes technical details, configuration steps, and compliance requirements that must be met to achieve the desired security posture.',
    implementationStatus: 'Not Implemented',
    currentScore: Math.floor(Math.random() * 10),
    maxScore: 10,
    priority: ['High', 'Medium', 'Low'][Math.floor(Math.random() * 3)],
    remediation: 'Detailed remediation steps that explain how to implement this control, including specific configuration changes, policy updates, and procedural modifications that need to be made to improve the security posture.',
    impact: 'High impact control that significantly improves security posture when implemented correctly',
    tags: ['security', 'compliance', 'identity', 'access', 'protection'],
    lastUpdated: new Date().toISOString()
  });
}

data.metrics.realData.secureScore.controlScores = controlScores;
data.metrics.realData.secureScore.totalControlsFound = controlScores.length;

// Add detailed license breakdown
const licenseTypes = ['Office 365 E5', 'Office 365 E3', 'Azure AD Premium P1', 'Azure AD Premium P2', 'Microsoft 365 Business Premium'];
const licenseBreakdown = {};
licenseTypes.forEach((type, index) => {
  licenseBreakdown[type] = {
    total: Math.floor(Math.random() * 100) + 50,
    assigned: Math.floor(Math.random() * 40) + 10,
    available: Math.floor(Math.random() * 30) + 5,
    details: 'Detailed information about this license type including features, limitations, and usage patterns across the organization'
  };
});
data.metrics.realData.licenseInfo.detailedBreakdown = licenseBreakdown;

// Add recommendations
const recommendations = [];
for (let i = 0; i < 25; i++) {
  recommendations.push({
    title: 'Security Recommendation ' + i,
    description: 'This is a comprehensive security recommendation that provides detailed guidance on improving your Microsoft 365 security posture. The recommendation includes specific steps, best practices, and implementation guidance.',
    priority: ['Critical', 'High', 'Medium', 'Low'][Math.floor(Math.random() * 4)],
    category: 'Security Enhancement',
    impact: 'Implementing this recommendation will significantly improve your security posture',
    effort: 'Medium effort required for implementation',
    timeline: '1-2 weeks',
    resources: ['Security Team', 'IT Administrator', 'Compliance Officer']
  });
}
data.metrics.recommendations = recommendations;

fs.writeFileSync('test-large-payload.json', JSON.stringify(data, null, 2));
console.log('✅ Generated test payload with', JSON.stringify(data).length, 'characters');
"

echo "📏 Test payload size:"
wc -c test-large-payload.json

echo ""
echo "🧪 Testing chunking mechanism..."
echo "This would normally be tested through the API, but we can verify the data structure:"

# Show the structure of the test data
echo "📋 Test data structure:"
node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('test-large-payload.json', 'utf8'));
console.log('Total size:', JSON.stringify(data).length, 'characters');
console.log('Metrics size:', JSON.stringify(data.metrics).length, 'characters');
console.log('Control scores count:', data.metrics.realData.secureScore.controlScores.length);
console.log('Recommendations count:', data.metrics.recommendations.length);
console.log('License breakdown entries:', Object.keys(data.metrics.realData.licenseInfo.detailedBreakdown).length);
"

echo ""
echo "✅ Test payload created successfully!"
echo "💡 This payload simulates a real Secure Score assessment with large data"
echo "🔧 The enhanced chunking mechanism should handle this data by:"
echo "   - Compressing JSON data (removing whitespace)"
echo "   - Optimizing control scores (top 30 most important)"
echo "   - Limiting recommendations (top 10)"
echo "   - Chunking into 50KB pieces"
echo "   - Falling back to minimal metrics if still too large"

# Clean up
rm -f test-large-payload.json

echo ""
echo "🎯 Next steps:"
echo "1. Deploy the enhanced backend code"
echo "2. Run a Secure Score assessment through the UI"
echo "3. Verify that large payloads are stored successfully"
echo "4. Check that chunked data is reconstructed correctly"
