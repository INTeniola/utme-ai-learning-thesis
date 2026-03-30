-- Migration: Project Synthesis (v2 Vector Ingestion)
-- Created: 2026-03-29

-- 1. Create the user_doc_chunks table
-- Stores semantic fragments of student-uploaded documents
CREATE TABLE IF NOT EXISTS public.user_doc_chunks (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    upload_id UUID REFERENCES public.uploaded_content(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding extensions.vector(768), -- Matches text-embedding-004
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. High-performance HNSW index
CREATE INDEX IF NOT EXISTS user_doc_chunks_embedding_idx ON public.user_doc_chunks 
USING hnsw (embedding extensions.vector_cosine_ops);

-- 3. Multi-Vector Match RPC
-- Allows the Librarian to perform sub-document retrieval
CREATE OR REPLACE FUNCTION match_user_doc_chunks(
  query_embedding extensions.vector(768),
  match_threshold float,
  match_count int,
  p_user_id uuid
)
RETURNS TABLE (
  id UUID,
  upload_id UUID,
  content TEXT,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    uc.id,
    uc.upload_id,
    uc.content,
    1 - (uc.embedding <=> query_embedding) AS similarity
  FROM public.user_doc_chunks uc
  WHERE uc.user_id = p_user_id
    AND 1 - (uc.embedding <=> query_embedding) > match_threshold
  ORDER BY uc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 4. Enable RLS
ALTER TABLE public.user_doc_chunks ENABLE ROW LEVEL SECURITY;

-- 5. Strict User Isolation
CREATE POLICY "Users can only see their own chunks" 
ON public.user_doc_chunks FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own chunks" 
ON public.user_doc_chunks FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);
