-- M365 Assessment Framework - SQL Database Schema
-- Azure SQL Serverless Database Setup

-- Create Customers table
CREATE TABLE [dbo].[Customers] (
    [Id] NVARCHAR(100) NOT NULL PRIMARY KEY,
    [TenantId] NVARCHAR(100) NOT NULL,
    [TenantName] NVARCHAR(255) NOT NULL,
    [TenantDomain] NVARCHAR(255) NOT NULL,
    [ContactEmail] NVARCHAR(255) NULL,
    [Notes] NVARCHAR(MAX) NULL,
    [CreatedDate] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    [LastAssessmentDate] DATETIME2 NULL,
    [Status] NVARCHAR(50) NOT NULL DEFAULT 'active',
    [TotalAssessments] INT NOT NULL DEFAULT 0,
    [ApplicationId] NVARCHAR(100) NULL,
    [ClientId] NVARCHAR(100) NULL,
    [ServicePrincipalId] NVARCHAR(100) NULL,
    [ClientSecret] NVARCHAR(500) NULL, -- Encrypted
    [ConsentUrl] NVARCHAR(1000) NULL,
    [RedirectUri] NVARCHAR(1000) NULL,
    [Permissions] NVARCHAR(MAX) NULL, -- JSON array
    [UpdatedDate] DATETIME2 NOT NULL DEFAULT GETUTCDATE()
);

-- Create index on TenantId for efficient lookups
CREATE INDEX [IX_Customers_TenantId] ON [dbo].[Customers] ([TenantId]);
CREATE INDEX [IX_Customers_TenantDomain] ON [dbo].[Customers] ([TenantDomain]);
CREATE INDEX [IX_Customers_Status] ON [dbo].[Customers] ([Status]);
CREATE INDEX [IX_Customers_ClientId] ON [dbo].[Customers] ([ClientId]);

-- Create Assessments table
CREATE TABLE [dbo].[Assessments] (
    [Id] NVARCHAR(100) NOT NULL PRIMARY KEY,
    [CustomerId] NVARCHAR(100) NOT NULL,
    [TenantId] NVARCHAR(100) NOT NULL,
    [Date] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    [Status] NVARCHAR(50) NOT NULL DEFAULT 'completed',
    [Score] DECIMAL(5,2) NULL,
    [Metrics] NVARCHAR(MAX) NULL, -- JSON data - no size limit in SQL
    [Recommendations] NVARCHAR(MAX) NULL, -- JSON data - no size limit in SQL
    [DataSizeWarning] BIT NOT NULL DEFAULT 0,
    [OriginalDataSize] BIGINT NULL,
    [ProcessingDuration] INT NULL, -- in milliseconds
    [CreatedDate] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    [UpdatedDate] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    
    CONSTRAINT [FK_Assessments_Customers] FOREIGN KEY ([CustomerId]) 
        REFERENCES [dbo].[Customers] ([Id]) ON DELETE CASCADE
);

-- Create indexes on Assessments table
CREATE INDEX [IX_Assessments_CustomerId] ON [dbo].[Assessments] ([CustomerId]);
CREATE INDEX [IX_Assessments_TenantId] ON [dbo].[Assessments] ([TenantId]);
CREATE INDEX [IX_Assessments_Date] ON [dbo].[Assessments] ([Date] DESC);
CREATE INDEX [IX_Assessments_Status] ON [dbo].[Assessments] ([Status]);
CREATE INDEX [IX_Assessments_Score] ON [dbo].[Assessments] ([Score]);

-- Create AssessmentHistory table
CREATE TABLE [dbo].[AssessmentHistory] (
    [Id] NVARCHAR(100) NOT NULL PRIMARY KEY,
    [AssessmentId] NVARCHAR(100) NOT NULL,
    [TenantId] NVARCHAR(100) NOT NULL,
    [CustomerId] NVARCHAR(100) NULL,
    [Date] DATETIME2 NOT NULL,
    [OverallScore] DECIMAL(5,2) NOT NULL,
    [CategoryScores] NVARCHAR(MAX) NOT NULL, -- JSON data
    [CreatedDate] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    
    CONSTRAINT [FK_AssessmentHistory_Assessments] FOREIGN KEY ([AssessmentId]) 
        REFERENCES [dbo].[Assessments] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_AssessmentHistory_Customers] FOREIGN KEY ([CustomerId]) 
        REFERENCES [dbo].[Customers] ([Id]) ON DELETE SET NULL
);

-- Create indexes on AssessmentHistory table
CREATE INDEX [IX_AssessmentHistory_AssessmentId] ON [dbo].[AssessmentHistory] ([AssessmentId]);
CREATE INDEX [IX_AssessmentHistory_TenantId] ON [dbo].[AssessmentHistory] ([TenantId]);
CREATE INDEX [IX_AssessmentHistory_CustomerId] ON [dbo].[AssessmentHistory] ([CustomerId]);
CREATE INDEX [IX_AssessmentHistory_Date] ON [dbo].[AssessmentHistory] ([Date] DESC);
CREATE INDEX [IX_AssessmentHistory_OverallScore] ON [dbo].[AssessmentHistory] ([OverallScore]);

-- Create audit/logging table for changes
CREATE TABLE [dbo].[AuditLog] (
    [Id] BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [TableName] NVARCHAR(100) NOT NULL,
    [RecordId] NVARCHAR(100) NOT NULL,
    [Action] NVARCHAR(20) NOT NULL, -- INSERT, UPDATE, DELETE
    [OldValues] NVARCHAR(MAX) NULL, -- JSON
    [NewValues] NVARCHAR(MAX) NULL, -- JSON
    [ChangedBy] NVARCHAR(100) NULL,
    [ChangedDate] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    [IPAddress] NVARCHAR(50) NULL,
    [UserAgent] NVARCHAR(500) NULL
);

-- Create index on AuditLog table
CREATE INDEX [IX_AuditLog_TableName] ON [dbo].[AuditLog] ([TableName]);
CREATE INDEX [IX_AuditLog_RecordId] ON [dbo].[AuditLog] ([RecordId]);
CREATE INDEX [IX_AuditLog_Action] ON [dbo].[AuditLog] ([Action]);
CREATE INDEX [IX_AuditLog_ChangedDate] ON [dbo].[AuditLog] ([ChangedDate] DESC);

-- Create Views for common queries
CREATE VIEW [dbo].[vw_CustomerSummary] AS
SELECT 
    c.[Id],
    c.[TenantId],
    c.[TenantName],
    c.[TenantDomain],
    c.[ContactEmail],
    c.[Status],
    c.[CreatedDate],
    c.[LastAssessmentDate],
    c.[TotalAssessments],
    -- Latest assessment info
    la.[Score] AS [LastAssessmentScore],
    la.[Date] AS [LastAssessmentDate_Actual],
    la.[Status] AS [LastAssessmentStatus],
    -- Assessment statistics
    (SELECT COUNT(*) FROM [dbo].[Assessments] a WHERE a.[CustomerId] = c.[Id]) AS [ActualAssessmentCount],
    (SELECT AVG(CAST(a.[Score] AS FLOAT)) FROM [dbo].[Assessments] a WHERE a.[CustomerId] = c.[Id]) AS [AverageScore],
    (SELECT MAX(a.[Score]) FROM [dbo].[Assessments] a WHERE a.[CustomerId] = c.[Id]) AS [HighestScore],
    (SELECT MIN(a.[Score]) FROM [dbo].[Assessments] a WHERE a.[CustomerId] = c.[Id]) AS [LowestScore]
FROM [dbo].[Customers] c
LEFT JOIN [dbo].[Assessments] la ON c.[Id] = la.[CustomerId] 
    AND la.[Date] = (SELECT MAX([Date]) FROM [dbo].[Assessments] WHERE [CustomerId] = c.[Id])
WHERE c.[Status] = 'active';

-- Create view for recent assessments
CREATE VIEW [dbo].[vw_RecentAssessments] AS
SELECT TOP 100
    a.[Id],
    a.[CustomerId],
    a.[TenantId],
    c.[TenantName],
    c.[TenantDomain],
    a.[Date],
    a.[Status],
    a.[Score],
    a.[CreatedDate],
    -- Extract key metrics from JSON (for quick access)
    JSON_VALUE(a.[Metrics], '$.score.overall') AS [OverallScore],
    JSON_VALUE(a.[Metrics], '$.score.license') AS [LicenseScore],
    JSON_VALUE(a.[Metrics], '$.score.secureScore') AS [SecureScore],
    JSON_VALUE(a.[Metrics], '$.assessmentType') AS [AssessmentType],
    -- Data size information
    a.[DataSizeWarning],
    a.[OriginalDataSize],
    a.[ProcessingDuration]
FROM [dbo].[Assessments] a
JOIN [dbo].[Customers] c ON a.[CustomerId] = c.[Id]
WHERE a.[Status] = 'completed'
ORDER BY a.[Date] DESC;

-- Create stored procedures for common operations

-- Get customer with assessments
CREATE PROCEDURE [dbo].[sp_GetCustomerWithAssessments]
    @CustomerId NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Get customer info
    SELECT * FROM [dbo].[Customers] WHERE [Id] = @CustomerId;
    
    -- Get recent assessments
    SELECT TOP 10 
        [Id], [Date], [Status], [Score], 
        JSON_VALUE([Metrics], '$.score.overall') AS [OverallScore],
        JSON_VALUE([Metrics], '$.score.license') AS [LicenseScore],
        JSON_VALUE([Metrics], '$.score.secureScore') AS [SecureScore]
    FROM [dbo].[Assessments] 
    WHERE [CustomerId] = @CustomerId
    ORDER BY [Date] DESC;
END;

-- Get assessment history for tenant
CREATE PROCEDURE [dbo].[sp_GetAssessmentHistory]
    @TenantId NVARCHAR(100) = NULL,
    @CustomerId NVARCHAR(100) = NULL,
    @Limit INT = 10
AS
BEGIN
    SET NOCOUNT ON;
    
    IF @CustomerId IS NOT NULL
    BEGIN
        SELECT TOP (@Limit) * 
        FROM [dbo].[AssessmentHistory] 
        WHERE [CustomerId] = @CustomerId
        ORDER BY [Date] DESC;
    END
    ELSE IF @TenantId IS NOT NULL
    BEGIN
        SELECT TOP (@Limit) * 
        FROM [dbo].[AssessmentHistory] 
        WHERE [TenantId] = @TenantId
        ORDER BY [Date] DESC;
    END
    ELSE
    BEGIN
        SELECT TOP (@Limit) * 
        FROM [dbo].[AssessmentHistory] 
        ORDER BY [Date] DESC;
    END
END;

-- Clean up old assessment history
CREATE PROCEDURE [dbo].[sp_CleanupOldHistory]
    @RetentionDays INT = 90
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @CutoffDate DATETIME2 = DATEADD(DAY, -@RetentionDays, GETUTCDATE());
    
    DELETE FROM [dbo].[AssessmentHistory]
    WHERE [Date] < @CutoffDate;
    
    SELECT @@ROWCOUNT AS [DeletedRows];
END;

-- Create function for JSON data validation
CREATE FUNCTION [dbo].[fn_IsValidJSON](@jsonString NVARCHAR(MAX))
RETURNS BIT
AS
BEGIN
    DECLARE @isValid BIT = 0;
    
    BEGIN TRY
        SET @isValid = ISJSON(@jsonString);
    END TRY
    BEGIN CATCH
        SET @isValid = 0;
    END CATCH
    
    RETURN @isValid;
END;

-- Add constraints for JSON validation
ALTER TABLE [dbo].[Assessments] 
ADD CONSTRAINT [CHK_Assessments_Metrics_JSON] 
CHECK ([Metrics] IS NULL OR [dbo].[fn_IsValidJSON]([Metrics]) = 1);

ALTER TABLE [dbo].[Assessments] 
ADD CONSTRAINT [CHK_Assessments_Recommendations_JSON] 
CHECK ([Recommendations] IS NULL OR [dbo].[fn_IsValidJSON]([Recommendations]) = 1);

ALTER TABLE [dbo].[AssessmentHistory] 
ADD CONSTRAINT [CHK_AssessmentHistory_CategoryScores_JSON] 
CHECK ([dbo].[fn_IsValidJSON]([CategoryScores]) = 1);

-- Create triggers for audit logging
CREATE TRIGGER [tr_Customers_Audit] ON [dbo].[Customers]
FOR INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Handle INSERT
    IF EXISTS (SELECT * FROM inserted) AND NOT EXISTS (SELECT * FROM deleted)
    BEGIN
        INSERT INTO [dbo].[AuditLog] ([TableName], [RecordId], [Action], [NewValues], [ChangedDate])
        SELECT 'Customers', [Id], 'INSERT', 
               (SELECT * FROM inserted i WHERE i.[Id] = inserted.[Id] FOR JSON AUTO),
               GETUTCDATE()
        FROM inserted;
    END
    
    -- Handle UPDATE
    IF EXISTS (SELECT * FROM inserted) AND EXISTS (SELECT * FROM deleted)
    BEGIN
        INSERT INTO [dbo].[AuditLog] ([TableName], [RecordId], [Action], [OldValues], [NewValues], [ChangedDate])
        SELECT 'Customers', i.[Id], 'UPDATE',
               (SELECT * FROM deleted d WHERE d.[Id] = i.[Id] FOR JSON AUTO),
               (SELECT * FROM inserted ins WHERE ins.[Id] = i.[Id] FOR JSON AUTO),
               GETUTCDATE()
        FROM inserted i;
    END
    
    -- Handle DELETE
    IF NOT EXISTS (SELECT * FROM inserted) AND EXISTS (SELECT * FROM deleted)
    BEGIN
        INSERT INTO [dbo].[AuditLog] ([TableName], [RecordId], [Action], [OldValues], [ChangedDate])
        SELECT 'Customers', [Id], 'DELETE',
               (SELECT * FROM deleted d WHERE d.[Id] = deleted.[Id] FOR JSON AUTO),
               GETUTCDATE()
        FROM deleted;
    END
END;

-- Update UpdatedDate on changes
CREATE TRIGGER [tr_Customers_UpdatedDate] ON [dbo].[Customers]
FOR UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    
    UPDATE [dbo].[Customers]
    SET [UpdatedDate] = GETUTCDATE()
    FROM [dbo].[Customers] c
    JOIN inserted i ON c.[Id] = i.[Id];
END;

-- Create trigger for Assessments UpdatedDate
CREATE TRIGGER [tr_Assessments_UpdatedDate] ON [dbo].[Assessments]
FOR UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    
    UPDATE [dbo].[Assessments]
    SET [UpdatedDate] = GETUTCDATE()
    FROM [dbo].[Assessments] a
    JOIN inserted i ON a.[Id] = i.[Id];
END;

-- Create initial admin user (optional)
-- INSERT INTO [dbo].[Customers] ([Id], [TenantId], [TenantName], [TenantDomain], [Status], [CreatedDate])
-- VALUES ('admin-system', 'system', 'System Administration', 'system.local', 'active', GETUTCDATE());

PRINT 'M365 Assessment Framework SQL Database Schema created successfully!';
PRINT 'Tables created: Customers, Assessments, AssessmentHistory, AuditLog';
PRINT 'Views created: vw_CustomerSummary, vw_RecentAssessments';
PRINT 'Stored procedures created: sp_GetCustomerWithAssessments, sp_GetAssessmentHistory, sp_CleanupOldHistory';
PRINT 'Functions created: fn_IsValidJSON';
PRINT 'Triggers created: Audit logging and UpdatedDate triggers';
