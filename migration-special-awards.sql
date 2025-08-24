-- Migration: Add Special Awards functionality
-- Run this in your Supabase SQL editor

-- Drop existing tables if they exist (WARNING: This will delete all existing data)
DROP TABLE IF EXISTS special_award_votes CASCADE;
DROP TABLE IF EXISTS special_awards CASCADE;

-- Special Awards Table
CREATE TABLE special_awards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  award_type TEXT NOT NULL CHECK (award_type IN ('assigned', 'vote')),
  assigned_candidate_id UUID REFERENCES candidates(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Special Award Votes Table (for judge voting)
CREATE TABLE special_award_votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  special_award_id UUID REFERENCES special_awards(id) ON DELETE CASCADE,
  judge_id UUID REFERENCES judges(id) ON DELETE CASCADE,
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(special_award_id, judge_id, candidate_id)
);

-- Enable RLS on new tables
ALTER TABLE special_awards ENABLE ROW LEVEL SECURITY;
ALTER TABLE special_award_votes ENABLE ROW LEVEL SECURITY;

-- Special Awards policies
CREATE POLICY "Public can view special awards for active events" ON special_awards
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM events 
      WHERE events.id = special_awards.event_id 
      AND events.status = 'active'
    )
  );

CREATE POLICY "Event creators can manage special awards" ON special_awards
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM events 
      WHERE events.id = special_awards.event_id 
      AND events.created_by = auth.uid()
    )
  );

-- Special Award Votes policies
CREATE POLICY "Judges can view votes for their events" ON special_award_votes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM judges j
      JOIN special_awards sa ON sa.event_id = j.event_id
      WHERE sa.id = special_award_votes.special_award_id
      AND j.id = special_award_votes.judge_id
    )
  );

CREATE POLICY "Judges can insert votes for their events" ON special_award_votes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM judges j
      JOIN special_awards sa ON sa.event_id = j.event_id
      WHERE sa.id = special_award_votes.special_award_id
      AND j.id = special_award_votes.judge_id
    )
  );

CREATE POLICY "Event creators can view all votes" ON special_award_votes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM events e
      JOIN special_awards sa ON sa.event_id = e.id
      WHERE sa.id = special_award_votes.special_award_id
      AND e.created_by = auth.uid()
    )
  );

-- Insert some sample data (optional)
-- INSERT INTO special_awards (event_id, name, description, award_type) 
-- VALUES 
--   ('your-event-id-here', 'Best in Talent', 'Awarded to the most talented performer', 'vote'),
--   ('your-event-id-here', 'Most Promising', 'Awarded to the most promising newcomer', 'assigned');
