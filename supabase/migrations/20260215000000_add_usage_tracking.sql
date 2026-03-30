-- Add AI usage tracking and quota management
-- This enables free tier enforcement and usage analytics

-- Create ai_usage_logs table
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature_type text NOT NULL, -- 'ai_tutor', 'quiz_generation', 'flashcard_creation', 'cbt_exam', 'concept_generator'
  tokens_estimated integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Index for efficient quota checks (today's usage by user)
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_date 
ON public.ai_usage_logs(user_id, created_at DESC);

-- Index for analytics (feature usage patterns)
CREATE INDEX IF NOT EXISTS idx_ai_usage_feature 
ON public.ai_usage_logs(feature_type, created_at DESC);

-- Add usage quota columns to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS daily_ai_quota integer DEFAULT 50,
ADD COLUMN IF NOT EXISTS is_premium boolean DEFAULT false;

-- Enable RLS
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only read their own usage logs
CREATE POLICY "Users can view own usage logs"
ON public.ai_usage_logs
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can insert their own usage logs
CREATE POLICY "Users can insert own usage logs"
ON public.ai_usage_logs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Function to get today's usage count for a user
CREATE OR REPLACE FUNCTION get_daily_usage_count(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  usage_count integer;
BEGIN
  SELECT COUNT(*)
  INTO usage_count
  FROM public.ai_usage_logs
  WHERE user_id = p_user_id
    AND created_at >= CURRENT_DATE;
  
  RETURN COALESCE(usage_count, 0);
END;
$$;
