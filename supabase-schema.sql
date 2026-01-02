-- Supabase SQL Schema for PassGen Activation Dashboard

-- Create activation_requests table
CREATE TABLE IF NOT EXISTS activation_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  install_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  payment_method TEXT CHECK (payment_method IN ('paypal', 'crypto')) NOT NULL,
  payment_amount DECIMAL(10,2) NOT NULL,
  payment_currency TEXT DEFAULT 'USD' NOT NULL,
  status TEXT CHECK (status IN ('pending', 'approved', 'rejected', 'activated')) DEFAULT 'pending' NOT NULL,
  activation_code TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  activated_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_activation_requests_install_id ON activation_requests(install_id);
CREATE INDEX IF NOT EXISTS idx_activation_requests_user_email ON activation_requests(user_email);
CREATE INDEX IF NOT EXISTS idx_activation_requests_status ON activation_requests(status);
CREATE INDEX IF NOT EXISTS idx_activation_requests_created_at ON activation_requests(created_at DESC);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_activation_requests_updated_at ON activation_requests;
DROP FUNCTION IF EXISTS update_activation_requests_updated_at_fn();

CREATE TRIGGER update_activation_requests_updated_at
    BEFORE UPDATE ON activation_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE activation_requests ENABLE ROW LEVEL SECURITY;

-- Create policies for the activation_requests table
-- For now, allow all operations (you can restrict this later with authentication)
DROP POLICY IF EXISTS "Allow all operations on activation_requests" ON activation_requests;
CREATE POLICY "Allow all operations on activation_requests" ON activation_requests
    FOR ALL USING (true);

-- Create a view for dashboard statistics
CREATE OR REPLACE VIEW dashboard_stats AS
SELECT
  COUNT(*) as total_requests,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_requests,
  COUNT(*) FILTER (WHERE status = 'activated') as activated_requests,
  COALESCE(SUM(payment_amount) FILTER (WHERE status IN ('approved', 'activated')), 0) as total_revenue
FROM activation_requests;

-- Auth + licensing tables
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  plan TEXT DEFAULT 'free' NOT NULL,
  status TEXT DEFAULT 'active' NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS devices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  device_id TEXT NOT NULL,
  activated_at TIMESTAMP WITH TIME ZONE,
  last_seen_at TIMESTAMP WITH TIME ZONE,
  refresh_token_hash TEXT,
  refresh_expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_devices_user_device ON devices(user_id, device_id);

CREATE TABLE IF NOT EXISTS desktop_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  device_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_desktop_tokens_hash ON desktop_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_desktop_tokens_user ON desktop_tokens(user_id);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE desktop_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on users" ON users;
CREATE POLICY "Allow all operations on users" ON users
  FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all operations on subscriptions" ON subscriptions;
CREATE POLICY "Allow all operations on subscriptions" ON subscriptions
  FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all operations on devices" ON devices;
CREATE POLICY "Allow all operations on devices" ON devices
  FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all operations on desktop_tokens" ON desktop_tokens;
CREATE POLICY "Allow all operations on desktop_tokens" ON desktop_tokens
  FOR ALL USING (true);
