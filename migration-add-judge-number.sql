-- Add judge_number column to judges table
ALTER TABLE judges ADD COLUMN IF NOT EXISTS judge_number INTEGER;

-- Update existing judges with their numbers based on creation order
UPDATE judges
SET judge_number = subquery.row_num
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY event_id ORDER BY created_at) as row_num
  FROM judges
  WHERE judge_number IS NULL
) as subquery
WHERE judges.id = subquery.id;

-- Make judge_number NOT NULL
ALTER TABLE judges ALTER COLUMN judge_number SET NOT NULL;