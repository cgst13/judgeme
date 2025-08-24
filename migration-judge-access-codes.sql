-- Migration script to update existing database for individual judge access codes
-- Run this in your Supabase SQL editor after the main schema is set up

-- Step 1: Add candidate_number column to candidates table if it doesn't exist
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS candidate_number INTEGER;

-- Step 2: Add judge_access_code column to judges table
ALTER TABLE judges ADD COLUMN IF NOT EXISTS judge_access_code TEXT;

-- Step 3: Create unique index on judge_access_code
CREATE UNIQUE INDEX IF NOT EXISTS idx_judges_access_code ON judges(judge_access_code);

-- Step 4: Remove the general access_code from events table (if it exists)
-- Note: This will fail if the column doesn't exist, which is fine
ALTER TABLE events DROP COLUMN IF EXISTS access_code;

-- Step 5: Drop the old access_code index if it exists
DROP INDEX IF EXISTS idx_events_access_code;

-- Step 6: Update existing candidates to have candidate_number if they don't have it
-- This assigns sequential numbers to existing candidates
UPDATE candidates 
SET candidate_number = subquery.row_num
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY event_id ORDER BY created_at) as row_num
  FROM candidates
  WHERE candidate_number IS NULL
) as subquery
WHERE candidates.id = subquery.id;

-- Step 7: Make candidate_number NOT NULL after populating existing data
ALTER TABLE candidates ALTER COLUMN candidate_number SET NOT NULL;

-- Step 8: Make judge_access_code NOT NULL after ensuring all judges have codes
-- First, generate access codes for existing judges that don't have them
UPDATE judges 
SET judge_access_code = 'JUDGE' || SUBSTRING(gen_random_uuid()::text, 1, 8)
WHERE judge_access_code IS NULL;

-- Then make the column NOT NULL
ALTER TABLE judges ALTER COLUMN judge_access_code SET NOT NULL; 