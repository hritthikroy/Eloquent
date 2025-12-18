-- Migration: Add role column to users table
-- This migration adds user roles functionality

-- Add role column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user';

-- Update existing admin user
UPDATE users SET role = 'admin' WHERE email = 'hritthikin@gmail.com';

-- Create index for role column
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Add comment for documentation
COMMENT ON COLUMN users.role IS 'User role: user, admin';