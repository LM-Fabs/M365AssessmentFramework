-- PostgreSQL Database Schema for M365 Assessment Framework
-- This script initializes the database schema for the M365 Assessment application

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) NOT NULL,
    tenant_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_tenant_id UNIQUE (tenant_id),
    CONSTRAINT unique_domain UNIQUE (domain)
);

-- Create assessments table
CREATE TABLE IF NOT EXISTS assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    assessment_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    results JSONB,
    secure_score INTEGER,
    total_controls INTEGER,
    passed_controls INTEGER,
    failed_controls INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT check_status CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled')),
    CONSTRAINT check_secure_score CHECK (secure_score >= 0 AND secure_score <= 100),
    CONSTRAINT check_controls CHECK (total_controls >= 0 AND passed_controls >= 0 AND failed_controls >= 0)
);

-- Create assessment_history table
CREATE TABLE IF NOT EXISTS assessment_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    assessment_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL,
    results JSONB,
    secure_score INTEGER,
    total_controls INTEGER,
    passed_controls INTEGER,
    failed_controls INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    archived_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_history_status CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled')),
    CONSTRAINT check_history_secure_score CHECK (secure_score >= 0 AND secure_score <= 100),
    CONSTRAINT check_history_controls CHECK (total_controls >= 0 AND passed_controls >= 0 AND failed_controls >= 0)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_customers_tenant_id ON customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_domain ON customers(domain);
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON customers(created_at);

CREATE INDEX IF NOT EXISTS idx_assessments_customer_id ON assessments(customer_id);
CREATE INDEX IF NOT EXISTS idx_assessments_status ON assessments(status);
CREATE INDEX IF NOT EXISTS idx_assessments_type ON assessments(assessment_type);
CREATE INDEX IF NOT EXISTS idx_assessments_created_at ON assessments(created_at);
CREATE INDEX IF NOT EXISTS idx_assessments_completed_at ON assessments(completed_at);

CREATE INDEX IF NOT EXISTS idx_assessment_history_assessment_id ON assessment_history(assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_history_customer_id ON assessment_history(customer_id);
CREATE INDEX IF NOT EXISTS idx_assessment_history_type ON assessment_history(assessment_type);
CREATE INDEX IF NOT EXISTS idx_assessment_history_created_at ON assessment_history(created_at);
CREATE INDEX IF NOT EXISTS idx_assessment_history_archived_at ON assessment_history(archived_at);

-- Create trigger function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updating updated_at timestamps
CREATE TRIGGER update_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_assessments_updated_at
    BEFORE UPDATE ON assessments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create a function to archive assessments
CREATE OR REPLACE FUNCTION archive_assessment(assessment_uuid UUID)
RETURNS void AS $$
BEGIN
    -- Insert into history table
    INSERT INTO assessment_history (
        assessment_id, customer_id, assessment_type, status, results,
        secure_score, total_controls, passed_controls, failed_controls,
        created_at, completed_at, archived_at
    )
    SELECT 
        id, customer_id, assessment_type, status, results,
        secure_score, total_controls, passed_controls, failed_controls,
        created_at, completed_at, CURRENT_TIMESTAMP
    FROM assessments 
    WHERE id = assessment_uuid;
    
    -- Remove from active assessments
    DELETE FROM assessments WHERE id = assessment_uuid;
END;
$$ language 'plpgsql';

-- Create a function to clean up old assessment history (optional)
CREATE OR REPLACE FUNCTION cleanup_old_assessment_history(days_to_keep INTEGER DEFAULT 365)
RETURNS void AS $$
BEGIN
    DELETE FROM assessment_history 
    WHERE archived_at < CURRENT_TIMESTAMP - INTERVAL '1 day' * days_to_keep;
END;
$$ language 'plpgsql';

-- Insert some sample data (optional - for testing)
-- INSERT INTO customers (name, display_name, domain, tenant_id) VALUES 
-- ('contoso-corp', 'Contoso Corporation', 'contoso.com', gen_random_uuid()),
-- ('fabrikam-inc', 'Fabrikam Inc', 'fabrikam.com', gen_random_uuid());

-- Display final message
SELECT 'Database schema initialized successfully!' as message;
