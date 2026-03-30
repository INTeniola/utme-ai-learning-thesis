-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Knowledge graph table for RAG with vector embeddings
CREATE TABLE public.knowledge_graph (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject TEXT NOT NULL,
    topic TEXT NOT NULL,
    subtopic TEXT,
    content_chunk TEXT NOT NULL,
    embedding extensions.vector(1536),
    source_year INTEGER,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on knowledge_graph
ALTER TABLE public.knowledge_graph ENABLE ROW LEVEL SECURITY;

-- User mastery ledger for tracking competency at sub-topic level
CREATE TABLE public.user_mastery_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    topic_id UUID REFERENCES public.knowledge_graph(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    topic TEXT NOT NULL,
    subtopic TEXT,
    mastery_score INTEGER DEFAULT 0 CHECK (mastery_score >= 0 AND mastery_score <= 100),
    error_patterns JSONB DEFAULT '[]'::jsonb,
    attempts_count INTEGER DEFAULT 0,
    last_practiced_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, subject, topic, subtopic)
);

-- Enable RLS on user_mastery_ledger
ALTER TABLE public.user_mastery_ledger ENABLE ROW LEVEL SECURITY;

-- Exam logs for detailed interaction tracking
CREATE TABLE public.exam_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    exam_session_id UUID NOT NULL,
    subject TEXT NOT NULL,
    question_index INTEGER NOT NULL,
    interaction_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    time_spent_seconds INTEGER DEFAULT 0,
    hints_used INTEGER DEFAULT 0,
    is_correct BOOLEAN,
    selected_answer TEXT,
    correct_answer TEXT,
    confidence_level INTEGER CHECK (confidence_level >= 1 AND confidence_level <= 5),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on exam_logs
ALTER TABLE public.exam_logs ENABLE ROW LEVEL SECURITY;

-- Create indexes for efficient querying
CREATE INDEX exam_logs_user_id_idx ON public.exam_logs(user_id);
CREATE INDEX exam_logs_session_idx ON public.exam_logs(exam_session_id);
CREATE INDEX exam_logs_subject_idx ON public.exam_logs(subject);
CREATE INDEX user_mastery_user_id_idx ON public.user_mastery_ledger(user_id);
CREATE INDEX knowledge_graph_subject_idx ON public.knowledge_graph(subject);