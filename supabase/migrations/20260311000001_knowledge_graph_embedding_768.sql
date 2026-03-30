-- Add 768-dimensional embedding column for Gemini Embedding 2
-- (knowledge_graph already has embedding vector(1536) for backward compat; we add a new column)
ALTER TABLE public.knowledge_graph
  ADD COLUMN IF NOT EXISTS embedding_768 extensions.vector(768);

-- HNSW index for fast cosine-similarity search on the new column
CREATE INDEX IF NOT EXISTS knowledge_graph_embedding_768_idx
  ON public.knowledge_graph
  USING hnsw (embedding_768 extensions.vector_cosine_ops);

-- -----------------------------------------------------------------------
-- match_knowledge_graph RPC
-- Returns content chunks ordered by cosine similarity to the query vector.
-- Falls back gracefully: rows with null embedding_768 are excluded.
-- -----------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.match_knowledge_graph(
  extensions.vector, float, int, text
);

CREATE OR REPLACE FUNCTION public.match_knowledge_graph(
  query_embedding extensions.vector(768),
  match_threshold  float,
  match_count      int,
  filter_subject   text DEFAULT NULL
)
RETURNS TABLE (
  id         uuid,
  subject    text,
  topic      text,
  subtopic   text,
  content    text,
  metadata   jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kg.id,
    kg.subject,
    kg.topic,
    kg.subtopic,
    kg.content_chunk          AS content,
    kg.metadata,
    1 - (kg.embedding_768 <=> query_embedding) AS similarity
  FROM public.knowledge_graph kg
  WHERE kg.embedding_768 IS NOT NULL
    AND 1 - (kg.embedding_768 <=> query_embedding) > match_threshold
    AND (filter_subject IS NULL OR kg.subject = filter_subject)
  ORDER BY kg.embedding_768 <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.match_knowledge_graph TO authenticated;
