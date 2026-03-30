-- Migration: Ingestion Webhook Trigger
-- Created: 2026-03-29

-- 1. Enable pg_net extension for HTTP requests
-- This allows Postgres to trigger Edge Functions directly
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. Create the Trigger Function
-- This function sends a POST request to the process-document edge function
CREATE OR REPLACE FUNCTION public.trigger_ingestion_worker()
RETURNS TRIGGER AS $$
DECLARE
  project_url TEXT;
  service_key TEXT;
  function_url TEXT;
BEGIN
  -- Extract project URL from settings (Supabase convention)
  -- If not set, we fallback to the project ref
  project_url := CURRENT_SETTING('app.settings.supabase_url', true);
  service_key := CURRENT_SETTING('app.settings.jwt_secret', true); -- Or service_role
  
  -- Construct the Edge Function URL
  -- Example: https://xzgkyngjkekrksiyngui.supabase.co/functions/v1/process-document
  IF project_url IS NOT NULL THEN
    function_url := project_url || '/functions/v1/process-document';
    
    PERFORM
      extensions.http_post(
        url := function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || service_key
        ),
        body := jsonb_build_object('contentId', NEW.id)
      );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create the Trigger
-- Executes AFTER INSERT on uploaded_content
DROP TRIGGER IF EXISTS tr_ingestion_worker ON public.uploaded_content;
CREATE TRIGGER tr_ingestion_worker
  AFTER INSERT ON public.uploaded_content
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_ingestion_worker();
