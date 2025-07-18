import { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { corsHeaders } from "../shared/utils";

const httpTrigger = async function (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log('Processing best practices request');

    // Handle preflight OPTIONS request immediately
    if (req.method === 'OPTIONS') {
        return {
            status: 200,
            headers: corsHeaders
        };
    }

    // Handle HEAD request for API warmup
    if (req.method === 'HEAD') {
        return {
            status: 200,
            headers: corsHeaders
        };
    }

    try {
        if (req.method === 'GET') {
            // Return comprehensive M365 security best practices
            const bestPractices = [
                {
                    id: "mfa-enforcement",
                    category: "Identity & Access",
                    title: "Enforce Multi-Factor Authentication (MFA)",
                    description: "Enable MFA for all users, especially administrators, to significantly reduce account compromise risk.",
                    priority: "Critical",
                    implementation: "Configure Conditional Access policies to require MFA for all users",
                    references: ["https://docs.microsoft.com/en-us/azure/active-directory/authentication/concept-mfa-howitworks"]
                },
                {
                    id: "conditional-access",
                    category: "Identity & Access",
                    title: "Implement Conditional Access Policies",
                    description: "Use location, device, and risk-based policies to control access to resources",
                    priority: "High",
                    implementation: "Create policies based on user risk, sign-in risk, device compliance, and location",
                    references: ["https://docs.microsoft.com/en-us/azure/active-directory/conditional-access/"]
                },
                {
                    id: "privileged-access",
                    category: "Identity & Access",
                    title: "Secure Privileged Access",
                    description: "Implement Privileged Identity Management (PIM) for just-in-time access",
                    priority: "Critical",
                    implementation: "Enable PIM for all administrative roles and require approval workflows",
                    references: ["https://docs.microsoft.com/en-us/azure/active-directory/privileged-identity-management/"]
                },
                {
                    id: "dlp-policies",
                    category: "Data Protection",
                    title: "Data Loss Prevention (DLP)",
                    description: "Prevent sensitive data from being shared inappropriately",
                    priority: "High",
                    implementation: "Configure DLP policies for sensitive data types across Exchange, SharePoint, and Teams",
                    references: ["https://docs.microsoft.com/en-us/microsoft-365/compliance/dlp-learn-about-dlp"]
                },
                {
                    id: "defender-office365",
                    category: "Threat Protection",
                    title: "Microsoft Defender for Office 365",
                    description: "Protect against advanced threats in email and collaboration tools",
                    priority: "High",
                    implementation: "Enable Safe Attachments, Safe Links, and anti-phishing policies",
                    references: ["https://docs.microsoft.com/en-us/microsoft-365/security/office-365-security/"]
                },
                {
                    id: "information-protection",
                    category: "Data Protection",
                    title: "Microsoft Information Protection",
                    description: "Classify and protect sensitive information with labels and policies",
                    priority: "Medium",
                    implementation: "Deploy sensitivity labels and configure automatic classification",
                    references: ["https://docs.microsoft.com/en-us/microsoft-365/compliance/information-protection"]
                },
                {
                    id: "cloud-app-security",
                    category: "Cloud Security",
                    title: "Microsoft Cloud App Security",
                    description: "Monitor and control cloud app usage and detect anomalous behavior",
                    priority: "Medium",
                    implementation: "Deploy Cloud App Security connectors and configure policies",
                    references: ["https://docs.microsoft.com/en-us/cloud-app-security/"]
                },
                {
                    id: "device-compliance",
                    category: "Device Management",
                    title: "Device Compliance Policies",
                    description: "Ensure devices meet security requirements before accessing corporate resources",
                    priority: "High",
                    implementation: "Configure Intune compliance policies and conditional access",
                    references: ["https://docs.microsoft.com/en-us/mem/intune/protect/device-compliance-get-started"]
                }
            ];

            return {
                status: 200,
                headers: corsHeaders,
                jsonBody: {
                    success: true,
                    data: bestPractices,
                    count: bestPractices.length,
                    timestamp: new Date().toISOString()
                }
            };
        }

        return {
            status: 405,
            headers: corsHeaders,
            jsonBody: {
                success: false,
                error: "Method not allowed"
            }
        };

    } catch (error) {
        context.error('Error in best practices handler:', error);
        
        return {
            status: 500,
            headers: corsHeaders,
            jsonBody: {
                success: false,
                error: "Internal server error",
                details: error instanceof Error ? error.message : "Unknown error"
            }
        };
    }
};

export default httpTrigger;
