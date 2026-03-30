-- Create ai_interactions table for conversation persistence
CREATE TABLE public.ai_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  session_id UUID NOT NULL,
  message_type TEXT NOT NULL CHECK (message_type IN ('student', 'tutor')),
  content TEXT NOT NULL,
  context JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fetching user conversations efficiently
CREATE INDEX idx_ai_interactions_user ON public.ai_interactions(user_id, created_at DESC);
CREATE INDEX idx_ai_interactions_session ON public.ai_interactions(session_id, created_at ASC);

-- Enable RLS
ALTER TABLE public.ai_interactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can insert own interactions" ON public.ai_interactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own interactions" ON public.ai_interactions
  FOR SELECT USING (auth.uid() = user_id);

-- Create jamb_syllabus table for context injection
CREATE TABLE public.jamb_syllabus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  subtopics JSONB DEFAULT '[]'::jsonb,
  objectives TEXT[] DEFAULT ARRAY[]::TEXT[],
  recommended_resources TEXT[] DEFAULT ARRAY[]::TEXT[],
  syllabus_code TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(subject, topic)
);

-- Index for quick lookups
CREATE INDEX idx_jamb_syllabus_lookup ON public.jamb_syllabus(subject, topic);

-- Enable RLS
ALTER TABLE public.jamb_syllabus ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view syllabus
CREATE POLICY "Authenticated users can view syllabus" ON public.jamb_syllabus
  FOR SELECT USING (true);

-- Only admins can manage syllabus
CREATE POLICY "Admins can manage syllabus" ON public.jamb_syllabus
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));