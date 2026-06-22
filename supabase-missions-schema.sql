-- Mission Attempts Table
-- Run after: supabase-schema.sql → supabase-curriculum-schema.sql →
--            supabase-educator-schema.sql → supabase-subscription-schema.sql
--
-- mission_id is plain TEXT (matches Mission.id from lib/missions/seed/*.json)
-- rather than a foreign key — the `missions` DB table doesn't exist until
-- Phase 6 (teacher-authored / DB-driven missions).

CREATE TABLE IF NOT EXISTS mission_attempts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT NOT NULL,            -- Clerk user ID
  mission_id      TEXT NOT NULL,            -- matches Mission.id from lib/missions/seed/
  status          TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'abandoned')),
  time_seconds    INTEGER NOT NULL DEFAULT 0,
  hints_used      INTEGER NOT NULL DEFAULT 0,
  criteria_met    TEXT[] DEFAULT '{}',
  final_circuit   JSONB,
  final_code      TEXT,
  score           INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mission_attempts_user
  ON mission_attempts(user_id);

CREATE INDEX IF NOT EXISTS idx_mission_attempts_mission
  ON mission_attempts(mission_id);

-- Best (highest-score) completed attempt per user per mission.
CREATE OR REPLACE VIEW mission_best_attempts AS
  SELECT DISTINCT ON (mission_id, user_id)
    mission_id,
    user_id,
    score,
    time_seconds,
    hints_used,
    created_at
  FROM mission_attempts
  WHERE status = 'completed'
  ORDER BY mission_id, user_id, score DESC, time_seconds ASC;
