import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase web env vars are missing. Mobile native runtime uses Appflow Native Config instead.')
}

export const supabase = createClient(
  supabaseUrl || 'https://msapggfdkgugctycrbqi.supabase.co',
  supabaseKey || 'MISSING_SUPABASE_ANON_KEY'
)

export interface ActivationRequest {
  id: string
  install_id: string
  user_email: string
  payment_method: 'paypal' | 'crypto'
  payment_amount: number
  payment_currency: string
  status: 'pending' | 'approved' | 'rejected' | 'activated'
  activation_code?: string
  notes?: string
  created_at: string
  updated_at: string
  activated_at?: string
}

export interface DashboardStats {
  total_requests: number
  pending_requests: number
  activated_requests: number
  total_revenue: number
}
