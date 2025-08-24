# Database Migration Guide - Individual Judge Access Codes

## Overview
This migration updates the JudgeMe database to use individual access codes for each judge instead of a single event access code. This provides better security and tracking.

## Migration Steps

### 1. Run the Migration Script
Execute the following SQL commands in your Supabase SQL Editor:

```sql
-- Migration script to update existing database for individual judge access codes

-- Step 1: Add candidate_number column to candidates table if it doesn't exist
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS candidate_number INTEGER;

-- Step 2: Add judge_access_code column to judges table
ALTER TABLE judges ADD COLUMN IF NOT EXISTS judge_access_code TEXT;

-- Step 3: Create unique index on judge_access_code
CREATE UNIQUE INDEX IF NOT EXISTS idx_judges_access_code ON judges(judge_access_code);

-- Step 4: Remove the general access_code from events table (if it exists)
ALTER TABLE events DROP COLUMN IF EXISTS access_code;

-- Step 5: Drop the old access_code index if it exists
DROP INDEX IF EXISTS idx_events_access_code;

-- Step 6: Update existing candidates to have candidate_number if they don't have it
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
```

### 2. Verify the Migration
After running the migration, verify that:

1. The `events` table no longer has an `access_code` column
2. The `judges` table has a `judge_access_code` column with unique values
3. The `candidates` table has a `candidate_number` column
4. All existing judges have been assigned access codes

### 3. Test the Application
1. Create a new event - you should see individual judge access codes generated
2. Try accessing an event with a judge access code
3. Check that the EventDetails page shows individual judge codes in the Judges tab

## What Changed

### Database Schema Changes:
- **Removed**: `events.access_code` (general event access code)
- **Added**: `judges.judge_access_code` (individual judge access codes)
- **Added**: `candidates.candidate_number` (sequential candidate numbers)

### Application Changes:
- **CreateEvent**: Now generates individual access codes for each judge
- **AccessEvent**: Now accepts individual judge access codes instead of event codes
- **EventDetails**: Shows individual judge access codes in the Judges tab
- **Judge Access Flow**: Judges now use their unique codes to access events

### Benefits:
1. **Better Security**: Each judge has their own unique access code
2. **Better Tracking**: Can track which specific judge accessed the event
3. **Prevents Duplicates**: Each access code can only be used by one judge
4. **Easier Management**: Event creators can see all judge codes in one place

## Rollback (if needed)
If you need to rollback, you can restore the old schema by:

```sql
-- Add back the general access_code to events
ALTER TABLE events ADD COLUMN access_code TEXT;

-- Remove judge_access_code from judges
ALTER TABLE judges DROP COLUMN judge_access_code;

-- Remove candidate_number from candidates
ALTER TABLE candidates DROP COLUMN candidate_number;
```

However, this will require updating the application code back to the old version as well. 