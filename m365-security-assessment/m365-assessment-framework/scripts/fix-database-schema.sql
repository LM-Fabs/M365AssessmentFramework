-- PostgreSQL Schema Fix for M365 Assessment Framework
-- This script updates the database schema to match the code expectations

-- Drop existing customers table and recreate with correct schema
DROP TABLE IF EXISTS assessment_history CASCADE;
DROP TABLE IF EXISTS assessments CASCADE;
DROP TABLE IF EXISTS customers CASCADE;

-- Create customers table with correct column names
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    tenant_name VARCHAR(255) NOT NULL,
    tenant_domain VARCHAR(255) NOT NULL,
    contact_email VARCHAR(255),
    notes TEXT,
    status VARCHAR(50) DEFAULT 'active',
    total_assessments INTEGER DEFAULT 0,
    app_registration JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_tenant_id UNIQUE (tenant_id),
    CONSTRAINT unique_tenant_domain UNIQUE (tenant_domain)
);

-- Create assessments table with correct schema
CREATE TABLE assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    tenant_id VARCHAR(255) NOT NULL,
    assessment_name VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    progress INTEGER DEFAULT 0,
    metrics JSONB,
    recommendations JSONB,
    score DECIMAL(5,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT check_status CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled')),
    CONSTRAINT check_score CHECK (score >= 0 AND score <= 100),
    CONSTRAINT check_progress CHECK (progress >= 0 AND progress <= 100)
);

-- Create assessment_history table
CREATE TABLE assessment_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    tenant_id VARCHAR(255) NOT NULL,
    assessment_name VARCHAR(255),
    status VARCHAR(50) NOT NULL,
    progress INTEGER DEFAULT 0,
    score DECIMAL(5,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    archived_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_history_status CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled')),
    CONSTRAINT check_history_score CHECK (score >= 0 AND score <= 100)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_customers_tenant_id ON customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_tenant_domain ON customers(tenant_domain);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON customers(created_at);

CREATE INDEX IF NOT EXISTS idx_assessments_customer_id ON assessments(customer_id);
CREATE INDEX IF NOT EXISTS idx_assessments_tenant_id ON assessments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_assessments_status ON assessments(status);
CREATE INDEX IF NOT EXISTS idx_assessments_created_at ON assessments(created_at);

CREATE INDEX IF NOT EXISTS idx_assessment_history_customer_id ON assessment_history(customer_id);
CREATE INDEX IF NOT EXISTS idx_assessment_history_tenant_id ON assessment_history(tenant_id);
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

-- Display success message
SELECT 'Database schema fixed successfully! Correct column names are now in place.' as message;
