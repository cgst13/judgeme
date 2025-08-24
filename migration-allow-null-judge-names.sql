-- Allow NULL names in judges table
ALTER TABLE judges ALTER COLUMN name DROP NOT NULL;