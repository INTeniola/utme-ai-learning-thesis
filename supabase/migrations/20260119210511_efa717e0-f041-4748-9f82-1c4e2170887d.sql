-- Add total_study_minutes and xp_points to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS total_study_minutes integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS xp_points integer DEFAULT 0;

-- Create uploaded_content table for document storage
CREATE TABLE public.uploaded_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  file_name text NOT NULL,
  file_url text,
  file_type text NOT NULL,
  file_size integer,
  
  -- Extracted content
  raw_text text,
  cleaned_markdown text,
  
  -- AI Analysis
  detected_subject text,
  detected_topic text,
  concepts jsonb DEFAULT '[]'::jsonb,
  knowledge_summary text,
  
  -- Generated content
  generated_questions jsonb DEFAULT '[]'::jsonb,
  extracted_formulas text[] DEFAULT ARRAY[]::text[],
  
  -- Metadata
  processing_status text DEFAULT 'pending',
  processing_error text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.uploaded_content ENABLE ROW LEVEL SECURITY;

-- RLS policies for uploaded_content
CREATE POLICY "Users can view their own uploaded content"
ON public.uploaded_content FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own uploaded content"
ON public.uploaded_content FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own uploaded content"
ON public.uploaded_content FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own uploaded content"
ON public.uploaded_content FOR DELETE
USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_uploaded_content_user_id ON public.uploaded_content(user_id);
CREATE INDEX idx_uploaded_content_status ON public.uploaded_content(processing_status);
CREATE INDEX idx_uploaded_content_subject ON public.uploaded_content(detected_subject);

-- Add trigger for updated_at
CREATE TRIGGER update_uploaded_content_updated_at
BEFORE UPDATE ON public.uploaded_content
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for user documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('user-documents', 'user-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for user-documents bucket
CREATE POLICY "Users can upload their own documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'user-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view their own documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'user-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete their own documents"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'user-documents' AND (storage.foldername(name))[1] = auth.uid()::text);