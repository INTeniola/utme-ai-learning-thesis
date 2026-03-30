-- 20260329180000_multimodal_rag.sql: Visual Researcher Pilot (Phase 1)
-- This migration enables Mentat to store and search page images for complex PDFs.

-- 1. Create Private Storage Bucket for Doc Page Thumbnails
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'user-doc-pages', 
    'user-doc-pages', 
    false, 
    5242880, -- 5MB limit per page thumbnail
    '{image/png,image/jpeg}'
)
ON CONFLICT (id) DO NOTHING;

-- Storage Policy: Users can only see/upload their own page thumbnails
CREATE POLICY "Users can access their own doc page thumbnails"
ON storage.objects FOR ALL
USING ( bucket_id = 'user-doc-pages' AND auth.uid() = owner );

-- 2. Create User Doc Pages Table for Multimodal RAG
CREATE TABLE IF NOT EXISTS public.user_doc_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    upload_id UUID REFERENCES public.user_uploads(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    page_number INT NOT NULL,
    storage_path TEXT NOT NULL,
    ocr_text TEXT,
    -- Gemini Multimodal Embedding (Standard Dimension is 1408)
    image_embedding vector(1408),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_doc_pages ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only the document owner can see the page data
CREATE POLICY "Users can only view their own document pages"
ON public.user_doc_pages FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert their own document pages"
ON public.user_doc_pages FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 3. Visual Search Function (Multimodal Match)
-- This searches the visual meaning of the pages using the multimodal vector.
CREATE OR REPLACE FUNCTION match_doc_pages (
  query_embedding vector(1408),
  match_threshold float,
  match_count int,
  p_user_id uuid
)
RETURNS TABLE (
  id uuid,
  upload_id uuid,
  page_number int,
  storage_path text,
  ocr_text text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    udp.id,
    udp.upload_id,
    udp.page_number,
    udp.storage_path,
    udp.ocr_text,
    1 - (udp.image_embedding <=> query_embedding) AS similarity
  FROM public.user_doc_pages udp
  WHERE udp.user_id = p_user_id
    AND 1 - (udp.image_embedding <=> query_embedding) > match_threshold
  ORDER BY udp.image_embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 4. Index for High-Performance Vector Search
CREATE INDEX IF NOT EXISTS user_doc_pages_embedding_idx 
ON public.user_doc_pages 
USING hnsw (image_embedding vector_cosine_ops);
