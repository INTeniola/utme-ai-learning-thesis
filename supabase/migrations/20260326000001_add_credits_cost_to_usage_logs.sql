-- Migration: Add weighted credit economy to ai_usage_logs
-- Each AI action now costs a different number of credits rather than flat 1-per-call.

ALTER TABLE ai_usage_logs
  ADD COLUMN IF NOT EXISTS credits_cost INTEGER NOT NULL DEFAULT 1;

-- Backfill all historical rows with cost=1 (conservative; they were flat-counted before)
UPDATE ai_usage_logs SET credits_cost = 1 WHERE credits_cost IS NULL;

-- Index optimised for the daily sum query in checkRateLimit:
--   WHERE user_id = $1 AND created_at >= today_start
-- Covering index on credits_cost avoids a heap fetch.
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_day_credits
  ON ai_usage_logs (user_id, created_at, credits_cost);

-- Comment the table for documentation
COMMENT ON COLUMN ai_usage_logs.credits_cost IS
  'Weighted credit cost of this AI action. Chat=1, Quiz=3, Concept Map=5, Document=4. See CREDIT_COSTS in _shared/gemini.ts.';
