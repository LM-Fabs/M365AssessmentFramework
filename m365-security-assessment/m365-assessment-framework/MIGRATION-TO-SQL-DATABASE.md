# Migration to Azure SQL Database Guide

## Overview

This guide provides step-by-step instructions for migrating from Azure Table Storage to Azure SQL Database Serverless, including cost analysis, implementation details, and deployment procedures.

## Why Migrate to SQL Database?

### Current Limitations with Table Storage
- **64KB property size limit** requiring complex chunking mechanism
- **Limited query capabilities** - only key-based lookups
- **No ACID transactions** - potential data consistency issues
- **Complex data management** - chunking, compression, and reconstruction logic

### Benefits of SQL Database Serverless
- **Cost-effective** - Auto-pause when idle, pay-per-use model
- **No size limits** - Store large assessment data without chunking
- **Rich SQL queries** - Complex filtering, aggregation, and reporting
- **ACID compliance** - Guaranteed data consistency
- **Better performance** - Optimized for analytical workloads

## Cost Analysis

### Table Storage Current Costs
- **Storage**: ~$0.045 per GB per month
- **Transactions**: $0.0036 per 100,000 operations
- **Estimated monthly**: $50-100 for moderate usage

### SQL Database Serverless Costs
- **Compute**: $0.52 per vCore-hour (auto-pause saves costs)
- **Storage**: $0.136 per GB per month
- **Estimated monthly**: $30-80 with auto-pause benefits

**Result**: 20-40% cost reduction with better performance and capabilities.

## Implementation Components

### 1. Infrastructure Templates
- `main-with-sql.bicep` - Main template with conditional SQL deployment
- `sql-database.bicep` - SQL Database module with serverless configuration
- `sql-schema.sql` - Complete database schema with optimized indexes

### 2. Service Layer
- `sqlDatabaseService.ts` - New service with managed identity authentication
- `tableStorageService.ts` - Existing service (maintained for backward compatibility)
- `migrationService.ts` - Data migration utilities

### 3. Database Schema
- **Customers** - Customer information and metadata
- **Assessments** - Assessment data with JSON storage
- **AssessmentHistory** - Historical tracking and audit trail
- **Optimized indexes** - Performance-tuned for common queries

## Step-by-Step Migration

### Phase 1: Infrastructure Deployment

1. **Review current configuration**:
   ```bash
   # Check current resource group
   az group show --name <your-resource-group>
   
   # Verify current storage account
   az storage account show --name <your-storage-account> --resource-group <your-resource-group>
   ```

2. **Deploy SQL Database infrastructure**:
   ```bash
   cd infra
   
   # Deploy with SQL Database enabled
   az deployment group create \
     --resource-group <your-resource-group> \
     --template-file main-with-sql.bicep \
     --parameters useSqlDatabase=true \
     --parameters location=<your-region> \
     --parameters environmentName=<your-env>
   ```

3. **Verify deployment**:
   ```bash
   # Check SQL Server deployment
   az sql server show --name <sql-server-name> --resource-group <your-resource-group>
   
   # Check database status
   az sql db show --name <database-name> --server <sql-server-name> --resource-group <your-resource-group>
   ```

### Phase 2: Database Schema Setup

1. **Initialize database schema**:
   ```bash
   # Connect to SQL Database
   az sql db show-connection-string --server <sql-server-name> --name <database-name> --client sqlcmd
   
   # Apply schema (use connection string from above)
   sqlcmd -S <sql-server-fqdn> -d <database-name> -i sql-schema.sql -G
   ```

2. **Verify schema creation**:
   ```sql
   -- Check tables
   SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE';
   
   -- Check indexes
   SELECT * FROM sys.indexes WHERE object_id IN (
     SELECT object_id FROM sys.tables WHERE name IN ('Customers', 'Assessments', 'AssessmentHistory')
   );
   ```

### Phase 3: Application Configuration

1. **Update application settings**:
   ```bash
   # Set database type to SQL
   az staticwebapp appsettings set \
     --name <your-static-web-app> \
     --setting-names DATABASE_TYPE=SQL \
     --resource-group <your-resource-group>
   
   # Set SQL connection details (automatically configured by Bicep)
   # SQL_SERVER_NAME, SQL_DATABASE_NAME, SQL_CONNECTION_STRING
   ```

2. **Install new dependencies**:
   ```bash
   # Install SQL Server driver
   npm install mssql @azure/identity
   
   # Update package.json
   npm install
   ```

### Phase 4: Data Migration

1. **Run migration script**:
   ```bash
   # Execute migration utility
   npm run migrate-to-sql
   
   # Or run manually
   node api/src/migrationService.js
   ```

2. **Migration process**:
   - Reads all data from Table Storage
   - Reconstructs chunked data
   - Transforms to SQL schema
   - Inserts with proper relationships
   - Validates data integrity

3. **Verify migration**:
   ```sql
   -- Check data counts
   SELECT 
     (SELECT COUNT(*) FROM Customers) as CustomerCount,
     (SELECT COUNT(*) FROM Assessments) as AssessmentCount,
     (SELECT COUNT(*) FROM AssessmentHistory) as HistoryCount;
   
   -- Verify recent data
   SELECT TOP 10 * FROM Assessments ORDER BY CreatedDate DESC;
   ```

### Phase 5: Testing and Validation

1. **Run integration tests**:
   ```bash
   # Test SQL service
   npm test -- --grep "SQL Database Service"
   
   # Test API endpoints
   npm run test:api
   ```

2. **Performance testing**:
   ```bash
   # Load test with sample data
   npm run test:performance
   
   # Compare query performance
   npm run test:benchmark
   ```

3. **User acceptance testing**:
   - Create test assessment
   - Verify data persistence
   - Test reporting features
   - Validate chunking elimination

### Phase 6: Production Deployment

1. **Blue-green deployment**:
   ```bash
   # Deploy to staging slot
   az staticwebapp deployment create \
     --name <your-static-web-app> \
     --resource-group <your-resource-group> \
     --environment-name staging
   
   # Test staging environment
   curl https://<app-name>-staging.azurestaticapps.net/api/health
   
   # Swap to production
   az staticwebapp deployment activate \
     --name <your-static-web-app> \
     --resource-group <your-resource-group> \
     --environment-name staging
   ```

2. **Monitor deployment**:
   ```bash
   # Check application logs
   az monitor log-analytics query \
     --workspace <workspace-id> \
     --analytics-query "AppTraces | where TimeGenerated > ago(1h)"
   
   # Monitor SQL Database metrics
   az monitor metrics list \
     --resource <sql-database-resource-id> \
     --metric "cpu_percent,storage_percent"
   ```

## Rollback Procedures

### Emergency Rollback
1. **Switch back to Table Storage**:
   ```bash
   # Redeploy with Table Storage
   az deployment group create \
     --resource-group <your-resource-group> \
     --template-file main-with-sql.bicep \
     --parameters useSqlDatabase=false
   
   # Update app settings
   az staticwebapp appsettings set \
     --name <your-static-web-app> \
     --setting-names DATABASE_TYPE=TABLE
   ```

2. **Data synchronization**:
   - Recent data in SQL can be exported back to Table Storage
   - Use migration service in reverse mode

### Gradual Rollback
1. **Parallel operation**: Both databases can run simultaneously
2. **Selective routing**: Route specific customers to different databases
3. **Data consistency**: Ensure both databases stay synchronized

## Monitoring and Maintenance

### Performance Monitoring
- **SQL Database metrics**: CPU, memory, storage utilization
- **Application Insights**: Query performance, error rates
- **Custom dashboards**: Business metrics and KPIs

### Maintenance Tasks
- **Auto-pause configuration**: Optimize for cost savings
- **Index maintenance**: Monitor and optimize query performance
- **Backup verification**: Ensure automated backups are working
- **Security updates**: Keep dependencies and Azure services updated

## Troubleshooting

### Common Issues
1. **Connection failures**: Check managed identity permissions
2. **Performance issues**: Review query execution plans
3. **Data inconsistencies**: Verify migration scripts
4. **Cost overruns**: Monitor auto-pause settings

### Support Resources
- **Azure SQL Database documentation**: https://docs.microsoft.com/en-us/azure/sql-database/
- **Managed Identity troubleshooting**: https://docs.microsoft.com/en-us/azure/active-directory/managed-identities-azure-resources/
- **Performance optimization**: https://docs.microsoft.com/en-us/azure/sql-database/sql-database-performance-guidance

## Conclusion

The migration to Azure SQL Database Serverless provides significant benefits:
- **Cost savings** through auto-pause and pay-per-use model
- **Performance improvements** with optimized queries
- **Simplified architecture** by eliminating chunking complexity
- **Better scalability** for future growth

Follow this guide step-by-step to ensure a smooth migration with minimal downtime and maximum benefit realization.
