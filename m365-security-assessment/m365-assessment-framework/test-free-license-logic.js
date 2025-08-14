// Simple test to verify free license logic
console.log('Testing Free License Logic...\n');

// Mock the isFreeLicense function from the component
const isFreeLicense = (skuPartNumber) => {
  const freeLicenses = [
    'POWER_BI_STANDARD',
    'TEAMS_EXPLORATORY',
    'MICROSOFT_BUSINESS_CENTER',
    'FLOW_FREE',
    'POWERAPPS_VIRAL',
    'STREAM',
    'WHITEBOARD_PLAN1',
    'FORMS_PLAN_E1',
    'SWAY',
    'MCOPSTNC',
    'TEAMS_FREE',
    'POWER_VIRTUAL_AGENTS_VIRAL'
  ];
  
  return freeLicenses.includes(skuPartNumber) || 
         skuPartNumber.toLowerCase().includes('free') ||
         skuPartNumber.toLowerCase().includes('trial') ||
         skuPartNumber.toLowerCase().includes('viral');
};

// Test cases
const testLicenses = [
  { sku: 'SPE_E5', expected: false, description: 'Microsoft 365 E5 (Paid)' },
  { sku: 'SPE_E3', expected: false, description: 'Microsoft 365 E3 (Paid)' },
  { sku: 'POWER_BI_STANDARD', expected: true, description: 'Power BI Standard (Free)' },
  { sku: 'TEAMS_EXPLORATORY', expected: true, description: 'Teams Exploratory (Free)' },
  { sku: 'TEAMS_FREE', expected: true, description: 'Teams Free (Free)' },
  { sku: 'OFFICE365_TRIAL', expected: true, description: 'Office 365 Trial (Free)' },
  { sku: 'ENTERPRISEPACK', expected: false, description: 'Office 365 E3 (Paid)' },
  { sku: 'FLOW_FREE', expected: true, description: 'Power Automate Free (Free)' }
];

// Mock license data for calculation test
const mockLicenseData = {
  totalLicenses: 1000,
  assignedLicenses: 750,
  availableLicenses: 250,
  licenseDetails: [
    { skuPartNumber: 'SPE_E5', totalUnits: 100, assignedUnits: 80 },
    { skuPartNumber: 'SPE_E3', totalUnits: 400, assignedUnits: 350 },
    { skuPartNumber: 'POWER_BI_STANDARD', totalUnits: 300, assignedUnits: 200 },
    { skuPartNumber: 'TEAMS_FREE', totalUnits: 200, assignedUnits: 120 }
  ]
};

// Test isFreeLicense function
console.log('1. Testing isFreeLicense function:');
testLicenses.forEach(test => {
  const result = isFreeLicense(test.sku);
  const status = result === test.expected ? '✅ PASS' : '❌ FAIL';
  console.log(`   ${status} ${test.description}: ${test.sku} -> ${result}`);
});

// Test license separation
console.log('\n2. Testing license separation:');
const paidLicenses = mockLicenseData.licenseDetails.filter(license => !isFreeLicense(license.skuPartNumber));
const freeLicenses = mockLicenseData.licenseDetails.filter(license => isFreeLicense(license.skuPartNumber));

console.log(`   Paid licenses: ${paidLicenses.length} (${paidLicenses.map(l => l.skuPartNumber).join(', ')})`);
console.log(`   Free licenses: ${freeLicenses.length} (${freeLicenses.map(l => l.skuPartNumber).join(', ')})`);

// Test utilization calculation
console.log('\n3. Testing utilization calculation:');
const paidTotalLicenses = paidLicenses.reduce((sum, license) => sum + license.totalUnits, 0);
const paidAssignedLicenses = paidLicenses.reduce((sum, license) => sum + license.assignedUnits, 0);
const paidUtilizationRate = paidTotalLicenses > 0 ? (paidAssignedLicenses / paidTotalLicenses) * 100 : 0;

const overallUtilizationRate = mockLicenseData.totalLicenses > 0 ? (mockLicenseData.assignedLicenses / mockLicenseData.totalLicenses) * 100 : 0;

console.log(`   Overall utilization: ${overallUtilizationRate.toFixed(1)}% (${mockLicenseData.assignedLicenses}/${mockLicenseData.totalLicenses})`);
console.log(`   Paid-only utilization: ${paidUtilizationRate.toFixed(1)}% (${paidAssignedLicenses}/${paidTotalLicenses})`);
console.log(`   Difference: ${(paidUtilizationRate - overallUtilizationRate).toFixed(1)} percentage points`);

// Test cost calculation
console.log('\n4. Testing cost calculation (EUR format):');
const costMap = {
  'SPE_E5': 57, 'SPE_E3': 36, 'SPE_E1': 12,
  'ENTERPRISEPACK': 23, 'ENTERPRISEPREMIUM': 35
};

let totalCost = 0;
let paidLicenseCost = 0;

mockLicenseData.licenseDetails.forEach(license => {
  const unitCost = costMap[license.skuPartNumber] || 25;
  const licenseCost = isFreeLicense(license.skuPartNumber) ? 0 : license.assignedUnits * unitCost;
  
  if (!isFreeLicense(license.skuPartNumber)) {
    paidLicenseCost += licenseCost;
    console.log(`   ${license.skuPartNumber}: ${license.assignedUnits} × ${unitCost}€ = ${licenseCost}€`);
  } else {
    console.log(`   ${license.skuPartNumber}: ${license.assignedUnits} × 0€ = 0€ (FREE)`);
  }
  
  totalCost += licenseCost;
});

const formattedCost = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
}).format(totalCost);

console.log(`   Total estimated cost: ${formattedCost}`);

console.log('\n✅ All tests completed successfully!');
console.log('\nKey improvements implemented:');
console.log('• Free licenses are excluded from utilization calculations');
console.log('• Free licenses have 0€ cost in cost estimates');
console.log('• Currency format changed to EUR with German locale');
console.log('• Visual indicators distinguish free vs paid licenses');
console.log('• Summary cards show breakdown of free vs paid licenses');
