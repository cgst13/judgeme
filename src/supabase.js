import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY

// Check if environment variables are loaded
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables:')
  console.error('REACT_APP_SUPABASE_URL:', supabaseUrl ? '✓ Set' : '✗ Missing')
  console.error('REACT_APP_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✓ Set' : '✗ Missing')
  throw new Error('Supabase environment variables are not configured. Please check your .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database table names
export const TABLES = {
  EVENTS: 'events',
  CANDIDATES: 'candidates',
  JUDGES: 'judges',
  CRITERIA: 'criteria',
  SCORES: 'scores',
  SPECIAL_AWARDS: 'special_awards',
  SPECIAL_AWARD_VOTES: 'special_award_votes'
} 