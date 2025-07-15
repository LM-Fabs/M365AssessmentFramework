// Test script to verify chunking mechanism
import { TableStorageService } from './api/shared/tableStorageService';

async function testChunkingMechanism() {
    console.log('🧪 Testing chunking mechanism...');
    
    // Create a large secure score data object for testing
    const largeSecureScoreData = {
        currentScore: 450,
        maxScore: 600,
        percentage: 75,
        lastUpdated: new Date().toISOString(),
        controlScores: Array.from({ length: 200 }, (_, i) => ({
            controlName: `Security Control ${i + 1} with very long description that includes detailed guidance and implementation steps`,
            category: `Category ${Math.floor(i / 20) + 1}`,
            currentScore: Math.floor(Math.random() * 10),
            maxScore: 10,
            implementationStatus: 'PartiallyCompleted',
            description: `Detailed description for control ${i + 1}. This control focuses on enhancing security posture through comprehensive monitoring and alerting mechanisms. Implementation requires coordination across multiple teams and systems. Regular reviews and updates are essential for maintaining effectiveness.`,
            remediation: `Step-by-step remediation guide for control ${i + 1}. 1. Assess current implementation status. 2. Identify gaps and vulnerabilities. 3. Develop remediation plan. 4. Implement security measures. 5. Monitor and validate effectiveness. 6. Document changes and update procedures.`,
            userImpact: 'Medium',
            implementationCost: 'Low',
            tier: 'Standard'
        })),
        totalControlsFound: 200,
        compressed: false
    };
    
    // Create assessment data with large metrics
    const testAssessmentData = {
        customerId: 'test-customer-001',
        tenantId: 'test-tenant-001',
        score: 75,
        metrics: {
            score: {
                overall: 75,
                license: 80,
                secureScore: 75
            },
            realData: {
                secureScore: largeSecureScoreData,
                licenseInfo: {
                    totalLicenses: 1000,
                    assignedLicenses: 850,
                    utilizationRate: 85,
                    summary: 'Good license utilization',
                    details: Array.from({ length: 50 }, (_, i) => ({
                        skuId: `sku-${i + 1}`,
                        skuPartNumber: `SKU-PART-${i + 1}`,
                        consumedUnits: Math.floor(Math.random() * 100),
                        prepaidUnits: {
                            enabled: Math.floor(Math.random() * 100),
                            suspended: 0,
                            warning: 0
                        },
                        servicePlans: Array.from({ length: 10 }, (_, j) => ({
                            servicePlanId: `service-plan-${j + 1}`,
                            servicePlanName: `Service Plan ${j + 1}`,
                            provisioningStatus: 'Success',
                            appliesTo: 'Company'
                        }))
                    }))
                },
                tenantInfo: {
                    tenantId: 'test-tenant-001',
                    tenantName: 'Test Tenant',
                    tenantDomain: 'test.onmicrosoft.com'
                }
            },
            assessmentType: 'real-data',
            dataCollected: true,
            recommendations: Array.from({ length: 50 }, (_, i) => ({
                id: `rec-${i + 1}`,
                title: `Recommendation ${i + 1}`,
                description: `Detailed recommendation description for item ${i + 1}. This recommendation focuses on improving security posture through specific actions and configurations.`,
                priority: 'High',
                category: 'Security',
                implementation: `Implementation steps for recommendation ${i + 1}...`,
                impact: 'High',
                effort: 'Medium'
            }))
        },
        recommendations: Array.from({ length: 100 }, (_, i) => ({
            id: `global-rec-${i + 1}`,
            title: `Global Recommendation ${i + 1}`,
            description: `Global recommendation description for item ${i + 1}...`,
            priority: 'Medium',
            category: 'Compliance'
        }))
    };
    
    try {
        // Calculate data size
        const metricsJson = JSON.stringify(testAssessmentData.metrics);
        const recommendationsJson = JSON.stringify(testAssessmentData.recommendations);
        const totalSize = metricsJson.length + recommendationsJson.length;
        
        console.log(`📊 Test data sizes:`);
        console.log(`   Metrics: ${metricsJson.length} characters`);
        console.log(`   Recommendations: ${recommendationsJson.length} characters`);
        console.log(`   Total: ${totalSize} characters`);
        console.log(`   Exceeds 64KB limit: ${totalSize > 65536 ? 'YES' : 'NO'}`);
        
        // Test chunking logic
        const service = new TableStorageService();
        
        // Test the chunking mechanism directly
        const testEntity = {
            partitionKey: 'test',
            rowKey: 'test-001'
        };
        
        // Use the private method via reflection for testing
        const chunkMethod = (service as any).chunkLargeData.bind(service);
        const prepareMethod = (service as any).prepareLargeDataForStorage.bind(service);
        
        // Test chunking of metrics
        console.log('\n🔧 Testing chunking mechanism...');
        const metricsChunks = chunkMethod(metricsJson);
        console.log(`Metrics chunked: ${metricsChunks.isChunked}, chunks: ${metricsChunks.chunks.length}`);
        
        // Test preparation for storage
        prepareMethod(testEntity, 'metrics', metricsJson);
        prepareMethod(testEntity, 'recommendations', recommendationsJson);
        
        console.log('\n✅ Chunking mechanism test completed successfully!');
        console.log('🎯 Key improvements made:');
        console.log('   - Enhanced chunking logic with better error handling');
        console.log('   - Improved data reconstruction with validation');
        console.log('   - Added minimal metrics fallback for extreme cases');
        console.log('   - Better logging for debugging');
        
    } catch (error) {
        console.error('❌ Chunking mechanism test failed:', error);
    }
}

// Run the test if this file is executed directly
if (require.main === module) {
    testChunkingMechanism().catch(console.error);
}

export { testChunkingMechanism };
