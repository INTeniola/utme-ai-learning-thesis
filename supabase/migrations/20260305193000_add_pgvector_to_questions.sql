-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector
with
  schema extensions;

-- Add embedding column to past_questions table
-- text-embedding-3-small outputs 1536 dimensions
alter table public.past_questions 
add column if not exists embedding extensions.vector(1536);

-- Create an HNSW index for fast nearest-neighbor search
create index if not exists past_questions_embedding_idx 
on public.past_questions 
using hnsw (embedding extensions.vector_cosine_ops);

-- Update RLS policies to allow updating embeddings
drop policy if exists "Authenticated users can update embeddings" on public.past_questions;
create policy "Authenticated users can update embeddings"
on public.past_questions for update
using (auth.role() = 'authenticated'); -- Allow authenticated users (or service_role which bypasses RLS)
