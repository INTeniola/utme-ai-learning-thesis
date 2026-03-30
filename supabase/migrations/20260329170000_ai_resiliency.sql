-- AI Resiliency & Semantic Caching
-- This handles service spikes and avoids direct frontend queries to usage logs (fixing CORS)

-- 1. Create Mentat Cache table
CREATE TABLE IF NOT EXISTS public.mentat_cache (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  subject text NOT NULL,
  topic text NOT NULL,
  query_hash text NOT NULL,
  query_text text NOT NULL,
  response_text text NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '30 days')
);

-- Enable RLS for mentat_cache (though Edge Functions will use service_role)
ALTER TABLE public.mentat_cache ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to look up cache (though strictly handled by Edge Functions usually)
CREATE POLICY "Anyone can check cache" 
ON public.mentat_cache 
FOR SELECT 
USING (true);

-- Index for lightning lookups
CREATE INDEX IF NOT EXISTS idx_mentat_cache_hash ON public.mentat_cache(query_hash);
CREATE INDEX IF NOT EXISTS idx_mentat_cache_subj_topic ON public.mentat_cache(subject, topic);

-- 2. Create get_user_usage_stats RPC
-- This provides a secure way for the frontend to check quota without direct CORS-failing queries
CREATE OR REPLACE FUNCTION get_user_usage_stats(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_used int;
    v_limit int;
    v_is_premium boolean;
BEGIN
    -- Get limit from profile
    SELECT daily_ai_quota, is_premium INTO v_limit, v_is_premium 
    FROM public.profiles WHERE id = p_user_id;
    
    -- Default limit if not set
    IF v_limit IS NULL THEN v_limit := 50; END IF;
    IF v_is_premium THEN v_limit := 999999; END IF;
    
    -- Sum credits for today in the correct timezone (using CURRENT_DATE which is UTC but usually fine for day buckets)
    SELECT COALESCE(SUM(credits_cost), 0) INTO v_used
    FROM public.ai_usage_logs
    WHERE user_id = p_user_id
    AND created_at >= CURRENT_DATE;
    
    RETURN jsonb_build_object(
        'used', v_used,
        'limit', v_limit,
        'remaining', GREATEST(0, v_limit - v_used),
        'allowed', (v_used < v_limit)
    );
END;
$$;
