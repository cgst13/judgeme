-- JudgeMe Database Schema for Supabase
-- Run these commands in your Supabase SQL editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Events Table
CREATE TABLE events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  logo_url TEXT,
  num_judges INTEGER NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criteria Table
CREATE TABLE criteria (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  percentage INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Candidates Table
CREATE TABLE candidates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  representation TEXT NOT NULL,
  candidate_number INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Judges Table
CREATE TABLE judges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  judge_access_code TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Scores Table
CREATE TABLE scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  judge_id UUID REFERENCES judges(id) ON DELETE CASCADE,
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
  criteria_id UUID REFERENCES criteria(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE judges ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;

-- Events policies
CREATE POLICY "Users can view their own events" ON events
  FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "Users can insert their own events" ON events
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own events" ON events
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own events" ON events
  FOR DELETE USING (auth.uid() = created_by);

-- Public read access for events (for judges to access)
CREATE POLICY "Public can view active events" ON events
  FOR SELECT USING (status = 'active');

-- Criteria policies
CREATE POLICY "Public can view criteria for active events" ON criteria
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM events 
      WHERE events.id = criteria.event_id 
      AND events.status = 'active'
    )
  );

CREATE POLICY "Event creators can manage criteria" ON criteria
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM events 
      WHERE events.id = criteria.event_id 
      AND events.created_by = auth.uid()
    )
  );

-- Candidates policies
CREATE POLICY "Public can view candidates for active events" ON candidates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM events 
      WHERE events.id = candidates.event_id 
      AND events.status = 'active'
    )
  );

CREATE POLICY "Event creators can manage candidates" ON candidates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM events 
      WHERE events.id = candidates.event_id 
      AND events.created_by = auth.uid()
    )
  );

-- Judges policies
CREATE POLICY "Public can view judges for active events" ON judges
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM events 
      WHERE events.id = judges.event_id 
      AND events.status = 'active'
    )
  );

CREATE POLICY "Anyone can insert judges for active events" ON judges
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM events 
      WHERE events.id = judges.event_id 
      AND events.status = 'active'
    )
  );

CREATE POLICY "Event creators can manage judges" ON judges
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM events 
      WHERE events.id = judges.event_id 
      AND events.created_by = auth.uid()
    )
  );

-- Scores policies
CREATE POLICY "Public can view scores for active events" ON scores
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM events 
      WHERE events.id = scores.event_id 
      AND events.status = 'active'
    )
  );

CREATE POLICY "Judges can insert their own scores" ON scores
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM judges 
      WHERE judges.id = scores.judge_id 
      AND judges.event_id = scores.event_id
    )
  );

CREATE POLICY "Event creators can view all scores" ON scores
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM events 
      WHERE events.id = scores.event_id 
      AND events.created_by = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX idx_events_created_by ON events(created_by);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_criteria_event_id ON criteria(event_id);
CREATE INDEX idx_candidates_event_id ON candidates(event_id);
CREATE INDEX idx_judges_event_id ON judges(event_id);
CREATE INDEX idx_judges_access_code ON judges(judge_access_code);
CREATE INDEX idx_scores_event_id ON scores(event_id);
CREATE INDEX idx_scores_judge_id ON scores(judge_id);
CREATE INDEX idx_scores_candidate_id ON scores(candidate_id);
CREATE INDEX idx_scores_criteria_id ON scores(criteria_id); 