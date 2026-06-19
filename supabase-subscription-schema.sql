-- Xylo Subscription Schema
-- Run this after supabase-educator-schema.sql

-- User subscriptions table
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  plan_id TEXT NOT NULL DEFAULT 'free' CHECK (plan_id IN ('free', 'premium', 'education')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'trialing')),
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe ON user_subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);

-- Updated_at trigger
DROP TRIGGER IF EXISTS update_user_subscriptions_updated_at ON user_subscriptions;
CREATE TRIGGER update_user_subscriptions_updated_at
  BEFORE UPDATE ON user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to check if a user has premium access
CREATE OR REPLACE FUNCTION has_premium_access(user_id_param TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  plan TEXT;
  sub_status TEXT;
BEGIN
  SELECT plan_id, status INTO plan, sub_status
  FROM user_subscriptions
  WHERE user_id = user_id_param;
  
  IF plan IS NULL THEN
    RETURN FALSE;
  END IF;
  
  RETURN (plan IN ('premium', 'education')) AND (sub_status = 'active');
END;
$$ LANGUAGE plpgsql;

-- Function to check if a user has educator access
CREATE OR REPLACE FUNCTION has_educator_access(user_id_param TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  plan TEXT;
  sub_status TEXT;
BEGIN
  SELECT plan_id, status INTO plan, sub_status
  FROM user_subscriptions
  WHERE user_id = user_id_param;
  
  IF plan IS NULL THEN
    RETURN FALSE;
  END IF;
  
  RETURN (plan = 'education') AND (sub_status = 'active');
END;
$$ LANGUAGE plpgsql;


