-- ============================================================
-- QUIZANT ACCOUNT UNLOCK SCRIPT
-- Run this in Supabase SQL Editor to fix the concurrent-session
-- lockout issue and restore access immediately.
-- ============================================================

-- Step 1: Clear all stale session IDs (unlocks ALL accounts)
UPDATE public.profiles
SET active_session_id = NULL,
    updated_at = NOW()
WHERE active_session_id IS NOT NULL;

-- Confirm how many accounts were unlocked:
SELECT COUNT(*) AS accounts_unlocked
FROM public.profiles
WHERE updated_at > NOW() - INTERVAL '10 seconds';

-- ============================================================
-- OPTIONAL: To unlock only YOUR account, run instead:
-- UPDATE public.profiles
-- SET active_session_id = NULL, updated_at = NOW()
-- WHERE id = auth.uid();
-- ============================================================
