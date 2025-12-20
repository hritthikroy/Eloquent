-- Migration: Add pricing plans table
-- This allows admin to dynamically update pricing from the admin panel

-- Pricing plans table
CREATE TABLE IF NOT EXISTS pricing_plans (
  id VARCHAR(50) PRIMARY KEY, -- 'free', 'starter', 'pro', 'enterprise'
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price_monthly DECIMAL(10, 2) NOT NULL DEFAULT 0,
  price_yearly DECIMAL(10, 2),
  minutes_per_day INTEGER NOT NULL DEFAULT 5,
  overage_rate DECIMAL(10, 4), -- price per minute over limit
  features JSONB DEFAULT '[]',
  is_popular BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default pricing plans
INSERT INTO pricing_plans (id, name, description, price_monthly, price_yearly, minutes_per_day, overage_rate, features, is_popular, display_order) VALUES
('free', 'Free', 'Try it out', 0, NULL, 5, NULL, 
  '["5 minutes/day", "Basic transcription", "Standard mode only"]', 
  false, 1),
('starter', 'Starter', 'Perfect for light users', 2.99, 29.00, 15, 0.05, 
  '["15 minutes/day included", "$0.05/min over limit", "Basic AI enhancement", "Standard processing", "3 languages"]', 
  false, 2),
('pro', 'Pro', 'Most popular', 9.99, 99.00, 60, 0.03, 
  '["60 minutes/day included", "$0.03/min over limit", "Advanced AI enhancement", "Priority processing", "All languages"]', 
  true, 3),
('enterprise', 'Enterprise', 'Unlimited usage', 19.99, 199.00, -1, NULL, 
  '["Unlimited minutes", "No overage charges", "Premium AI models", "Custom shortcuts", "Priority support"]', 
  false, 4)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  minutes_per_day = EXCLUDED.minutes_per_day,
  overage_rate = EXCLUDED.overage_rate,
  features = EXCLUDED.features,
  is_popular = EXCLUDED.is_popular,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_pricing_plans_active ON pricing_plans(is_active);
CREATE INDEX IF NOT EXISTS idx_pricing_plans_order ON pricing_plans(display_order);
