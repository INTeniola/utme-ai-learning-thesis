-- Create the unstructured context knowledge_base table
CREATE TABLE IF NOT EXISTS public.knowledge_base (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    subject TEXT NOT NULL,
    topic TEXT NOT NULL,
    content TEXT NOT NULL,
    embedding extensions.vector(1536),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create an HNSW index for fast nearest-neighbor search
CREATE INDEX IF NOT EXISTS knowledge_base_embedding_idx 
ON public.knowledge_base USING hnsw (embedding extensions.vector_cosine_ops);

-- Set up Row Level Security
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for querying context in the app)
CREATE POLICY "Allow public read access to knowledge_base" 
ON public.knowledge_base FOR SELECT 
USING (true);

-- Allow authenticated users / service_role to insert and update
CREATE POLICY "Allow authenticated full access to knowledge_base" 
ON public.knowledge_base FOR ALL 
USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');
