// Script to create a mock assessment with realistic data for testing Reports UI
// This will create a POST request to add a new assessment with comprehensive mock data

const mockAssessmentData = {
  customerId: "da0d28e8-e7ca-4133-bfa8-f193bb26664d", // Using existing customer ID
  tenantId: "70adb6e8-c6f7-4f25-a75f-9bca098db644",
  assessmentName: "Mock Assessment - Full Data Demo",
  includedCategories: ["license", "secureScore", "identity"],
  notificationEmail: "",
  autoSchedule: false,
  scheduleFrequency: "monthly",
  // This will be the comprehensive mock data structure
  mockData: {
    score: 73,
    status: "completed",
    metrics: {
      score: {
        overall: 73,
        license: 78,
        secureScore: 68
      },
      license: {
        totalLicenses: 245,
        assignedLicenses: 198,
        utilizationRate: 81,
        licenseDetails: [
          {
            skuPartNumber: "SPE_E3",
            skuDisplayName: "Microsoft 365 E3",
            assignedUnits: 85,
            totalUnits: 100,
            servicePlans: ["EXCHANGE_S_ENTERPRISE", "MCOSTANDARD", "SHAREPOINTENTERPRISE"]
          },
          {
            skuPartNumber: "SPE_E5",
            skuDisplayName: "Microsoft 365 E5", 
            assignedUnits: 35,
            totalUnits: 50,
            servicePlans: ["EXCHANGE_S_ENTERPRISE", "MCOEV", "SHAREPOINTENTERPRISE"]
          },
          {
            skuPartNumber: "POWER_BI_PRO",
            skuDisplayName: "Power BI Pro",
            assignedUnits: 42,
            totalUnits: 60,
            servicePlans: ["BI_AZURE_P1"]
          },
          {
            skuPartNumber: "ENTERPRISEPACK",
            skuDisplayName: "Office 365 E3",
            assignedUnits: 36,
            totalUnits: 35,
            servicePlans: ["EXCHANGE_S_ENTERPRISE", "MCOSTANDARD"]
          }
        ],
        summary: "License utilization at 81% - good optimization level"
      },
      realData: {
        dataSource: "Microsoft Graph API via ServerGraphService (Mock Data)",
        tenantInfo: {
          domain: "modernworkplace.tips",
          tenantId: "70adb6e8-c6f7-4f25-a75f-9bca098db644",
          displayName: "mwtips"
        },
        lastUpdated: new Date().toISOString(),
        licenseInfo: {
          summary: "245 total licenses, 198 assigned (81% utilization)",
          licenses: [
            {
              skuPartNumber: "SPE_E3",
              skuDisplayName: "Microsoft 365 E3",
              assignedUnits: 85,
              totalUnits: 100
            },
            {
              skuPartNumber: "SPE_E5", 
              skuDisplayName: "Microsoft 365 E5",
              assignedUnits: 35,
              totalUnits: 50
            },
            {
              skuPartNumber: "POWER_BI_PRO",
              skuDisplayName: "Power BI Pro", 
              assignedUnits: 42,
              totalUnits: 60
            },
            {
              skuPartNumber: "ENTERPRISEPACK",
              skuDisplayName: "Office 365 E3",
              assignedUnits: 36,
              totalUnits: 35
            }
          ],
          utilization: 81,
          totalLicenses: 245,
          assignedLicenses: 198,
          licenseDetails: [
            {
              skuPartNumber: "SPE_E3",
              skuDisplayName: "Microsoft 365 E3",
              assignedUnits: 85,
              totalUnits: 100
            },
            {
              skuPartNumber: "SPE_E5",
              skuDisplayName: "Microsoft 365 E5", 
              assignedUnits: 35,
              totalUnits: 50
            },
            {
              skuPartNumber: "POWER_BI_PRO",
              skuDisplayName: "Power BI Pro",
              assignedUnits: 42,
              totalUnits: 60
            },
            {
              skuPartNumber: "ENTERPRISEPACK",
              skuDisplayName: "Office 365 E3",
              assignedUnits: 36,
              totalUnits: 35
            }
          ]
        },
        secureScore: {
          summary: "Microsoft Secure Score: 68%",
          maxScore: 423,
          percentage: 68,
          lastUpdated: new Date().toISOString(),
          unavailable: false,
          currentScore: 288,
          totalControlsFound: 47,
          controlsStoredCount: 47,
          compressed: false,
          controlScores: [
            {
              controlName: "Enable multi-factor authentication for all users",
              category: "Identity",
              currentScore: 8,
              maxScore: 10,
              implementationStatus: "Partial",
              actionType: "Policy",
              remediation: "Configure MFA for remaining users through Azure AD portal",
              scoreGap: 2
            },
            {
              controlName: "Enable Security Defaults",
              category: "Identity", 
              currentScore: 10,
              maxScore: 10,
              implementationStatus: "Implemented",
              actionType: "Policy",
              remediation: "Already implemented - maintain current configuration",
              scoreGap: 0
            },
            {
              controlName: "Configure conditional access for risky sign-ins",
              category: "Access Management",
              currentScore: 6,
              maxScore: 12,
              implementationStatus: "Partial",
              actionType: "Policy",
              remediation: "Create conditional access policies for high-risk locations and devices",
              scoreGap: 6
            },
            {
              controlName: "Enable privileged identity management",
              category: "Privileged Access",
              currentScore: 0,
              maxScore: 8,
              implementationStatus: "Not Implemented",
              actionType: "Feature",
              remediation: "Enable PIM for all privileged roles in Azure AD",
              scoreGap: 8
            },
            {
              controlName: "Configure data loss prevention policies",
              category: "Data Protection",
              currentScore: 7,
              maxScore: 9,
              implementationStatus: "Implemented",
              actionType: "Policy",
              remediation: "Fine-tune DLP policies for better coverage",
              scoreGap: 2
            },
            {
              controlName: "Enable Advanced Threat Protection",
              category: "Threat Protection",
              currentScore: 9,
              maxScore: 10,
              implementationStatus: "Implemented",
              actionType: "Feature",
              remediation: "Review ATP configurations for optimal protection",
              scoreGap: 1
            },
            {
              controlName: "Configure retention policies",
              category: "Data Governance",
              currentScore: 5,
              maxScore: 7,
              implementationStatus: "Partial",
              actionType: "Policy",
              remediation: "Implement comprehensive retention policies across all workloads",
              scoreGap: 2
            },
            {
              controlName: "Enable audit logging",
              category: "Monitoring",
              currentScore: 8,
              maxScore: 8,
              implementationStatus: "Implemented",
              actionType: "Feature",
              remediation: "Audit logging is properly configured",
              scoreGap: 0
            },
            {
              controlName: "Configure device compliance policies",
              category: "Device Management",
              currentScore: 4,
              maxScore: 9,
              implementationStatus: "Partial",
              actionType: "Policy",
              remediation: "Create device compliance policies for all device types",
              scoreGap: 5
            },
            {
              controlName: "Enable Windows Defender ATP",
              category: "Endpoint Protection",
              currentScore: 7,
              maxScore: 8,
              implementationStatus: "Implemented",
              actionType: "Feature",
              remediation: "Ensure all endpoints are enrolled in Windows Defender ATP",
              scoreGap: 1
            }
          ]
        },
        assessmentScope: "Security Metrics (Identity, Device Compliance, Secure Score) + License Analysis",
        identityMetrics: {
          adminUsers: 8,
          guestUsers: 12,
          totalUsers: 198,
          mfaCoverage: 89,
          mfaEnabledUsers: 176,
          conditionalAccessPolicies: 6
        },
        securityMetrics: {
          alertsCount: 3,
          secureScore: 68,
          identityScore: 78,
          dataProtectionScore: 72,
          recommendationsCount: 15,
          deviceComplianceScore: 84
        },
        authenticationMethod: "Azure Managed Identity"
      },
      lastUpdated: new Date().toISOString(),
      secureScore: {
        summary: "Microsoft Secure Score: 68%",
        maxScore: 423,
        percentage: 68,
        currentScore: 288,
        controlScores: [
          {
            controlName: "Enable multi-factor authentication for all users",
            category: "Identity",
            currentScore: 8,
            maxScore: 10,
            implementationStatus: "Partial",
            actionType: "Policy",
            remediation: "Configure MFA for remaining users through Azure AD portal",
            scoreGap: 2
          },
          {
            controlName: "Enable Security Defaults",
            category: "Identity",
            currentScore: 10,
            maxScore: 10,
            implementationStatus: "Implemented",
            actionType: "Policy", 
            remediation: "Already implemented - maintain current configuration",
            scoreGap: 0
          }
        ]
      }
    },
    recommendations: [
      "Enable Privileged Identity Management for administrative roles",
      "Configure additional conditional access policies for risky locations",
      "Implement comprehensive device compliance policies",
      "Complete multi-factor authentication rollout for all users",
      "Fine-tune data loss prevention policies for better coverage"
    ]
  }
};

console.log('Mock Assessment Data Structure:');
console.log(JSON.stringify(mockAssessmentData, null, 2));

// Instructions for testing
console.log('\n=== INSTRUCTIONS FOR TESTING ===');
console.log('1. Copy the mockAssessmentData object above');
console.log('2. Manually POST it to the assessments endpoint');
console.log('3. Or modify the assessments endpoint to include this mock data');
console.log('4. This will create a realistic assessment that the Reports UI can display properly');

// Export for potential use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { mockAssessmentData };
}
