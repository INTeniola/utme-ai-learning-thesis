-- Migration: Semantic Caching Infrastructure
-- Created: 2026-03-29

-- 1. Enable pgvector extension if not already present
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- 2. Create the semantic_cache table
-- Storing 768-dim embeddings from Gemini text-embedding-004 (v2)
CREATE TABLE IF NOT EXISTS public.semantic_cache (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    query_text TEXT NOT NULL,
    query_embedding extensions.vector(768), 
    response_context TEXT NOT NULL,
    subject TEXT,
    usage_count INT DEFAULT 1,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_accessed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. High-performance HNSW index for sub-millisecond similarity search
-- Vector cosine ops is standard for embeddings
CREATE INDEX IF NOT EXISTS semantic_cache_embedding_idx ON public.semantic_cache 
USING hnsw (query_embedding extensions.vector_cosine_ops);

-- 4. RPC for Similarity Matching
CREATE OR REPLACE FUNCTION match_semantic_cache(
  query_embedding extensions.vector(768),
  match_threshold float,
  match_count int,
  filter_subject text DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  response_context TEXT,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sc.id,
    sc.response_context,
    1 - (sc.query_embedding <=> query_embedding) AS similarity
  FROM public.semantic_cache sc
  WHERE (filter_subject IS NULL OR sc.subject = filter_subject)
    AND 1 - (sc.query_embedding <=> query_embedding) > match_threshold
  ORDER BY sc.query_embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 5. Row Level Security
ALTER TABLE public.semantic_cache ENABLE ROW LEVEL SECURITY;

-- Shared cache logic: Everyone can read/write to the academic cache
-- This dramatically handles high-concurrency "General" questions
CREATE POLICY "Allow select for authenticated" ON public.semantic_cache FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert for authenticated" ON public.semantic_cache FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update for authenticated" ON public.semantic_cache FOR UPDATE TO authenticated USING (true);
