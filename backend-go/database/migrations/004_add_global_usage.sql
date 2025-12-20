-- Migration: Add global usage tracking
-- This tracks free recording time shared across ALL users

-- Global usage table (single row for system-wide tracking)
CREATE TABLE IF NOT EXISTS global_usage (
  id VARCHAR(50) PRIMARY KEY DEFAULT 'global',
  free_seconds_used INTEGER DEFAULT 0,
  free_seconds_limit INTEGER DEFAULT 2400, -- 40 minutes = 2400 seconds
  last_reset TIMESTAMP DEFAULT NOW(),
  reset_period VARCHAR(20) DEFAULT 'monthly', -- 'daily', 'weekly', 'monthly'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default global usage record
INSERT INTO global_usage (id, free_seconds_used, free_seconds_limit, reset_period)
VALUES ('global', 0, 2400, 'monthly')
ON CONFLICT (id) DO NOTHING;

-- Global usage logs (tracks which users contributed to global usage)
CREATE TABLE IF NOT EXISTS global_usage_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  seconds_used INTEGER NOT NULL,
  mode VARCHAR(50), -- 'standard', 'rewrite'
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_global_usage_logs_created_at ON global_usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_global_usage_logs_user_id ON global_usage_logs(user_id);
