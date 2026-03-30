-- Add active_session_id to profiles for concurrent login prevention
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS active_session_id text;

-- Add updated_at if not exists (usually standard, but good to ensure)
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
