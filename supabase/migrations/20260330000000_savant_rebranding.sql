-- THESIS EDITION: Rebranding Table Rename
-- Rename mentat_cache to savant_cache

ALTER TABLE public.mentat_cache RENAME TO savant_cache;

-- Update Index names for consistency
ALTER INDEX IF EXISTS idx_mentat_cache_hash RENAME TO idx_savant_cache_hash;
ALTER INDEX IF EXISTS idx_mentat_cache_subj_topic RENAME TO idx_savant_cache_subj_topic;

-- Update RLS policies names if needed (Supabase usually handles the table name change in the policy itself)
