-- Database Schema for Eloquent Go Backend
-- This schema is compatible with Supabase PostgreSQL

-- Users table
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  google_id VARCHAR(255),
  profile_picture TEXT,
  plan VARCHAR(50) DEFAULT 'free',
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  subscription_status VARCHAR(50) DEFAULT 'none',
  subscription_end_date TIMESTAMP,
  usage_current_month INTEGER DEFAULT 0,
  usage_last_reset TIMESTAMP DEFAULT NOW(),
  settings JSONB DEFAULT '{"language": "en", "aiMode": "auto", "autoGrammarFix": true}',
  created_at TIMESTAMP DEFAULT NOW(),
  last_login TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Devices table
CREATE TABLE devices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  device_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) DEFAULT 'Device',
  last_active TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Usage logs table
CREATE TABLE usage_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'transcription', 'ai_rewrite'
  minutes INTEGER NOT NULL,
  mode VARCHAR(50), -- 'standard', 'rewrite'
  language VARCHAR(10),
  processing_time INTEGER, -- milliseconds
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_google_id ON users(google_id);
CREATE INDEX idx_devices_user_id ON devices(user_id);
CREATE INDEX idx_devices_device_id ON devices(device_id);
CREATE INDEX idx_usage_logs_user_id ON usage_logs(user_id);
CREATE INDEX idx_usage_logs_created_at ON usage_logs(created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only see their own data
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Devices policies
CREATE POLICY "Users can view own devices" ON devices
  FOR ALL USING (auth.uid() = user_id);

-- Usage logs policies
CREATE POLICY "Users can view own usage logs" ON usage_logs
  FOR ALL USING (auth.uid() = user_id);