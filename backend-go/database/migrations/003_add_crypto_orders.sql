-- Migration: Add crypto orders table for BlockBee payments

-- Crypto orders table
CREATE TABLE IF NOT EXISTS crypto_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id VARCHAR(100) UNIQUE NOT NULL, -- BlockBee order reference
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_email VARCHAR(255) NOT NULL,
  
  -- Plan details
  plan_id VARCHAR(50) NOT NULL,
  plan_name VARCHAR(100),
  
  -- Payment details
  amount_usd DECIMAL(10, 2) NOT NULL,
  amount_crypto DECIMAL(20, 8),
  coin VARCHAR(50) NOT NULL DEFAULT 'usdt_bep20',
  
  -- BlockBee payment info
  payment_address VARCHAR(255),
  payment_url TEXT,
  qr_code_url TEXT,
  
  -- Transaction details
  txid_in VARCHAR(255),
  txid_out VARCHAR(255),
  confirmations INTEGER DEFAULT 0,
  
  -- Status
  status VARCHAR(50) DEFAULT 'pending', -- pending, confirming, completed, failed, expired
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  paid_at TIMESTAMP,
  expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '24 hours')
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_crypto_orders_order_id ON crypto_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_crypto_orders_user_id ON crypto_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_crypto_orders_status ON crypto_orders(status);
CREATE INDEX IF NOT EXISTS idx_crypto_orders_created_at ON crypto_orders(created_at);

-- Enable RLS
ALTER TABLE crypto_orders ENABLE ROW LEVEL SECURITY;

-- RLS Policy - users can view their own orders
CREATE POLICY "Users can view own orders" ON crypto_orders
  FOR SELECT USING (auth.uid() = user_id);
