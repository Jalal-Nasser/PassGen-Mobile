import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase web env vars are missing. Mobile native runtime uses Appflow Native Config instead.')
}

export const supabase = createClient(
  supabaseUrl || 'https://example.invalid',
  supabaseKey || 'MISSING_SUPABASE_ANON_KEY'
)
