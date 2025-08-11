import React, { useState, useEffect } from 'react';
import { useCustomer } from '../contexts/CustomerContext';
import { Customer, CustomerService } from '../services/customerService';
import { AssessmentService } from '../services/assessmentService';
import { secureScoreControlService } from '../utils/secureScoreControlService';
import { 
  getReadableControlName, 
  getStandardizedStatus, 
  generateRemediationText, 
  calculateMaxScore, 
  determineActionType 
} from '../utils/secureScoreFormatter';
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
  controlScores?: any[]; // Optional field for secure score control data
}

// Function to estimate license cost based on license type (approximate pricing)
const getEstimatedLicenseCost = (licenseName: string): number => {
  const licenseNameLower = licenseName.toLowerCase();
  
  // Estimated monthly costs per user (in USD) based on typical Microsoft pricing
  const pricingMap: { [key: string]: number } = {
    // Microsoft 365 Plans
    'microsoft 365 e5': 57,
    'microsoft 365 e3': 36,
    'microsoft 365 f3': 10,
    'microsoft 365 f1': 4,
    'microsoft 365 business premium': 22,
    'microsoft 365 business standard': 15,
    'microsoft 365 business basic': 6,
    
    // Office 365 Plans
    'office 365 e5': 35,
    'office 365 e3': 23,
    'office 365 f3': 8,
    'office 365 e1': 8,
    
    // Exchange Plans
    'exchange online plan 2': 8,
    'exchange online plan 1': 4,
    'exchange online': 4,
    
    // Teams Plans
    'microsoft teams': 0, // Often included in other plans
    'teams exploratory': 0,
    
    // Power Platform
    'power bi pro': 10,
    'power bi premium': 20,
    'power apps': 20,
    'power automate': 15,
    
    // Azure AD Plans
    'azure active directory premium': 6,
    'azure active directory premium p2': 9,
    'azure ad premium': 6,
    
    // Security Plans
    'microsoft defender': 3,
    'enterprise mobility + security': 8.25,
    
    // Project & Visio
    'project online professional': 30,
    'project online essentials': 7,
    'visio online plan 1': 5,
    'visio online plan 2': 15,
    'visio pro for office 365': 15,
    
    // Developer Plans
    'visual studio': 45,
    'developer': 0,
    
    // SharePoint
    'sharepoint online': 5,
    
    // OneDrive
    'onedrive for business': 5
  };
  
  // Check for exact matches first
  if (pricingMap[licenseNameLower]) {
    return pricingMap[licenseNameLower];
  }
  
  // Check for partial matches
  for (const [key, price] of Object.entries(pricingMap)) {
    if (licenseNameLower.includes(key) || key.includes(licenseNameLower)) {
      return price;
    }
  }
  
  // Try to categorize by common keywords
  if (licenseNameLower.includes('e5')) return 50;
  if (licenseNameLower.includes('e3')) return 30;
  if (licenseNameLower.includes('f3')) return 8;
  if (licenseNameLower.includes('f1')) return 4;
  if (licenseNameLower.includes('premium')) return 20;
  if (licenseNameLower.includes('pro')) return 15;
  if (licenseNameLower.includes('standard')) return 12;
  if (licenseNameLower.includes('basic')) return 6;
  if (licenseNameLower.includes('essentials')) return 8;
  if (licenseNameLower.includes('trial') || licenseNameLower.includes('developer')) return 0;
  
  // Default fallback for unknown licenses
  return 10;
};

const Reports: React.FC = () => {
  const { selectedCustomer, setSelectedCustomer } = useCustomer();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [activeTab, setActiveTab] = useState<string>('license');
  const [customerAssessment, setCustomerAssessment] = useState<any>(null);
  const [availableAssessments, setAvailableAssessments] = useState<any[]>([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(null);
  const [reportData, setReportData] = useState<ReportData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creatingAssessment, setCreatingAssessment] = useState(false);
  const [createAssessmentResult, setCreateAssessmentResult] = useState<string | null>(null);
  const [customLicenseCosts, setCustomLicenseCosts] = useState<{ [licenseName: string]: number }>({});

  // Sorting state for tables
  const [licenseSortConfig, setLicenseSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>(null);
  
  const [secureScoreSortConfig, setSecureScoreSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>(null);

  // Function to get effective license cost (custom or estimated)
  const getEffectiveLicenseCost = (licenseName: string): number => {
    const formattedName = formatLicenseName(licenseName);
    
    // Check if user has set a custom cost for this license
    if (customLicenseCosts[formattedName] !== undefined) {
      return customLicenseCosts[formattedName];
    }
    
    // Fall back to estimated cost
    return getEstimatedLicenseCost(licenseName);
  };

  // Function to update custom license cost
  const updateCustomLicenseCost = (licenseName: string, cost: number) => {
    const formattedName = formatLicenseName(licenseName);
    setCustomLicenseCosts(prev => ({
      ...prev,
      [formattedName]: cost
    }));
  };

  // Function to reset custom license cost to estimated
  const resetCustomLicenseCost = (licenseName: string) => {
    const formattedName = formatLicenseName(licenseName);
    setCustomLicenseCosts(prev => {
      const newCosts = { ...prev };
      delete newCosts[formattedName];
      return newCosts;
    });
  };

  // Sorting functions
  const handleLicenseSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    
    if (licenseSortConfig && licenseSortConfig.key === key && licenseSortConfig.direction === 'asc') {
      direction = 'desc';
    }
    
    setLicenseSortConfig({ key, direction });
  };

  const handleSecureScoreSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    
    if (secureScoreSortConfig && secureScoreSortConfig.key === key && secureScoreSortConfig.direction === 'asc') {
      direction = 'desc';
    }
    
    setSecureScoreSortConfig({ key, direction });
  };

  const sortLicenseData = (data: any[]) => {
    if (!licenseSortConfig) return data;

    return [...data].sort((a, b) => {
      const { key, direction } = licenseSortConfig;
      let aValue, bValue;

      switch (key) {
        case 'name':
          aValue = formatLicenseName(a.name).toLowerCase();
          bValue = formatLicenseName(b.name).toLowerCase();
          break;
        case 'assigned':
          aValue = a.assigned;
          bValue = b.assigned;
          break;
        case 'free':
          aValue = a.total - a.assigned;
          bValue = b.total - b.assigned;
          break;
        case 'total':
          aValue = a.total;
          bValue = b.total;
          break;
        case 'utilization':
          aValue = a.total > 0 ? (a.assigned / a.total) * 100 : 0;
          bValue = b.total > 0 ? (b.assigned / b.total) * 100 : 0;
          break;
        case 'cost':
          aValue = getEffectiveLicenseCost(a.name);
          bValue = getEffectiveLicenseCost(b.name);
          break;
        case 'usedCost':
          aValue = getEffectiveLicenseCost(a.name) * a.assigned;
          bValue = getEffectiveLicenseCost(b.name) * b.assigned;
          break;
        case 'totalCost':
          aValue = getEffectiveLicenseCost(a.name) * a.total;
          bValue = getEffectiveLicenseCost(b.name) * b.total;
          break;
        case 'waste':
          aValue = getEffectiveLicenseCost(a.name) * (a.total - a.assigned);
          bValue = getEffectiveLicenseCost(b.name) * (b.total - b.assigned);
          break;
        default:
          return 0;
      }

      if (typeof aValue === 'string') {
        return direction === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return direction === 'asc' ? aValue - bValue : bValue - aValue;
    });
  };

  const sortSecureScoreData = (data: any[]) => {
    if (!secureScoreSortConfig) return data;

    return [...data].sort((a, b) => {
      const { key, direction } = secureScoreSortConfig;
      let aValue, bValue;

      switch (key) {
        case 'controlName':
          aValue = a.controlName.toLowerCase();
          bValue = b.controlName.toLowerCase();
          break;
        case 'category':
          aValue = a.category.toLowerCase();
          bValue = b.category.toLowerCase();
          break;
        case 'currentScore':
          aValue = a.currentScore;
          bValue = b.currentScore;
          break;
        case 'maxScore':
          aValue = a.maxScore;
          bValue = b.maxScore;
          break;
        case 'scoreGap':
          aValue = a.scoreGap;
          bValue = b.scoreGap;
          break;
        case 'status':
          aValue = a.implementationStatus.toLowerCase();
          bValue = b.implementationStatus.toLowerCase();
          break;
        case 'actionType':
          aValue = (a.actionType || 'Other').toLowerCase();
          bValue = (b.actionType || 'Other').toLowerCase();
          break;
        default:
          return 0;
      }

      if (typeof aValue === 'string') {
        return direction === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return direction === 'asc' ? aValue - bValue : bValue - aValue;
    });
  };

  const getSortIcon = (columnKey: string, sortConfig: any) => {
    if (!sortConfig || sortConfig.key !== columnKey) {
      return '↕️'; // Unsorted
    }
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };
  
  // Function to format license names for better readability
  const formatLicenseName = (rawName: string): string => {
    if (!rawName) return 'Unknown License';
    
    // First, normalize the input by removing extra spaces and converting to uppercase
    const normalizedName = rawName.replace(/\s+/g, '').toUpperCase();
    
    // Comprehensive license name mappings for better readability
    const nameMap: { [key: string]: string } = {
      // Microsoft 365 Plans
      'MICROSOFT_365_E3': 'Microsoft 365 E3',
      'MICROSOFT_365_E5': 'Microsoft 365 E5',
      'MICROSOFT_365_F3': 'Microsoft 365 F3',
      'MICROSOFT_365_F1': 'Microsoft 365 F1',
      'MICROSOFT365E3': 'Microsoft 365 E3',
      'MICROSOFT365E5': 'Microsoft 365 E5',
      'MICROSOFT365F3': 'Microsoft 365 F3',
      'MICROSOFT365F1': 'Microsoft 365 F1',
      'SPE_E3': 'Microsoft 365 E3',
      'SPE_E5': 'Microsoft 365 E5',
      'SPE_F1': 'Microsoft 365 F1',
      'SPEE3': 'Microsoft 365 E3',
      'SPEE5': 'Microsoft 365 E5',
      'SPEF1': 'Microsoft 365 F1',
      
      // Office 365 Plans
      'OFFICE_365_E3': 'Office 365 E3',
      'OFFICE_365_E5': 'Office 365 E5',
      'OFFICE_365_F3': 'Office 365 F3',
      'OFFICE365E3': 'Office 365 E3',
      'OFFICE365E5': 'Office 365 E5',
      'OFFICE365F3': 'Office 365 F3',
      'ENTERPRISEPACK': 'Office 365 E3',
      'ENTERPRISEPREMIUM': 'Office 365 E5',
      'DESKLESSPACK': 'Office 365 F3',
      
      // Business Plans
      'MICROSOFT_365_BUSINESS_PREMIUM': 'Microsoft 365 Business Premium',
      'MICROSOFT_365_BUSINESS_STANDARD': 'Microsoft 365 Business Standard',
      'MICROSOFT_365_BUSINESS_BASIC': 'Microsoft 365 Business Basic',
      'MICROSOFT365BUSINESSPREMIUM': 'Microsoft 365 Business Premium',
      'MICROSOFT365BUSINESSSTANDARD': 'Microsoft 365 Business Standard',
      'MICROSOFT365BUSINESSBASIC': 'Microsoft 365 Business Basic',
      
      // Power Platform
      'POWER_BI_PRO': 'Power BI Pro',
      'POWER_BI_PREMIUM': 'Power BI Premium',
      'POWER_BI_STANDARD': 'Power BI Standard',
      'POWERBI_PRO': 'Power BI Pro',
      'POWERBIPRO': 'Power BI Pro',
      'POWERBIPREMIUM': 'Power BI Premium',
      'POWERBISTANDARD': 'Power BI Standard',
      'POWERAPPS_VIRAL': 'Power Apps (Viral)',
      'POWERAPPSDEV': 'Power Apps for Developer',
      'POWERAPPSPDEVL': 'Power Apps Plan 1',
      'POWERAPPSPPLAN2': 'Power Apps Plan 2',
      'POWER_APPS_DEV': 'Power Apps Developer',
      'POWER_APPS_D_E_V': 'Power Apps Developer',
      'POWER_AUTOMATE_USER': 'Power Automate User',
      'POWERAUTOMATEUSER': 'Power Automate User',
      
      // Exchange
      'EXCHANGE_S_ENTERPRISE': 'Exchange Online Plan 2',
      'EXCHANGE_S_STANDARD': 'Exchange Online Plan 1',
      'EXCHANGEONLINEPLAN1': 'Exchange Online Plan 1',
      'EXCHANGEONLINEPLAN2': 'Exchange Online Plan 2',
      'EXCHANGE_ONLINE_PLAN_1': 'Exchange Online Plan 1',
      'EXCHANGE_ONLINE_PLAN_2': 'Exchange Online Plan 2',
      
      // Teams & Communication
      'TEAMS_EXPLORATORY': 'Microsoft Teams Exploratory',
      'TEAMSEXPLORATORY': 'Microsoft Teams Exploratory',
      'TEAMS_PHONE': 'Microsoft Teams Phone',
      'TEAMSPHONE': 'Microsoft Teams Phone',
      'TEAMS_ROOMS': 'Microsoft Teams Rooms',
      'TEAMSROOMS': 'Microsoft Teams Rooms',
      'PHONESYSTEMVIRTUALUSER': 'Phone System Virtual User',
      'PHONE_SYSTEM_VIRTUAL_USER': 'Phone System Virtual User',
      'PHONESYSTEM': 'Phone System',
      'MCOMEETADV': 'Microsoft 365 Audio Conferencing',
      'MCOEV': 'Microsoft Cloud App Security',
      'M_C_O_E_V': 'Microsoft Cloud App Security',
      
      // Azure AD
      'AAD_PREMIUM': 'Azure Active Directory Premium P1',
      'AAD_PREMIUM_P2': 'Azure Active Directory Premium P2',
      'AADPREMIUM': 'Azure Active Directory Premium P1',
      'AADPREMIUMP2': 'Azure Active Directory Premium P2',
      'AZURE_AD_PREMIUM': 'Azure Active Directory Premium P1',
      'AZUREADPREMIUM': 'Azure Active Directory Premium P1',
      
      // Project & Visio
      'PROJECTPROFESSIONAL': 'Project Online Professional',
      'PROJECT_PROFESSIONAL': 'Project Online Professional',
      'PROJECTP1': 'Project Plan 1',
      'PROJECTPI': 'Project Plan 1',
      'P_R_O_J_E_C_T_P_1': 'Project Plan 1',
      'VISIOONLINE_PLAN1': 'Visio Online Plan 1',
      'VISIOCLIENT': 'Visio Pro for Office 365',
      'VISIO_ONLINE_PLAN_1': 'Visio Online Plan 1',
      'VISIO_PRO': 'Visio Pro for Office 365',
      
      // Security & Compliance
      'MICROSOFT_DEFENDER': 'Microsoft Defender',
      'MICROSOFTDEFENDER': 'Microsoft Defender',
      'ENTERPRISE_MOBILITY_SECURITY': 'Enterprise Mobility + Security',
      'EMS': 'Enterprise Mobility + Security',
      'AZURE_INFORMATION_PROTECTION': 'Azure Information Protection',
      'INTUNE_A': 'Microsoft Intune',
      'INTUNE': 'Microsoft Intune',
      'MICROSOFT_INTUNE_SUITE': 'Microsoft Intune Suite',
      'MICROSOFTINTUNESUITE': 'Microsoft Intune Suite',
      
      // SharePoint & OneDrive
      'SHAREPOINT_ONLINE_PLAN_1': 'SharePoint Online Plan 1',
      'SHAREPOINT_ONLINE_PLAN_2': 'SharePoint Online Plan 2',
      'SHAREPOINTONLINE': 'SharePoint Online',
      'SPB': 'SharePoint Plan B',
      'S_P_B': 'SharePoint Plan B',
      'ONEDRIVE_FOR_BUSINESS': 'OneDrive for Business',
      'ONEDRIVESTANDALONE': 'OneDrive for Business',
      
      // Dynamics
      'DYNAMICS_365_BUSINESS_CENTRAL': 'Dynamics 365 Business Central',
      'DYNAMICS365BUSINESSCENTRAL': 'Dynamics 365 Business Central',
      
      // Windows & Store
      'WINDOWS_STORE': 'Windows Store for Business',
      'WINDOWSSTORE': 'Windows Store for Business',
      'WINDOWSDEFENDER': 'Windows Defender',
      'W_I_N_D_O_W_S_S_T_O_R_E': 'Windows Store for Business',
      
      // Flow & Forms
      'FLOWFREE': 'Power Automate (Free)',
      'FLOW_FREE': 'Power Automate (Free)',
      'F_L_O_W_F_R_E_E': 'Power Automate (Free)',
      'FLOW': 'Power Automate',
      'FORMSPRO': 'Microsoft Forms Pro',
      'FORMS_PRO': 'Microsoft Forms Pro',
      'F_O_R_M_S_P_R_O': 'Microsoft Forms Pro',
      'MICROSOFTFORMSPRO': 'Microsoft Forms Pro',
      
      // Additional spaced variants
      'F L O W F R E E': 'Power Automate (Free)',
      'S P B': 'SharePoint Plan B',
      'M C O E V': 'Microsoft Cloud App Security',
      'P R O J E C T P 1': 'Project Plan 1',
      'P H O N E S Y S T E M V I R T U A L U S E R': 'Phone System Virtual User',
      'W I N D O W S S T O R E': 'Windows Store for Business',
      'R M S B A S I C': 'Rights Management Service Basic',
      'C C I B O T S P R I V P R E V V I R A L': 'Copilot Studio (Trial)',
      
      // Copilot & AI
      'CCIBOTSPREMIUM': 'Copilot Studio Premium',
      'CCIBOTSPRIVPREVVIRAL': 'Copilot Studio (Trial)',
      'C_C_I_B_O_T_S_P_R_I_V_P_R_E_V_V_I_R_A_L': 'Copilot Studio (Trial)',
      'MICROSOFT_365_COPILOT': 'Microsoft 365 Copilot',
      'MICROSOFT365COPILOT': 'Microsoft 365 Copilot',
      
      // Rights Management
      'RMSBASIC': 'Rights Management Service Basic',
      'RMS_BASIC': 'Rights Management Service Basic',
      'R_M_S_B_A_S_I_C': 'Rights Management Service Basic',
      
      // Developer & Trial
      'DEVELOPERPACK': 'Developer Pack',
      'DEVELOPER': 'Developer',
      'TRIAL': 'Trial',
      'FREE': 'Free'
    };
    
    // Check if we have a direct mapping
    if (nameMap[normalizedName]) {
      return nameMap[normalizedName];
    }
    
    // Special handling for spaced out letters (like "F L O W F R E E")
    if (rawName.includes(' ')) {
      // First try direct mapping of the spaced version
      if (nameMap[rawName.toUpperCase()]) {
        return nameMap[rawName.toUpperCase()];
      }
      
      // Then try removing all spaces and checking again
      const compactName = rawName.replace(/\s+/g, '').toUpperCase();
      if (nameMap[compactName]) {
        return nameMap[compactName];
      }
    }
    
    // Clean up the name using intelligent processing
    let cleanName = rawName;
    
    // Handle spaced letters more comprehensively (e.g., "F L O W F R E E" -> "FLOWFREE")
    if (/^[A-Z](\s+[A-Z])+\s*$/.test(rawName.trim())) {
      cleanName = rawName.replace(/\s+/g, '');
      // Check again with the compacted name
      if (nameMap[cleanName.toUpperCase()]) {
        return nameMap[cleanName.toUpperCase()];
      }
    }
    
    // Handle mixed case with spaces that might be SKU names
    if (/^[A-Z\s]+$/.test(rawName) && rawName.includes(' ')) {
      const compactedName = rawName.replace(/\s+/g, '').toUpperCase();
      if (nameMap[compactedName]) {
        return nameMap[compactedName];
      }
    }
    
    // Replace underscores with spaces and handle camelCase
    cleanName = cleanName
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Capitalize each word properly
    return cleanName
      .split(' ')
      .map(word => {
        if (word.length <= 1) return word.toUpperCase();
        if (['AND', 'FOR', 'OF', 'THE', 'A', 'AN'].includes(word.toUpperCase())) {
          return word.toLowerCase();
        }
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' ')
      .replace(/\b(E|F|P)\d+\b/g, match => match.toUpperCase()) // Keep E3, F1, P1 etc. uppercase
      .replace(/\bMicrosoft\b/gi, 'Microsoft')
      .replace(/\bOffice\b/gi, 'Office')
      .replace(/\bPower\b/gi, 'Power')
      .replace(/\bAzure\b/gi, 'Azure')
      .replace(/\bOnedrive\b/gi, 'OneDrive')
      .replace(/\bSharepoint\b/gi, 'SharePoint');
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
        includedCategories: ['license', 'secureScore', 'identity', 'endpoint'], // include endpoint for debug
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
      id: 'endpoint',
      name: 'Endpoint Protection',
      icon: '💻',
      description: 'Device compliance and endpoint protection status'
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
    // Preload secure score control profiles for enhanced display names
    secureScoreControlService.preloadControlProfiles().then(() => {
      const stats = secureScoreControlService.getCacheStats();
      console.log('Control service preload completed:', stats);
    }).catch(error => {
      console.warn('Failed to preload control profiles:', error);
    });
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

  // Function to handle assessment selection
  const handleAssessmentSelection = async (assessmentId: string) => {
    setSelectedAssessmentId(assessmentId);
    // Find the selected assessment and set it as current
    const selectedAssessment = availableAssessments.find(a => a.id === assessmentId);
    if (selectedAssessment) {
      setCustomerAssessment(selectedAssessment);
      // Regenerate reports for the selected assessment
      await generateReportsForAssessment(selectedAssessment);
    }
  };

  // Function to generate reports for a specific assessment
  const generateReportsForAssessment = async (assessment: any) => {
    console.log('=== GENERATING REPORT DATA ===');
    console.log('Full assessment object:', assessment);
    console.log('Assessment metrics:', assessment.metrics);
    console.log('Assessment realData:', assessment.metrics?.realData);

    const reports: ReportData[] = [];

    // Process license data
    if (assessment.metrics?.realData?.licenseInfo || assessment.metrics?.licenseInfo) {
      const licenseData = assessment.metrics?.realData?.licenseInfo || assessment.metrics?.licenseInfo;
      console.log('Processing license data:', licenseData);
      
      // Check if it's the old format (single object) or new format (array)
      const info = Array.isArray(licenseData) ? licenseData[0] : licenseData;
      
      if (info && typeof info === 'object') {
        // Handle both old format (summary data) and new format (detailed data)
        if (info.totalLicenses !== undefined || info.assignedLicenses !== undefined) {
          // Old format - direct summary values
          const totalLicenses = Number(info.totalLicenses) || 0;
          const assignedLicenses = Number(info.assignedLicenses) || 0;
          const unutilizedLicenses = totalLicenses - assignedLicenses;
          const utilizationRate = totalLicenses > 0 ? Math.round((assignedLicenses / totalLicenses) * 100) : 0;

          // Process license details from the API response structure
          const licenseDetails = info.licenseDetails || [];
          console.log('Processing license details:', licenseDetails);

          // Group license details by SKU and sum up the values
          const licenseTypeMap = new Map<string, { name: string; assigned: number; total: number; skuPartNumber: string; cost: number }>();
          
          licenseDetails.forEach((license: any) => {
            const skuName = license.skuPartNumber || license.skuDisplayName || license.servicePlanName || 'Unknown License';
            
            // Handle Microsoft Graph API license structure from /subscribedSkus endpoint
            const assignedUnits = Number(license.assignedUnits) || 
                                 Number(license.consumedUnits) || 
                                 Number(license.prepaidUnits?.consumed) || 0;
            
            const totalUnits = Number(license.totalUnits) || 
                             Number(license.prepaidUnits?.enabled) || 
                             Number(license.prepaidUnits?.total) || 0;
            
            console.log(`Processing license: ${skuName}, assigned: ${assignedUnits}, total: ${totalUnits}`);
            console.log(`License structure:`, {
              skuPartNumber: license.skuPartNumber,
              consumedUnits: license.consumedUnits,
              prepaidUnits: license.prepaidUnits
            });
            
            if (licenseTypeMap.has(skuName)) {
              const existing = licenseTypeMap.get(skuName)!;
              existing.assigned += assignedUnits;
              existing.total += totalUnits;
            } else {
              licenseTypeMap.set(skuName, {
                name: skuName,
                assigned: assignedUnits,
                total: totalUnits,
                skuPartNumber: skuName,
                cost: getEffectiveLicenseCost(skuName)
              });
            }
          });

          // Convert to array and show all licenses with any units (total > 0)
          const processedLicenseTypes = Array.from(licenseTypeMap.values())
            .filter(license => license.total > 0) // Show all licenses with any units
            .sort((a, b) => b.assigned - a.assigned);

          console.log('Processed license types:', processedLicenseTypes);

          reports.push({
            category: 'license',
            metrics: {
              totalLicenses,
              assignedLicenses,
              unutilizedLicenses,
              utilizationRate,
              costData: {
                // Calculate estimated monthly cost based on license types and their typical pricing
                totalMonthlyCost: processedLicenseTypes.reduce((sum: number, license: any) => {
                  const effectiveCost = getEffectiveLicenseCost(license.name);
                  return sum + (license.assigned * effectiveCost);
                }, 0),
                unutilizedCost: processedLicenseTypes.reduce((sum: number, license: any) => {
                  const effectiveCost = getEffectiveLicenseCost(license.name);
                  const unutilized = license.total - license.assigned;
                  return sum + (unutilized * effectiveCost);
                }, 0),
                potentialSavings: processedLicenseTypes.reduce((sum: number, license: any) => {
                  const effectiveCost = getEffectiveLicenseCost(license.name);
                  const unutilized = license.total - license.assigned;
                  return sum + (unutilized * effectiveCost * 0.8); // 80% of unutilized cost
                }, 0)
              },
              licenseTypes: processedLicenseTypes,
              summary: {
                mostUsedLicense: processedLicenseTypes[0]?.name || 'N/A',
                leastUsedLicense: processedLicenseTypes[processedLicenseTypes.length - 1]?.name || 'N/A',
                recommendedActions: [
                  utilizationRate < 70 ? 'Consider reducing unused licenses' : 'License usage is optimal',
                  'Review license assignments quarterly',
                  'Consider license pooling for better efficiency'
                ]
              }
            },
            charts: [],
            insights: [
              `Total licenses: ${totalLicenses.toLocaleString()}`,
              `Assigned licenses: ${assignedLicenses.toLocaleString()} (${utilizationRate}%)`,
              `Unutilized licenses: ${unutilizedLicenses.toLocaleString()}`,
              `Most used license: ${processedLicenseTypes[0] ? formatLicenseName(processedLicenseTypes[0].name) : 'N/A'}`,
              utilizationRate < 60 ? 'License utilization is below optimal levels' :
              utilizationRate < 80 ? 'License utilization is moderate' :
              'License utilization is good'
            ],
            recommendations: [
              utilizationRate < 70 ? 'Consider reducing unused licenses to save costs' : 'Monitor license usage regularly',
              'Review license assignments quarterly',
              'Consider license pooling for better efficiency',
              'Upgrade high-usage users to premium licenses when appropriate',
              unutilizedLicenses > 10 ? 'Significant cost savings possible by reducing unused licenses' : 'License usage is well optimized'
            ]
          });
        } else {
          // New format - process license details directly
          const licenseDetails = info.licenseDetails || [];
          console.log('Processing license details (new format):', licenseDetails);

          const processedLicenseTypes = licenseDetails
            .filter((license: any) => license.totalUnits > 0 || license.assignedUnits > 0)
            .map((license: any) => {
              console.log(`Processing license: ${license.skuPartNumber}, assigned: ${license.assignedUnits}, total: ${license.totalUnits}`);
              return {
                name: formatLicenseName(license.skuPartNumber),
                assigned: license.assignedUnits || license.consumedUnits || 0,
                total: license.totalUnits || 0,
                available: (license.totalUnits || 0) - (license.assignedUnits || license.consumedUnits || 0),
                utilizationRate: license.totalUnits > 0 ? 
                  Math.round(((license.assignedUnits || license.consumedUnits || 0) / license.totalUnits) * 100) : 0,
                cost: getEffectiveLicenseCost(license.skuPartNumber),
                skuPartNumber: license.skuPartNumber
              };
            })
            .sort((a: any, b: any) => b.assigned - a.assigned);

          console.log('Processed license types:', processedLicenseTypes);

          const totalLicenses = processedLicenseTypes.reduce((sum: any, license: any) => sum + license.total, 0);
          const assignedLicenses = processedLicenseTypes.reduce((sum: any, license: any) => sum + license.assigned, 0);
          const unutilizedLicenses = totalLicenses - assignedLicenses;
          const utilizationRate = totalLicenses > 0 ? Math.round((assignedLicenses / totalLicenses) * 100) : 0;

          reports.push({
            category: 'license',
            metrics: {
              totalLicenses,
              assignedLicenses,
              unutilizedLicenses,
              utilizationRate,
              costData: {
                // Calculate estimated monthly cost based on license types and their typical pricing
                totalMonthlyCost: processedLicenseTypes.reduce((sum: number, license: any) => {
                  const effectiveCost = getEffectiveLicenseCost(license.name);
                  return sum + (license.assigned * effectiveCost);
                }, 0),
                unutilizedCost: processedLicenseTypes.reduce((sum: number, license: any) => {
                  const effectiveCost = getEffectiveLicenseCost(license.name);
                  const unutilized = license.total - license.assigned;
                  return sum + (unutilized * effectiveCost);
                }, 0),
                potentialSavings: processedLicenseTypes.reduce((sum: number, license: any) => {
                  const effectiveCost = getEffectiveLicenseCost(license.name);
                  const unutilized = license.total - license.assigned;
                  return sum + (unutilized * effectiveCost * 0.8); // 80% of unutilized cost
                }, 0)
              },
              licenseTypes: processedLicenseTypes,
              summary: {
                mostUsedLicense: processedLicenseTypes[0]?.name || 'N/A',
                leastUsedLicense: processedLicenseTypes[processedLicenseTypes.length - 1]?.name || 'N/A',
                recommendedActions: [
                  utilizationRate < 70 ? 'Consider reducing unused licenses' : 'License usage is optimal',
                  'Review license assignments quarterly',
                  'Consider license pooling for better efficiency'
                ]
              }
            },
            charts: [],
            insights: [
              `Total licenses: ${totalLicenses.toLocaleString()}`,
              `Assigned licenses: ${assignedLicenses.toLocaleString()} (${utilizationRate}%)`,
              `Unutilized licenses: ${unutilizedLicenses.toLocaleString()}`,
              `Most used license: ${processedLicenseTypes[0]?.name || 'N/A'}`,
              utilizationRate < 60 ? 'License utilization is below optimal levels' :
              utilizationRate < 80 ? 'License utilization is moderate' :
              'License utilization is good'
            ],
            recommendations: [
              utilizationRate < 70 ? 'Consider reducing unused licenses to save costs' : 'Monitor license usage regularly',
              'Review license assignments quarterly',
              'Consider license pooling for better efficiency',
              'Upgrade high-usage users to premium licenses when appropriate',
              unutilizedLicenses > 10 ? 'Significant cost savings possible by reducing unused licenses' : 'License usage is well optimized'
            ]
          });
        }
      }
    }

    // Process secure score data
    console.log('=== SECURE SCORE PROCESSING ===');
    const secureScoreData = assessment.metrics?.realData?.secureScore;
    console.log('Secure score raw data:', secureScoreData);
    console.log('Assessment status:', assessment.status);
    console.log('Has size limits:', assessment.status === 'completed_with_size_limit');
    
    if (secureScoreData && !secureScoreData.unavailable && secureScoreData.currentScore !== undefined) {
      console.log('=== PROCESSING SECURE SCORE DATA ===');
      
      // Handle both compressed and uncompressed control scores
      let controlScores = secureScoreData.controlScores || [];
      console.log('📋 Initial controlScores:', controlScores.length, 'items');
      console.log('📦 Data compressed?', secureScoreData.compressed);
      console.log('📊 Total controls found in assessment:', secureScoreData.totalControlsFound);
      console.log('📊 Controls stored count:', secureScoreData.controlsStoredCount);
      
      // Special handling for assessments with size limits
      const hasDataLimits = assessment.status === 'completed_with_size_limit';
      if (hasDataLimits) {
        console.log('⚠️ Assessment completed with size limits - adjusting processing');
      }
      
      if (secureScoreData.compressed && controlScores.length > 0) {
        // Decompress the control scores
        console.log('📦 Decompressing control scores data...');
        controlScores = controlScores.map((control: any) => ({
          controlName: control.n || control.controlName || 'Unknown Control',
          category: control.c || control.category || 'General',
          currentScore: control.cs || control.currentScore || 0,
          maxScore: control.ms || control.maxScore || 0,
          implementationStatus: control.s || control.implementationStatus || 'Not Implemented',
          actionType: control.at || control.actionType || 'Other',
          remediation: control.r || control.remediation || 'No remediation information available',
          scoreGap: (control.ms || control.maxScore || 0) - (control.cs || control.currentScore || 0)
        }));
        console.log(`✅ Decompressed ${controlScores.length} control scores`);
      } else if (controlScores.length > 0) {
        // Process uncompressed control scores and ensure they have all required fields
        console.log('📋 Processing uncompressed control scores...');
        controlScores = controlScores.map((control: any) => ({
          controlName: control.controlName || control.title || 'Unknown Control',
          category: control.category || control.controlCategory || 'General',
          currentScore: control.currentScore || control.score || 0,
          maxScore: control.maxScore || control.maxScore || 0,
          implementationStatus: control.implementationStatus || 'Not Implemented',
          actionType: control.actionType || 'Other',
          remediation: control.remediation || 'No remediation information available',
          scoreGap: (control.maxScore || 0) - (control.currentScore || control.score || 0)
        }));
        console.log(`✅ Processed ${controlScores.length} uncompressed control scores`);
      } else {
        console.log('⚠️ No control scores found in secureScoreData');
        // For assessments with size limits, we might still have the basic score even without detailed controls
        if (hasDataLimits && secureScoreData.currentScore !== undefined) {
          console.log('📊 Using basic secure score data without detailed controls due to size limits');
        }
      }
      
      // Calculate summary metrics for the table display
      const totalImplemented = controlScores.filter((c: any) => c.implementationStatus === 'Implemented' || c.currentScore > 0).length;
      const totalControls = controlScores.length;
      const controlsRemaining = totalControls - totalImplemented;
      const potentialScoreIncrease = controlScores.reduce((sum: number, control: any) => sum + (control.scoreGap || 0), 0);
      
      // Use actual counts from API when available, especially for size-limited assessments
      const actualTotalControls = secureScoreData.totalControlsFound || totalControls;
      const storedControlsCount = secureScoreData.controlsStoredCount || totalControls;
      
      console.log('=== FINAL SECURE SCORE REPORT CREATION ===');
      console.log('📊 Control scores length before slicing:', controlScores.length);
      console.log('📊 Actual total controls from API:', actualTotalControls);
      console.log('📊 Stored controls count:', storedControlsCount);
      console.log('📊 Control scores sample:', controlScores.slice(0, 3));
      console.log('📊 Will store ALL controls for display (no limit)');

      reports.push({
        category: 'secureScore',
        metrics: {
          currentScore: secureScoreData.currentScore,
          maxScore: secureScoreData.maxScore,
          percentage: secureScoreData.percentage,
          lastUpdated: secureScoreData.lastUpdated,
          totalControlsFound: secureScoreData.totalControlsFound
          // Removed: controlsStoredCount, compressed, hasDataLimits, dataLimitWarning, summary
        },
        // Store ALL controlScores for the table (no limit)
        controlScores: controlScores,
        charts: [],
        insights: [
          `Current secure score: ${secureScoreData.currentScore} out of ${secureScoreData.maxScore} points (${secureScoreData.percentage}%)`,
          hasDataLimits ? 
            `Assessment shows ${storedControlsCount} of ${actualTotalControls} security controls (data was limited due to size)` :
            `${totalImplemented} out of ${totalControls} security controls are implemented`,
          hasDataLimits ? 
            `Data collection was limited due to size constraints - contact your administrator for complete analysis` :
            `${controlsRemaining} security controls remaining to implement`,
          controlScores.length > 0 ? 
            `Potential score increase: ${potentialScoreIncrease.toFixed(1)} points available from shown controls` :
            'Detailed control analysis not available due to data size limits',
          secureScoreData.percentage < 40 ? 'Security posture needs immediate attention' : 
          secureScoreData.percentage < 70 ? 'Security posture needs significant improvement' : 
          secureScoreData.percentage < 85 ? 'Good security posture with room for improvement' : 
          'Excellent security posture - maintain current practices'
        ],
        recommendations: [
          // Generic recommendations based on security best practices
          'Focus on high-impact security controls first',
          'Prioritize controls with low implementation complexity',
          'Implement Multi-Factor Authentication for all users',
          'Enable Conditional Access policies',
          'Configure security defaults and advanced threat protection',
          'Regularly review and update security settings',
          // Add data limitation notice if applicable
          ...(hasDataLimits ? [
            'Note: This assessment was completed with size limits - some security controls may not be shown',
            'Consider running smaller, targeted assessments for complete control analysis',
            'Contact your administrator to increase data storage limits for comprehensive reports'
          ] : []),
          // Add specific recommended actions from the secure score data if available
          ...(secureScoreData.recommendedActions || []).map((action: any) => 
            action.title ? `${action.title}: ${action.action || action.description || 'Review this security control'}` : action
          ),
          // Add remediation advice from controls with the highest score gaps
          ...controlScores
            .filter((control: any) => control.scoreGap > 0 && control.remediation && control.remediation !== 'No remediation information available')
            .sort((a: any, b: any) => b.scoreGap - a.scoreGap)
            .slice(0, 5) // Top 5 highest impact improvements
            .map((control: any) => `${control.controlName}: ${control.remediation}`)
        ]
      });
      
      console.log('✅ Secure score report added to reports array');
      console.log('📊 Report controlScores length:', controlScores.length);
    }

    // Identity & Access Report
    const identityMetrics = assessment.metrics?.realData?.identityMetrics || assessment.metrics?.identityMetrics || {};
    
    // Debug: Log ALL assessment data to find identity information
    console.log('=== COMPLETE ASSESSMENT DEBUG ===');
    console.log('Full assessment object:', JSON.stringify(assessment, null, 2));
    console.log('Assessment.metrics keys:', Object.keys(assessment.metrics || {}));
    console.log('Assessment.metrics.realData keys:', Object.keys(assessment.metrics?.realData || {}));
    console.log('Assessment.metrics.realData full object:', JSON.stringify(assessment.metrics?.realData || {}, null, 2));
    
    // Look for identity data in various possible locations
    const possibleIdentityFields = [
      'identityMetrics',
      'identityData', 
      'authenticationMethods',
      'userRegistration',
      'identityAccessData',
      'identity',
      'users',
      'mfaData',
      'authMethods'
    ];
    
    console.log('=== SEARCHING FOR IDENTITY DATA ===');
    possibleIdentityFields.forEach(field => {
      const realDataValue = assessment.metrics?.realData?.[field];
      const metricsValue = assessment.metrics?.[field];
      console.log(`Field "${field}":`, {
        inRealData: realDataValue ? Object.keys(realDataValue) : 'not found',
        inMetrics: metricsValue ? Object.keys(metricsValue) : 'not found',
        realDataValue: realDataValue ? JSON.stringify(realDataValue).substring(0, 200) + '...' : 'none',
        metricsValue: metricsValue ? JSON.stringify(metricsValue).substring(0, 200) + '...' : 'none'
      });
    });
    
    // Also check if there are any fields containing "user" in their name
    console.log('=== CHECKING FOR USER-RELATED FIELDS ===');
    const allRealDataKeys = Object.keys(assessment.metrics?.realData || {});
    const allMetricsKeys = Object.keys(assessment.metrics || {});
    
    const userRelatedRealData = allRealDataKeys.filter(key => 
      key.toLowerCase().includes('user') || 
      key.toLowerCase().includes('auth') || 
      key.toLowerCase().includes('identity') ||
      key.toLowerCase().includes('mfa') ||
      key.toLowerCase().includes('registration')
    );
    const userRelatedMetrics = allMetricsKeys.filter(key => 
      key.toLowerCase().includes('user') || 
      key.toLowerCase().includes('auth') || 
      key.toLowerCase().includes('identity') ||
      key.toLowerCase().includes('mfa') ||
      key.toLowerCase().includes('registration')
    );
    
    console.log('User-related fields in realData:', userRelatedRealData);
    console.log('User-related fields in metrics:', userRelatedMetrics);
    
    userRelatedRealData.forEach(key => {
      console.log(`realData.${key}:`, assessment.metrics?.realData?.[key]);
    });
    
    userRelatedMetrics.forEach(key => {
      console.log(`metrics.${key}:`, assessment.metrics?.[key]);
    });
    
    // Enhanced identity data detection - check multiple levels
    let foundIdentityData = null;
    let identityDataSource = '';
    
    // Check all possible locations for identity data
    for (const field of possibleIdentityFields) {
      if (assessment.metrics?.realData?.[field]) {
        foundIdentityData = assessment.metrics.realData[field];
        identityDataSource = `realData.${field}`;
        console.log(`✅ Found identity data in: ${identityDataSource}`);
        break;
      } else if (assessment.metrics?.[field]) {
        foundIdentityData = assessment.metrics[field];
        identityDataSource = `metrics.${field}`;
        console.log(`✅ Found identity data in: ${identityDataSource}`);
        break;
      }
    }
    
    // If not found, check user-related fields
    if (!foundIdentityData) {
      for (const key of userRelatedRealData) {
        const data = assessment.metrics?.realData?.[key];
        if (data && typeof data === 'object' && (data.totalUsers !== undefined || data.length > 0 || data.users !== undefined)) {
          foundIdentityData = data;
          identityDataSource = `realData.${key}`;
          console.log(`✅ Found user data in: ${identityDataSource}`);
          break;
        }
      }
    }
    
    if (!foundIdentityData) {
      for (const key of userRelatedMetrics) {
        const data = assessment.metrics?.[key];
        if (data && typeof data === 'object' && (data.totalUsers !== undefined || data.length > 0 || data.users !== undefined)) {
          foundIdentityData = data;
          identityDataSource = `metrics.${key}`;
          console.log(`✅ Found user data in: ${identityDataSource}`);
          break;
        }
      }
    }
    
    console.log('=== IDENTITY METRICS FINAL DEBUG ===');
    console.log('Identity metrics object:', identityMetrics);
    console.log('Identity metrics keys:', Object.keys(identityMetrics));
    console.log('Found identity data:', foundIdentityData);
    console.log('Identity data source:', identityDataSource);
    console.log('Identity skipped?', identityMetrics.skipped);
    console.log('Identity error?', identityMetrics.error);
    console.log('Identity totalUsers?', identityMetrics.totalUsers);
    
    // Use found identity data or fall back to original approach
    const finalIdentityData = foundIdentityData || identityMetrics;
    console.log('=== USING IDENTITY DATA ===');
    console.log('Final identity data:', finalIdentityData);
    console.log('Final identity data keys:', Object.keys(finalIdentityData || {}));
    
    // Check if identity assessment was skipped or has errors
    if (finalIdentityData?.skipped) {
      reports.push({
        category: 'identity',
        metrics: {
          hasError: false,
          skipped: true,
          reason: finalIdentityData.reason || 'Identity assessment was not selected',
          message: 'This assessment category was not included in the current scan.'
        },
        charts: [],
        insights: [
          'Identity assessment was not requested for this scan',
          'To collect identity data, run a new assessment with "Identity & Access Management" selected',
          'Identity metrics include user counts, MFA coverage, admin users, and guest users'
        ],
        recommendations: [
          'Include Identity & Access Management in your next assessment',
          'Review user access patterns and privileged accounts regularly',
          'Implement Multi-Factor Authentication for all users'
        ]
      });
    } else if (finalIdentityData?.error) {
      reports.push({
        category: 'identity',
        metrics: {
          hasError: true,
          errorMessage: finalIdentityData.error,
          reason: 'Unable to collect identity data from Microsoft Graph API'
        },
        charts: [],
        insights: [
          'Identity data collection failed due to API access issues',
          'This may be related to permissions or connectivity problems',
          'Check Microsoft Graph API permissions and tenant access'
        ],
        recommendations: [
          'Verify Microsoft Graph API permissions are granted',
          'Ensure app registration has User.Read.All and Directory.Read.All permissions',
          'Check tenant connectivity and authentication status'
        ]
      });
    } else if (
      finalIdentityData &&
      (finalIdentityData.totalUsers !== undefined || 
       finalIdentityData.mfaEnabledUsers !== undefined || 
       finalIdentityData.adminUsers !== undefined ||
       finalIdentityData.summary?.totalUsers !== undefined ||
       finalIdentityData.users !== undefined ||
       finalIdentityData.authenticationMethods !== undefined)
    ) {
      // Try to extract user data from various possible structures
      const totalUsers = Number(finalIdentityData.totalUsers) || 
                        Number(finalIdentityData.summary?.totalUsers) || 
                        (finalIdentityData.users ? finalIdentityData.users.length : 0) || 0;
      const mfaEnabledUsers = Number(finalIdentityData.mfaEnabledUsers) || 
                             Number(finalIdentityData.summary?.mfaCapableUsers) || 0;
      const mfaDisabledUsers = totalUsers - mfaEnabledUsers;
      const mfaCoverage = finalIdentityData.mfaCoverage !== undefined ? 
                         Number(finalIdentityData.mfaCoverage) : 
                         (finalIdentityData.summary?.mfaCapablePercentage !== undefined ? 
                          Number(finalIdentityData.summary.mfaCapablePercentage) :
                          (totalUsers > 0 ? Math.round((mfaEnabledUsers / totalUsers) * 100) : 0));
      const adminUsers = Number(finalIdentityData.adminUsers) || 
                        Number(finalIdentityData.summary?.privilegedUsers) || 0;
      const guestUsers = Number(finalIdentityData.guestUsers) || 0;
      const regularUsers = totalUsers - adminUsers - guestUsers;
      const conditionalAccessPolicies = Number(finalIdentityData.conditionalAccessPolicies) || 0;
      
      console.log('=== PROCESSED IDENTITY METRICS ===');
      console.log('Processed values:', {
        totalUsers, mfaEnabledUsers, mfaCoverage, adminUsers, guestUsers, regularUsers
      });
      
      // Debug: Check if we're getting real values
      if (totalUsers === 0) {
        console.log('⚠️ WARNING: totalUsers is 0 - this might be why table shows no data');
      }
      if (adminUsers === 0 && guestUsers === 0 && regularUsers === 0) {
        console.log('⚠️ WARNING: All user categories are 0 - data might not be processing correctly');
      }
      
      console.log('Original finalIdentityData structure:');
      console.log('- finalIdentityData.totalUsers:', finalIdentityData.totalUsers);
      console.log('- finalIdentityData.adminUsers:', finalIdentityData.adminUsers);
      console.log('- finalIdentityData.guestUsers:', finalIdentityData.guestUsers);
      console.log('- finalIdentityData.summary?.totalUsers:', finalIdentityData.summary?.totalUsers);
      console.log('- finalIdentityData.summary?.privilegedUsers:', finalIdentityData.summary?.privilegedUsers);
      console.log('- finalIdentityData.users length:', finalIdentityData.users ? finalIdentityData.users.length : 'no users array');
      
      // Calculate dynamic risk levels based on actual conditions
      const adminPercentage = totalUsers > 0 ? Math.round((adminUsers / totalUsers) * 100) : 0;
      const guestPercentage = totalUsers > 0 ? Math.round((guestUsers / totalUsers) * 100) : 0;
      const regularPercentage = totalUsers > 0 ? Math.round((regularUsers / totalUsers) * 100) : 0;
      
      // Dynamic risk assessment based on security best practices
      const adminRisk = adminPercentage > 10 ? 'High' : adminPercentage > 5 ? 'Medium' : 'Low';
      const guestRisk = guestPercentage > 20 ? 'High' : guestPercentage > 10 ? 'Medium' : 'Low';
      const regularRisk = mfaCoverage < 30 ? 'High' : mfaCoverage < 70 ? 'Medium' : 'Low';
      
      // Create user breakdown data for table with dynamic risk assessment
      const userBreakdown = [
        { 
          type: 'Regular Users', 
          count: regularUsers, 
          percentage: regularPercentage, 
          risk: regularRisk,
          riskReason: mfaCoverage < 30 ? 'Low MFA coverage' : mfaCoverage < 70 ? 'Moderate MFA coverage' : 'Good MFA coverage'
        },
        { 
          type: 'Admin Users', 
          count: adminUsers, 
          percentage: adminPercentage, 
          risk: adminRisk,
          riskReason: adminPercentage > 10 ? 'Too many admins' : adminPercentage > 5 ? 'High admin ratio' : 'Appropriate admin ratio'
        },
        { 
          type: 'Guest Users', 
          count: guestUsers, 
          percentage: guestPercentage, 
          risk: guestRisk,
          riskReason: guestPercentage > 20 ? 'Excessive guest access' : guestPercentage > 10 ? 'Significant guest presence' : 'Managed guest access'
        }
      ];
      
      console.log('Generated userBreakdown:', userBreakdown);
      
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
    } else {
      // No identity data found - create a default "not available" report
      console.log('⚠️ No identity data found - creating default report');
      reports.push({
        category: 'identity',
        metrics: {
          hasError: false,
          skipped: true,
          reason: 'Identity data was not collected during this assessment',
          message: 'No identity metrics were found in the assessment data.'
        },
        charts: [],
        insights: [
          'Identity assessment data was not collected for this scan',
          'Identity metrics include user counts, MFA coverage, admin users, and guest users',
          'To collect identity data, ensure "Identity & Access Management" is selected during assessment creation'
        ],
        recommendations: [
          'Include Identity & Access Management in your next assessment',
          'Review user access patterns and privileged accounts regularly',
          'Implement Multi-Factor Authentication for all users',
          'Consider enabling Azure AD Premium features for advanced identity protection'
        ]
      });
    }

    // Endpoint / Device Compliance Report
    const endpointMetrics = assessment.metrics?.realData?.endpointMetrics || assessment.metrics?.endpointMetrics;
    if (endpointMetrics && (endpointMetrics.totalDevices !== undefined)) {
      const totalDevices = Number(endpointMetrics.totalDevices) || 0;
      const compliantDevices = Number(endpointMetrics.compliantDevices) || 0;
      const nonCompliantDevices = Number(endpointMetrics.nonCompliantDevices) || Math.max(0, totalDevices - compliantDevices);
      const complianceRate = Number(endpointMetrics.complianceRate) || (totalDevices > 0 ? Math.round((compliantDevices / totalDevices) * 100) : 0);
      const platformBreakdown = endpointMetrics.platformBreakdown || {};
      const sampleDevices = endpointMetrics.sample || endpointMetrics.sampleDevices || [];

      reports.push({
        category: 'endpoint',
        metrics: {
          totalDevices,
          compliantDevices,
          nonCompliantDevices,
          complianceRate,
          platformBreakdown,
          sampleCount: Array.isArray(sampleDevices) ? sampleDevices.length : 0
        },
        charts: [],
        insights: [
          `${complianceRate}% of devices are compliant (${compliantDevices}/${totalDevices})`,
          nonCompliantDevices > 0 ? `${nonCompliantDevices} devices are non-compliant` : 'All devices are compliant',
          Object.keys(platformBreakdown).length > 0 ? `Platforms: ${Object.entries(platformBreakdown).map(([k,v]) => `${k}: ${v}`).join(', ')}` : 'No platform breakdown available'
        ],
        recommendations: [
          complianceRate < 95 ? 'Review and remediate non-compliant devices' : 'Maintain device compliance',
          'Ensure device compliance policies are enforced via Intune',
          'Enable Microsoft Defender for Endpoint for advanced protection'
        ]
      });
    }

    console.log('=== FINAL REPORTS ARRAY ===');
    console.log('Reports generated:', reports.length);
    console.log('Report categories:', reports.map(r => r.category));

    setReportData(reports);
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

      // Store all available assessments for the selector
      setAvailableAssessments(customerAssessments);

      // Categorize assessments by status and data quality
      console.log('=== ASSESSMENT VALIDATION DEBUGGING ===');
      
      const validAssessments = customerAssessments.filter((a: any) => {
        const isCompleted = a.status === 'completed' || a.status === 'completed_with_size_limit'; // Allow both completed statuses
        const hasMetrics = a.metrics && typeof a.metrics === 'object';
        
        // For 'completed_with_size_limit', be more permissive about errors - they may still have good data
        const noError = a.status === 'completed_with_size_limit' ? true : !a.metrics?.error;
        
        // Be more flexible about data - check if there's any useful data structure
        const hasDataOrScore = a.metrics?.realData || a.metrics?.score || a.metrics?.dataCollected;
        
        console.log(`Assessment ${a.id}:`, {
          status: a.status,
          isCompleted,
          hasMetrics,
          noError,
          hasDataOrScore,
          hasRealData: !!a.metrics?.realData,
          hasScore: !!a.metrics?.score,
          hasDataCollected: !!a.metrics?.dataCollected,
          hasSecureScore: !!a.metrics?.realData?.secureScore,
          secureScoreAvailable: a.metrics?.realData?.secureScore && !a.metrics?.realData?.secureScore?.unavailable,
          metricsError: a.metrics?.error,
          metricsKeys: a.metrics ? Object.keys(a.metrics) : [],
          isValid: isCompleted && hasMetrics && noError && hasDataOrScore
        });
        
        return isCompleted && hasMetrics && noError && hasDataOrScore;
      });

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
        // First, try to find ANY assessment with secure score data (even from all assessments, not just valid ones)
        console.log('🔍 Searching for assessments with actual secure score data...');
        const assessmentsWithSecureScore = customerAssessments.filter((a: any) => {
          const hasSecureScore = a.metrics?.realData?.secureScore && !a.metrics?.realData?.secureScore?.unavailable;
          if (hasSecureScore) {
            console.log(`🎯 Found assessment with secure score: ${a.id} (status: ${a.status})`);
          }
          return hasSecureScore;
        });
        
        let autoSelectedAssessment;
        if (assessmentsWithSecureScore.length > 0) {
          // Use the most recent assessment with secure score data
          autoSelectedAssessment = assessmentsWithSecureScore.sort((a: any, b: any) => {
            const dateA = new Date(a.date || a.assessmentDate || a.lastModified || 0).getTime();
            const dateB = new Date(b.date || b.assessmentDate || b.lastModified || 0).getTime();
            return dateB - dateA;
          })[0];
          console.log('🎉 Auto-selected assessment with secure score data:', autoSelectedAssessment.id, 'from', autoSelectedAssessment.date || autoSelectedAssessment.assessmentDate);
        } else {
          // Fallback to prioritizing by date among valid assessments
          autoSelectedAssessment = validAssessments.sort((a: any, b: any) => {
            const dateA = new Date(a.date || a.assessmentDate || a.lastModified || 0).getTime();
            const dateB = new Date(b.date || b.assessmentDate || b.lastModified || 0).getTime();
            return dateB - dateA;
          })[0];
          console.log('✅ Auto-selected most recent valid assessment (no secure score found):', autoSelectedAssessment.id, 'from', autoSelectedAssessment.date || autoSelectedAssessment.assessmentDate);
        }

        // Use manually selected assessment if available, otherwise use auto-selected
        if (selectedAssessmentId) {
          const manuallySelected = customerAssessments.find(a => a.id === selectedAssessmentId);
          if (manuallySelected) {
            latestAssessment = manuallySelected;
            console.log('👤 Using manually selected assessment:', latestAssessment.id);
          } else {
            latestAssessment = autoSelectedAssessment;
            setSelectedAssessmentId(autoSelectedAssessment.id);
          }
        } else {
          latestAssessment = autoSelectedAssessment;
          setSelectedAssessmentId(autoSelectedAssessment.id);
        }
        
        console.log('Selected assessment has secure score:', !!latestAssessment.metrics?.realData?.secureScore && !latestAssessment.metrics?.realData?.secureScore?.unavailable);
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
        
        // Don't set error state if we have multiple assessments - let user choose different one
        if (customerAssessments.length === 1) {
          setError(errorMessage);
          const errorReport: ReportData = {
            category: 'error',
            metrics: {
              hasError: true,
              errorMessage: recentErrorAssessment.metrics?.error || recentErrorAssessment.metrics?.dataIssue?.reason || 'Unknown error',
              troubleshooting: recentErrorAssessment.metrics?.dataIssue?.troubleshooting || [],
              assessmentDate: recentErrorAssessment.date || recentErrorAssessment.assessmentDate
            },
            charts: [],
            insights: [
              recentErrorAssessment.metrics?.dataIssue?.reason || 'Assessment encountered an error during data collection',
              'This may be due to authentication issues or missing permissions',
              'Please check the troubleshooting steps below'
            ],
            recommendations: recentErrorAssessment.metrics?.dataIssue?.troubleshooting || [
              'Verify app registration credentials',
              'Ensure admin consent is granted',
              'Check required permissions are configured'
            ]
          };
          setReportData([errorReport]);
          return;
        }
        
        // If multiple assessments available, set error but continue
        setError(errorMessage);
        latestAssessment = recentErrorAssessment;
        setSelectedAssessmentId(recentErrorAssessment.id);
      } else {
        setError('No assessments found for this customer.');
        setCustomerAssessment(null);
        setReportData([]);
        return;
      }

      // Store all available assessments for the selector
      setAvailableAssessments(customerAssessments);
      setCustomerAssessment(latestAssessment);
      setSelectedAssessmentId(latestAssessment.id);

      // Generate reports for the selected assessment
      await generateReportsForAssessment(latestAssessment);

    } catch (error) {
      console.error('Error loading customer assessment:', error);
      setError('Failed to load customer assessment');
    } finally {
      setLoading(false);
    }
  };

  // Helper function to enhance control names asynchronously (non-blocking)
  const enhanceControlNamesAsync = async (controlScores: any[], rawControlScores: any[]) => {
    try {
      console.log('Starting background enhancement of control names...');
      let enhancementsMade = 0;
      
      for (let i = 0; i < controlScores.length && i < rawControlScores.length; i++) {
        const control = rawControlScores[i];
        const currentName = controlScores[i].controlName;
        
        try {
          // Try to get enhanced name from the service
          const enhancedName = await secureScoreControlService.getEnhancedControlName(
            control.controlName, 
            control.description || control.title
          );
          
          // Only update if we got a different (better) name
          if (enhancedName !== currentName && enhancedName.length > currentName.length) {
            controlScores[i].controlName = enhancedName;
            enhancementsMade++;
          }
        } catch (error) {
          // Silently continue if individual control enhancement fails
          console.warn(`Failed to enhance control name for ${control.controlName}:`, error);
        }
      }
      
      if (enhancementsMade > 0) {
        console.log(`Background enhancement completed: ${enhancementsMade} control names improved`);
        // Trigger a re-render with the enhanced names
        setReportData(prevReports => [...prevReports]);
      } else {
        console.log('Background enhancement completed: no improvements found');
      }
    } catch (error) {
      console.warn('Background control name enhancement failed:', error);
    }
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
      console.log('Tab data has controlScores:', tabData.controlScores ? 'YES' : 'NO');
      console.log('ControlScores length:', tabData.controlScores?.length);
      if (activeTab === 'secureScore') {
        console.log('Secure score tab data:', tabData.metrics);
        console.log('Secure score controlScores:', tabData.controlScores);
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

    // Sort the license data based on current sort configuration
    const sortedLicenseTypes = sortLicenseData(licenseTypes);

    return (
      <div className="license-table-container">
        <h4>License Details</h4>
        <div className="license-table-wrapper">
          <table className="license-table">
            <thead>
              <tr>
                <th 
                  className="sortable-header" 
                  onClick={() => handleLicenseSort('name')}
                  title="Click to sort by License Type"
                >
                  License Type {getSortIcon('name', licenseSortConfig)}
                </th>
                <th 
                  className="sortable-header" 
                  onClick={() => handleLicenseSort('assigned')}
                  title="Click to sort by Used licenses"
                >
                  Used {getSortIcon('assigned', licenseSortConfig)}
                </th>
                <th 
                  className="sortable-header" 
                  onClick={() => handleLicenseSort('free')}
                  title="Click to sort by Free licenses"
                >
                  Free {getSortIcon('free', licenseSortConfig)}
                </th>
                <th 
                  className="sortable-header" 
                  onClick={() => handleLicenseSort('total')}
                  title="Click to sort by Total licenses"
                >
                  Total {getSortIcon('total', licenseSortConfig)}
                </th>
                <th 
                  className="sortable-header" 
                  onClick={() => handleLicenseSort('utilization')}
                  title="Click to sort by Utilization percentage"
                >
                  Utilization {getSortIcon('utilization', licenseSortConfig)}
                </th>
                <th 
                  className="sortable-header" 
                  onClick={() => handleLicenseSort('cost')}
                  title="Click to sort by Cost per user"
                >
                  Cost/User/Month {getSortIcon('cost', licenseSortConfig)}
                </th>
                <th 
                  className="sortable-header" 
                  onClick={() => handleLicenseSort('usedCost')}
                  title="Click to sort by Used cost"
                >
                  Used Cost/Month {getSortIcon('usedCost', licenseSortConfig)}
                </th>
                <th 
                  className="sortable-header" 
                  onClick={() => handleLicenseSort('totalCost')}
                  title="Click to sort by Total cost"
                >
                  Total Cost/Month {getSortIcon('totalCost', licenseSortConfig)}
                </th>
                <th 
                  className="sortable-header" 
                  onClick={() => handleLicenseSort('waste')}
                  title="Click to sort by Waste amount"
                >
                  Waste/Month {getSortIcon('waste', licenseSortConfig)}
                </th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedLicenseTypes.map((license, index) => {
                const free = license.total - license.assigned;
                const utilization = license.total > 0 ? Math.round((license.assigned / license.total) * 100) : 0;
                const formattedLicenseName = formatLicenseName(license.name);
                const effectiveCost = getEffectiveLicenseCost(license.name);
                const usedCost = effectiveCost * license.assigned;
                const totalCost = effectiveCost * license.total;
                const wasteCost = effectiveCost * free;
                const isCustomCost = customLicenseCosts[formattedLicenseName] !== undefined;
                
                return (
                  <tr key={index}>
                    <td className="license-name-cell">
                      <span className="license-name-text">
                        {formattedLicenseName}
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
                    <td className="cost-cell">
                      <div className="cost-input-container">
                        <input
                          type="number"
                          className={`cost-input ${isCustomCost ? 'custom-cost' : ''}`}
                          value={effectiveCost}
                          min="0"
                          step="0.01"
                          onChange={(e) => {
                            const newCost = parseFloat(e.target.value) || 0;
                            updateCustomLicenseCost(license.name, newCost);
                          }}
                          title={isCustomCost ? 'Custom cost (click reset to use estimated)' : 'Estimated cost (edit to customize)'}
                        />
                        <span className="cost-currency">EUR</span>
                      </div>
                    </td>
                    <td className="used-cost-cell">
                      <span className={`cost-amount ${usedCost < 0 ? 'negative-cost' : ''}`}>
                        €{usedCost.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="total-cost-cell">
                      <span className={`cost-amount ${totalCost < 0 ? 'negative-cost' : ''}`}>
                        €{totalCost.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="waste-cost-cell">
                      <span className={`cost-amount ${wasteCost < 0 ? 'negative-cost' : wasteCost > 0 ? 'waste-highlight' : ''}`}>
                        €{wasteCost.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="actions-cell">
                      {isCustomCost && (
                        <button
                          className="reset-cost-btn"
                          onClick={() => resetCustomLicenseCost(license.name)}
                          title="Reset to estimated cost"
                        >
                          ↺
                        </button>
                      )}
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

  const renderSecureScoreTable = (metrics: any, controlScores?: any[]) => {
    console.log('=== RENDER SECURE SCORE TABLE ===');
    console.log('Metrics received:', metrics);
    console.log('ControlScores received:', controlScores);
    console.log('ControlScores length:', controlScores?.length);
    console.log('Metrics type:', typeof metrics);
    console.log('Has currentScore:', metrics?.currentScore !== undefined);
    console.log('currentScore value:', metrics?.currentScore);
    console.log('Has controlScores array:', Array.isArray(controlScores));
    console.log('First control score example:', controlScores?.[0]);
    
    if (!metrics || metrics.currentScore === undefined) {
      console.log('❌ No metrics or currentScore - showing fallback message');
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
            <ol style={{ margin: '0.5em 0 0 1.5em' }}>
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

    console.log('✅ Rendering secure score table with valid data');
    console.log(`📊 Score: ${metrics.currentScore}/${metrics.maxScore} (${metrics.percentage}%)`);
    console.log(`📋 Controls: ${controlScores?.length || 0} controls to display`);

    return (
      <div className="secure-score-container">
        {/* Security Controls Table */}
        <div className="security-controls-table">
          <h4>Security Controls Breakdown</h4>
          
          {/* Data limitation warning for size-limited assessments */}
          {metrics.hasDataLimits && (
            <div className="data-limit-warning">
              <span className="warning-icon">⚠️</span>
              <div className="warning-content">
                <strong>Assessment Completed with Data Limits</strong>
                <p>{metrics.dataLimitWarning}</p>
                <p>The secure score overview above shows complete data, but detailed control information may be truncated.</p>
              </div>
            </div>
          )}
          
          {/* Compression notice */}
          {metrics.compressed && (
            <div className="compression-notice">
              <span className="compression-icon">📦</span>
              <span className="compression-text">
                Showing {metrics.controlsStoredCount || metrics.totalControls} of {metrics.totalControlsFound || metrics.totalControls} security controls 
                (optimized for storage efficiency)
              </span>
            </div>
          )}
          
          {/* Show count of controls being displayed */}
          {controlScores && controlScores.length > 0 && (
            <div className="controls-count-info">
              <span className="info-icon">📊</span>
              <span className="info-text">
                Showing {controlScores.length} security controls (optimized for storage efficiency)
              </span>
            </div>
          )}
          
          {controlScores && controlScores.length > 0 ? (
            <div className="table-wrapper">
              <table className="secure-score-table">
                <thead>
                  <tr>
                    <th 
                      className="sortable-header" 
                      onClick={() => handleSecureScoreSort('controlName')}
                      title="Click to sort by Control Name"
                    >
                      Control Name {getSortIcon('controlName', secureScoreSortConfig)}
                    </th>
                    <th 
                      className="sortable-header" 
                      onClick={() => handleSecureScoreSort('category')}
                      title="Click to sort by Category"
                    >
                      Category {getSortIcon('category', secureScoreSortConfig)}
                    </th>
                    <th 
                      className="sortable-header" 
                      onClick={() => handleSecureScoreSort('currentScore')}
                      title="Click to sort by Current Score"
                    >
                      Current Score {getSortIcon('currentScore', secureScoreSortConfig)}
                    </th>
                    <th 
                      className="sortable-header" 
                      onClick={() => handleSecureScoreSort('maxScore')}
                      title="Click to sort by Max Score"
                    >
                      Max Score {getSortIcon('maxScore', secureScoreSortConfig)}
                    </th>
                    <th 
                      className="sortable-header" 
                      onClick={() => handleSecureScoreSort('scoreGap')}
                      title="Click to sort by Score Gap"
                    >
                      Gap {getSortIcon('scoreGap', secureScoreSortConfig)}
                    </th>
                    <th 
                      className="sortable-header" 
                      onClick={() => handleSecureScoreSort('status')}
                      title="Click to sort by Implementation Status"
                    >
                      Status {getSortIcon('status', secureScoreSortConfig)}
                    </th>
                    <th 
                      className="sortable-header" 
                      onClick={() => handleSecureScoreSort('actionType')}
                      title="Click to sort by Action Type"
                    >
                      Action Type {getSortIcon('actionType', secureScoreSortConfig)}
                    </th>
                    <th>Recommended Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sortSecureScoreData(controlScores).map((control: any, index: number) => (
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
                        <span className={`status-badge ${getStandardizedStatus(control.implementationStatus || '').statusClass}`}>
                          {control.implementationStatus}
                        </span>
                      </td>
                      <td className="action-type-cell">
                        <span className="action-type-badge">
                          {control.actionType || 'Other'}
                        </span>
                      </td>
                      <td className="remediation-cell">
                        <div className="remediation-text" title={control.remediation}>
                          {control.remediation && control.remediation.length > 80 
                            ? `${control.remediation.substring(0, 80)}...` 
                            : (control.remediation || 'No action specified')}
                        </div>
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
    console.log('=== RENDER IDENTITY TABLE DEBUG ===');
    console.log('Metrics received:', metrics);
    console.log('Metrics keys:', Object.keys(metrics || {}));
    console.log('totalUsers:', metrics?.totalUsers);
    console.log('userBreakdown:', metrics?.userBreakdown);
    console.log('Has userBreakdown array?', Array.isArray(metrics?.userBreakdown));
    
    if (!metrics || metrics.totalUsers === undefined) {
      console.log('❌ No metrics or totalUsers undefined - showing no data message');
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
                  <th>Risk Assessment</th>
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
                    <td className="risk-reason-cell">
                      <span className="risk-reason-text">{userType.riskReason}</span>
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
          <button 
            onClick={() => {
              const stats = secureScoreControlService.getCacheStats();
              console.log('Control Service Stats:', stats);
              alert(`Control Service Stats:\nCache Size: ${stats.size} profiles\nLast Updated: ${stats.lastUpdated.toLocaleString()}\nCache Valid: ${stats.isValid}`);
            }} 
            style={{ padding: '0.5em 1em', fontWeight: 'bold', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px' }}
          >
            Control Service Status
          </button>
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
              <strong>Assessment Data Issue:</strong> {
                typeof customerAssessment.metrics.dataIssue === 'string' 
                  ? customerAssessment.metrics.dataIssue 
                  : customerAssessment.metrics.dataIssue?.reason || 'Data collection issue detected'
              }
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

      {/* Assessment Selector - Always show when customer is selected and assessments are available */}
      {selectedCustomer && !loading && availableAssessments.length > 0 && (
        <div className="assessment-selector-section">
          <div className="assessment-selector-header">
            <h2>Security Reports for {selectedCustomer.tenantName}</h2>
            <div className="assessment-selector">
              <label htmlFor="assessment-select" className="assessment-selector-label">
                📊 Select Assessment:
              </label>
              <select 
                id="assessment-select"
                className="assessment-selector-dropdown"
                value={selectedAssessmentId || ''}
                onChange={(e) => handleAssessmentSelection(e.target.value)}
              >
                {availableAssessments.map((assessment) => (
                  <option key={assessment.id} value={assessment.id}>
                    {new Date(assessment.date || assessment.assessmentDate || assessment.lastModified).toLocaleDateString()} 
                    {' at '}
                    {new Date(assessment.date || assessment.assessmentDate || assessment.lastModified).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {' - '}
                    {assessment.status === 'completed' ? '✅' : assessment.status === 'completed_with_size_limit' ? '⚠️' : '❌'}
                    {assessment.metrics?.realData?.secureScore && !assessment.metrics?.realData?.secureScore?.unavailable ? ' 🛡️' : ''}
                  </option>
                ))}
              </select>
              {customerAssessment && (
                <div className="assessment-info-compact">
                  <span className="assessment-status">
                    Status: {customerAssessment.status === 'completed' ? '✅ Completed' : 
                            customerAssessment.status === 'completed_with_size_limit' ? '⚠️ Completed with limits' : 
                            '❌ ' + customerAssessment.status}
                  </span>
                  {customerAssessment.metrics?.realData?.secureScore && !customerAssessment.metrics?.realData?.secureScore?.unavailable && (
                    <span className="secure-score-indicator">🛡️ Secure Score Available</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reports Interface - Show when we have valid report data */}
      {selectedCustomer && !loading && !error && reportData.length > 0 && (
        <div className="reports-interface">
          <div className="reports-content">
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
                    {Object.entries(currentTabData.metrics)
                      .filter(([key, value]) => {
                        // For license tab, exclude licenseTypes and summary cards
                        if (activeTab === 'license') {
                          return key !== 'licenseTypes' && key !== 'summary';
                        }
                        // For secure score tab, exclude specific fields
                        if (activeTab === 'secureScore') {
                          return key !== 'controlsStoredCount' && 
                                 key !== 'compressed' && 
                                 key !== 'hasDataLimits' && 
                                 key !== 'dataLimitWarning' && 
                                 key !== 'summary';
                        }
                        return true;
                      })
                      .map(([key, value]) => (
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
                          ) : key === 'utilizationRate' ? (
                            // Add % sign to utilization rate
                            `${typeof value === 'number' ? value.toLocaleString() : String(value)}%`
                          ) : key === 'lastUpdated' ? (
                            // Format date properly
                            typeof value === 'string' ? new Date(value).toLocaleDateString() : String(value)
                          ) : (
                            typeof value === 'number' ? value.toLocaleString() : 
                            typeof value === 'object' && value !== null ? 
                            (Array.isArray(value) ? `${value.length} items` : 
                             // Better handling for specific object types
                             key === 'costData' ? `€${((value as any).totalMonthlyCost || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} monthly` :
                             key === 'summary' ? ((value as any).status || 'Good') :
                             JSON.stringify(value).length > 50 ? 'View details below' : JSON.stringify(value)
                            ) :
                            String(value)
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
                    {renderSecureScoreTable(currentTabData.metrics, currentTabData.controlScores)}
                  </div>
                ) : activeTab === 'identity' ? (
                  // Handle identity assessment status
                  currentTabData.metrics?.skipped ? (
                    <div className="assessment-not-requested">
                      <div className="info-card">
                        <h3>⚙️ Identity Assessment Not Requested</h3>
                        <p>{currentTabData.metrics.reason}</p>
                        <div className="recommendations">
                          <h4>To include identity data in future assessments:</h4>
                          <ul>
                            {currentTabData.recommendations.map((rec, index) => (
                              <li key={index}>{rec}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  ) : currentTabData.metrics?.hasError ? (
                    <div className="assessment-error">
                      <div className="error-card">
                        <h3>❌ Identity Data Collection Failed</h3>
                        <p><strong>Error:</strong> {currentTabData.metrics.errorMessage}</p>
                        <p>{currentTabData.metrics.reason}</p>
                        <div className="troubleshooting">
                          <h4>Troubleshooting Steps:</h4>
                          <ul>
                            {currentTabData.recommendations.map((rec, index) => (
                              <li key={index}>{rec}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Show the identity table directly
                    <div className="charts-grid">
                      {(() => {
                        console.log('=== ABOUT TO RENDER IDENTITY TABLE ===');
                        console.log('currentTabData.metrics:', currentTabData.metrics);
                        console.log('currentTabData.metrics keys:', Object.keys(currentTabData.metrics || {}));
                        return renderIdentityTable(currentTabData.metrics);
                      })()}
                    </div>
                  )
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

      {/* No Report Data Available but Assessments Exist - Show message and keep selector visible */}
      {selectedCustomer && !loading && !error && reportData.length === 0 && availableAssessments.length > 0 && (
        <div className="no-report-data-section">
          <div className="no-report-data-message">
            <div className="info-box">
              <h3>📊 No Report Data Available</h3>
              <p>The selected assessment doesn't have valid report data.</p>
              {customerAssessment && customerAssessment.metrics?.dataIssue && (
                <div className="assessment-issue-details">
                  <h4>🔍 Issue Details:</h4>
                  <p>{customerAssessment.metrics.dataIssue.reason || 'Data collection failed'}</p>
                  {customerAssessment.metrics.dataIssue.troubleshooting && customerAssessment.metrics.dataIssue.troubleshooting.length > 0 && (
                    <div className="troubleshooting-steps">
                      <h5>💡 Troubleshooting Steps:</h5>
                      <ul>
                        {customerAssessment.metrics.dataIssue.troubleshooting.map((step: string, index: number) => (
                          <li key={index}>{step}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              <div className="next-steps">
                <h4>🎯 Next Steps:</h4>
                <ul>
                  <li>Try selecting a different assessment from the dropdown above</li>
                  <li>Create a new assessment if all existing ones have issues</li>
                  <li>Check that app registration permissions are properly configured</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* No Assessment Data at All */}
      {selectedCustomer && !loading && !error && reportData.length === 0 && availableAssessments.length === 0 && (
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
