-- Fix script for the database trigger issue
-- This will remove the problematic trigger and function that's causing the updated_at error

-- First, drop the problematic trigger
DROP TRIGGER IF EXISTS update_assessments_updated_at ON assessments;

-- Drop the problematic function
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Optional: Create a clean version of the trigger if needed
-- CREATE OR REPLACE FUNCTION update_updated_at_column()
-- RETURNS TRIGGER AS $$
-- BEGIN
--     NEW.updated_at = CURRENT_TIMESTAMP;
--     RETURN NEW;
-- END;
-- $$ language 'plpgsql';

-- CREATE TRIGGER update_assessments_updated_at
--     BEFORE UPDATE ON assessments
--     FOR EACH ROW
--     EXECUTE FUNCTION update_updated_at_column();

-- Verify the triggers are gone
SELECT trigger_name, trigger_schema, event_manipulation, action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'assessments';
