-- Drop the function if it already exists to replace it with the new definition
DROP FUNCTION IF EXISTS public.match_knowledge_base;

-- Create function to match knowledge base chunks
CREATE OR REPLACE FUNCTION public.match_knowledge_base(
  query_embedding extensions.vector(1536),
  match_threshold float,
  match_count int,
  filter_subject text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  subject text,
  topic text,
  content text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    k.id,
    k.subject,
    k.topic,
    k.content,
    1 - (k.embedding <=> query_embedding) AS similarity
  FROM public.knowledge_base k
  WHERE 1 - (k.embedding <=> query_embedding) > match_threshold
    AND (filter_subject IS NULL OR k.subject = filter_subject)
  ORDER BY k.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
