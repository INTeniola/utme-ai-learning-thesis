-- ============================================================
-- ADD OPTION E COLUMN TO past_questions
-- Supports UTME questions with 5-option answers (answer 'E')
-- Run this in Supabase SQL Editor BEFORE re-running the ingestion script
-- ============================================================

-- Step 1: Add nullable option_e column
ALTER TABLE public.past_questions
ADD COLUMN IF NOT EXISTS option_e TEXT;

-- Step 2: Expand correct_option constraint to allow 'E'
-- (Drop old constraint and add new one)
ALTER TABLE public.past_questions
DROP CONSTRAINT IF EXISTS past_questions_correct_option_check;

ALTER TABLE public.past_questions
ADD CONSTRAINT past_questions_correct_option_check
CHECK (correct_option IN ('A', 'B', 'C', 'D', 'E'));

-- Step 3: Verify the changes
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'past_questions'
AND column_name IN ('option_a', 'option_b', 'option_c', 'option_d', 'option_e', 'correct_option')
ORDER BY column_name;
