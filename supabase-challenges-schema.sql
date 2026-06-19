-- Challenge Attempts Table
-- Run after: supabase-schema.sql → supabase-curriculum-schema.sql →
--            supabase-educator-schema.sql → supabase-subscription-schema.sql

CREATE TABLE IF NOT EXISTS challenge_attempts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT NOT NULL,            -- Clerk user ID
  challenge_id    TEXT NOT NULL,            -- matches Challenge.id from types.ts
  code_used       TEXT,
  completed       BOOLEAN DEFAULT false,
  score           INTEGER DEFAULT 0,
  time_seconds    DECIMAL(8,2),
  goal_reached    BOOLEAN DEFAULT false,
  collision_count INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_challenge_attempts_user
  ON challenge_attempts(user_id);

CREATE INDEX IF NOT EXISTS idx_challenge_attempts_challenge
  ON challenge_attempts(challenge_id);

-- Leaderboard view: best completed attempt per user per challenge
CREATE OR REPLACE VIEW challenge_leaderboard AS
  SELECT DISTINCT ON (challenge_id, user_id)
    challenge_id,
    user_id,
    score,
    time_seconds,
    created_at
  FROM challenge_attempts
  WHERE completed = true
  ORDER BY challenge_id, user_id, score DESC, time_seconds ASC;
