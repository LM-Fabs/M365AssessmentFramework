#!/usr/bin/env node

/**
 * Migration script to move data from Azure Table Storage to Azure SQL Database
 * Run this script to migrate existing data during the transition
 */

const path = require('path');
const { TableStorageService } = require('./shared/tableStorageService');
const { PostgreSQLService } = require('./shared/postgresqlService');

class MigrationService {
    constructor() {
        this.tableService = new TableStorageService();
        this.sqlService = new PostgreSQLService();
        this.stats = {
            customers: { total: 0, migrated: 0, errors: 0 },
            assessments: { total: 0, migrated: 0, errors: 0 },
            history: { total: 0, migrated: 0, errors: 0 }
        };
    }

    async initialize() {
        console.log('🔧 Initializing migration services...');
        
        try {
            console.log('📊 Connecting to Table Storage...');
            await this.tableService.initialize();
            
            console.log('🗄️ Connecting to SQL Database...');
            await this.sqlService.initialize();
            
            console.log('✅ Migration services initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize migration services:', error);
            throw error;
        }
    }

    async migrateCustomers() {
        console.log('\n📋 Starting customer migration...');
        
        try {
            // Get all customers from Table Storage
            const { customers } = await this.tableService.getCustomers({ maxItemCount: 1000 });
            this.stats.customers.total = customers.length;
            
            console.log(`📊 Found ${customers.length} customers to migrate`);
            
            for (const customer of customers) {
                try {
                    // Check if customer already exists in SQL
                    const existingCustomer = await this.sqlService.getCustomer(customer.id);
                    
                    if (existingCustomer) {
                        console.log(`⚠️ Customer ${customer.id} already exists in SQL, skipping...`);
                        continue;
                    }
                    
                    // Migrate customer
                    const migratedCustomer = await this.sqlService.createCustomer(
                        {
                            tenantId: customer.tenantId,
                            tenantName: customer.tenantName,
                            tenantDomain: customer.tenantDomain,
                            contactEmail: customer.contactEmail,
                            notes: customer.notes
                        },
                        customer.appRegistration
                    );
                    
                    this.stats.customers.migrated++;
                    console.log(`✅ Migrated customer: ${customer.id} -> ${migratedCustomer.id}`);
                    
                } catch (error) {
                    this.stats.customers.errors++;
                    console.error(`❌ Failed to migrate customer ${customer.id}:`, error.message);
                }
            }
            
            console.log(`📊 Customer migration completed: ${this.stats.customers.migrated}/${this.stats.customers.total} migrated, ${this.stats.customers.errors} errors`);
            
        } catch (error) {
            console.error('❌ Customer migration failed:', error);
            throw error;
        }
    }

    async migrateAssessments() {
        console.log('\n📋 Starting assessment migration...');
        
        try {
            // Get all assessments from Table Storage
            const { assessments } = await this.tableService.getAssessments({ maxItemCount: 1000 });
            this.stats.assessments.total = assessments.length;
            
            console.log(`📊 Found ${assessments.length} assessments to migrate`);
            
            for (const assessment of assessments) {
                try {
                    // Check if assessment already exists in SQL
                    const existingAssessments = await this.sqlService.getAssessments({ 
                        customerId: assessment.customerId,
                        maxItemCount: 1000
                    });
                    
                    const exists = existingAssessments.assessments.some(a => a.id === assessment.id);
                    
                    if (exists) {
                        console.log(`⚠️ Assessment ${assessment.id} already exists in SQL, skipping...`);
                        continue;
                    }
                    
                    // Migrate assessment
                    const migratedAssessment = await this.sqlService.createAssessment({
                        customerId: assessment.customerId,
                        tenantId: assessment.tenantId,
                        score: assessment.score,
                        metrics: assessment.metrics,
                        recommendations: assessment.recommendations
                    });
                    
                    this.stats.assessments.migrated++;
                    console.log(`✅ Migrated assessment: ${assessment.id} -> ${migratedAssessment.id}`);
                    
                } catch (error) {
                    this.stats.assessments.errors++;
                    console.error(`❌ Failed to migrate assessment ${assessment.id}:`, error.message);
                }
            }
            
            console.log(`📊 Assessment migration completed: ${this.stats.assessments.migrated}/${this.stats.assessments.total} migrated, ${this.stats.assessments.errors} errors`);
            
        } catch (error) {
            console.error('❌ Assessment migration failed:', error);
            throw error;
        }
    }

    async migrateAssessmentHistory() {
        console.log('\n📋 Starting assessment history migration...');
        
        try {
            // Get all assessment history from Table Storage
            const history = await this.tableService.getAllAssessmentHistory();
            this.stats.history.total = history.length;
            
            console.log(`📊 Found ${history.length} assessment history records to migrate`);
            
            for (const historyRecord of history) {
                try {
                    // Check if history record already exists in SQL
                    const existingHistory = await this.sqlService.getAssessmentHistory({
                        tenantId: historyRecord.tenantId,
                        customerId: historyRecord.customerId,
                        maxItemCount: 1000
                    });
                    
                    const exists = existingHistory.some(h => h.id === historyRecord.id);
                    
                    if (exists) {
                        console.log(`⚠️ History record ${historyRecord.id} already exists in SQL, skipping...`);
                        continue;
                    }
                    
                    // Migrate history record
                    await this.sqlService.storeAssessmentHistory({
                        id: historyRecord.id,
                        assessmentId: `migrated-${historyRecord.id}`, // We may not have the original assessment ID
                        tenantId: historyRecord.tenantId,
                        customerId: historyRecord.customerId,
                        date: historyRecord.date,
                        overallScore: historyRecord.overallScore,
                        categoryScores: historyRecord.categoryScores
                    });
                    
                    this.stats.history.migrated++;
                    console.log(`✅ Migrated history record: ${historyRecord.id}`);
                    
                } catch (error) {
                    this.stats.history.errors++;
                    console.error(`❌ Failed to migrate history record ${historyRecord.id}:`, error.message);
                }
            }
            
            console.log(`📊 History migration completed: ${this.stats.history.migrated}/${this.stats.history.total} migrated, ${this.stats.history.errors} errors`);
            
        } catch (error) {
            console.error('❌ History migration failed:', error);
            throw error;
        }
    }

    async validateMigration() {
        console.log('\n🔍 Validating migration...');
        
        try {
            // Check customer count
            const { customers: tableCustomers } = await this.tableService.getCustomers({ maxItemCount: 1000 });
            const { customers: sqlCustomers } = await this.sqlService.getCustomers({ maxItemCount: 1000 });
            
            console.log(`📊 Customers: Table Storage = ${tableCustomers.length}, SQL Database = ${sqlCustomers.length}`);
            
            // Check assessment count
            const { assessments: tableAssessments } = await this.tableService.getAssessments({ maxItemCount: 1000 });
            const { assessments: sqlAssessments } = await this.sqlService.getAssessments({ maxItemCount: 1000 });
            
            console.log(`📊 Assessments: Table Storage = ${tableAssessments.length}, SQL Database = ${sqlAssessments.length}`);
            
            // Check history count
            const tableHistory = await this.tableService.getAllAssessmentHistory();
            const sqlHistory = await this.sqlService.getAllAssessmentHistory();
            
            console.log(`📊 History: Table Storage = ${tableHistory.length}, SQL Database = ${sqlHistory.length}`);
            
            // Validate some sample data
            if (sqlCustomers.length > 0) {
                const sampleCustomer = sqlCustomers[0];
                console.log(`✅ Sample customer migrated: ${sampleCustomer.id} (${sampleCustomer.tenantName})`);
            }
            
            if (sqlAssessments.length > 0) {
                const sampleAssessment = sqlAssessments[0];
                console.log(`✅ Sample assessment migrated: ${sampleAssessment.id} (Score: ${sampleAssessment.score})`);
            }
            
            console.log('✅ Migration validation completed');
            
        } catch (error) {
            console.error('❌ Migration validation failed:', error);
            throw error;
        }
    }

    async cleanup() {
        console.log('\n🧹 Cleaning up migration services...');
        
        try {
            if (this.sqlService) {
                await this.sqlService.close();
            }
            console.log('✅ Migration cleanup completed');
        } catch (error) {
            console.error('❌ Migration cleanup failed:', error);
        }
    }

    async run() {
        const startTime = Date.now();
        
        console.log('🚀 Starting Azure Table Storage to SQL Database migration...');
        console.log(`⏰ Migration started at: ${new Date().toISOString()}`);
        
        try {
            await this.initialize();
            
            // Run migrations in sequence
            await this.migrateCustomers();
            await this.migrateAssessments();
            await this.migrateAssessmentHistory();
            
            // Validate migration
            await this.validateMigration();
            
            const duration = Date.now() - startTime;
            console.log(`\n✅ Migration completed successfully in ${duration}ms`);
            console.log('📊 Migration Summary:');
            console.log(`   Customers: ${this.stats.customers.migrated}/${this.stats.customers.total} (${this.stats.customers.errors} errors)`);
            console.log(`   Assessments: ${this.stats.assessments.migrated}/${this.stats.assessments.total} (${this.stats.assessments.errors} errors)`);
            console.log(`   History: ${this.stats.history.migrated}/${this.stats.history.total} (${this.stats.history.errors} errors)`);
            
        } catch (error) {
            console.error('❌ Migration failed:', error);
            process.exit(1);
        } finally {
            await this.cleanup();
        }
    }
}

// Check if this script is being run directly
if (require.main === module) {
    const migration = new MigrationService();
    migration.run().catch(error => {
        console.error('❌ Migration script failed:', error);
        process.exit(1);
    });
}

module.exports = MigrationService;
