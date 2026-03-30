-- ============================================================
-- STAGING SCHEMA — adaptive-learning-core
-- Fixed Ordering: Extensions -> Enums -> Tables -> Functions -> Triggers -> Policies
-- ============================================================

-- ── 1. EXTENSIONS ───────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 2. ENUMS ────────────────────────────────────────────────
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- ── 3. TABLES (Core Structure) ──────────────────────────────

-- user_roles
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL, -- References auth.users(id)
    role public.app_role NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- profiles
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY, -- References auth.users(id)
    full_name TEXT,
    avatar_url TEXT,
    username TEXT,
    academic_goals JSONB DEFAULT '{"target_utme_score": 300}'::jsonb,
    subjects_meta JSONB DEFAULT '{}'::jsonb,
    current_streak INTEGER DEFAULT 0,
    last_activity_date DATE,
    utme_exam_date DATE,
    total_study_minutes INTEGER DEFAULT 0,
    xp_points INTEGER DEFAULT 0,
    daily_ai_quota INTEGER DEFAULT 50,
    is_premium BOOLEAN DEFAULT false,
    active_session_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- knowledge_graph
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

-- user_mastery_ledger
CREATE TABLE public.user_mastery_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
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

-- exam_logs
CREATE TABLE public.exam_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
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

-- past_questions
CREATE TABLE public.past_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject TEXT NOT NULL,
    topic TEXT NOT NULL,
    subtopic TEXT,
    year INTEGER,
    question_text TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    option_e TEXT,
    correct_option TEXT NOT NULL CHECK (correct_option IN ('A','B','C','D','E')),
    explanation TEXT,
    difficulty TEXT DEFAULT 'medium',
    metadata JSONB DEFAULT '{}'::jsonb,
    embedding vector(1536),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- exam_sessions
CREATE TABLE public.exam_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    subjects TEXT[] NOT NULL,
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','abandoned')),
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    completed_at TIMESTAMP WITH TIME ZONE,
    time_allowed_seconds INTEGER NOT NULL DEFAULT 7200,
    time_remaining_seconds INTEGER NOT NULL DEFAULT 7200,
    answers JSONB DEFAULT '{}'::jsonb,
    score INTEGER DEFAULT 0,
    total_questions INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- quizzes
CREATE TABLE public.quizzes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    subject TEXT NOT NULL,
    topic TEXT,
    questions JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- quiz_results
CREATE TABLE public.quiz_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    quiz_id UUID REFERENCES public.quizzes(id),
    subject TEXT NOT NULL,
    topic TEXT,
    score NUMERIC(5,2) NOT NULL,
    total_questions INTEGER NOT NULL,
    weak_topics TEXT[],
    answers JSONB DEFAULT '{}'::jsonb,
    completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- concept_mastery
CREATE TABLE public.concept_mastery (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    subject TEXT NOT NULL,
    topic TEXT NOT NULL,
    accuracy NUMERIC(5,2) NOT NULL DEFAULT 0,
    total_correct INTEGER NOT NULL DEFAULT 0,
    total_attempts INTEGER NOT NULL DEFAULT 0,
    last_quiz_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, subject, topic)
);

-- flashcards
CREATE TABLE public.flashcards (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    front_text TEXT NOT NULL,
    back_text TEXT NOT NULL,
    subject TEXT NOT NULL,
    topic TEXT NOT NULL,
    source TEXT DEFAULT 'manual',
    source_reference TEXT,
    source_question_id UUID,
    easiness_factor NUMERIC NOT NULL DEFAULT 2.5,
    interval_days INTEGER NOT NULL DEFAULT 1,
    repetitions INTEGER NOT NULL DEFAULT 0,
    next_review_date DATE NOT NULL DEFAULT CURRENT_DATE,
    last_reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- flashcard_reviews
CREATE TABLE public.flashcard_reviews (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    flashcard_id UUID NOT NULL REFERENCES public.flashcards(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 0 AND rating <= 4),
    time_to_recall_ms INTEGER,
    reviewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- study_sessions
CREATE TABLE public.study_sessions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    session_type TEXT NOT NULL DEFAULT 'general',
    subject TEXT,
    duration_minutes INTEGER NOT NULL DEFAULT 0,
    questions_answered INTEGER DEFAULT 0,
    flashcards_reviewed INTEGER DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    ended_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- user_achievements
CREATE TABLE public.user_achievements (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    achievement_id TEXT NOT NULL,
    earned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, achievement_id)
);

-- uploaded_content
CREATE TABLE public.uploaded_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    file_name TEXT NOT NULL,
    file_url TEXT,
    file_type TEXT NOT NULL,
    file_size INTEGER,
    raw_text TEXT,
    cleaned_markdown TEXT,
    detected_subject TEXT,
    detected_topic TEXT,
    concepts JSONB DEFAULT '[]'::jsonb,
    knowledge_summary TEXT,
    generated_questions JSONB DEFAULT '[]'::jsonb,
    extracted_formulas TEXT[] DEFAULT ARRAY[]::TEXT[],
    processing_status TEXT DEFAULT 'pending',
    processing_error TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- conversations
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    subject TEXT NOT NULL,
    title TEXT DEFAULT 'New Conversation',
    message_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ai_interactions
CREATE TABLE IF NOT EXISTS public.ai_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('student','tutor')),
    content TEXT NOT NULL,
    subject TEXT,
    topic TEXT,
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    feedback TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ai_usage_logs
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    feature_type TEXT NOT NULL,
    tokens_estimated INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- knowledge_base
CREATE TABLE IF NOT EXISTS public.knowledge_base (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    subject TEXT NOT NULL,
    topic TEXT NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ── 4. FUNCTIONS ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.update_user_streak()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  last_date DATE;
  current_date_val DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lagos')::DATE;
  user_exists BOOLEAN;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.user_id) INTO user_exists;
  IF NOT user_exists THEN
    RAISE WARNING 'User % not found in profiles, skipping streak update', NEW.user_id;
    RETURN NEW;
  END IF;
  SELECT last_activity_date INTO last_date FROM public.profiles WHERE id = NEW.user_id;
  IF last_date IS NULL OR last_date < current_date_val - INTERVAL '1 day' THEN
    UPDATE public.profiles SET current_streak = 1, last_activity_date = current_date_val WHERE id = NEW.user_id;
  ELSIF last_date = current_date_val - INTERVAL '1 day' THEN
    UPDATE public.profiles SET current_streak = current_streak + 1, last_activity_date = current_date_val WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'avatar_url');
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION get_daily_usage_count(p_user_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE usage_count integer;
BEGIN
  SELECT COUNT(*) INTO usage_count FROM public.ai_usage_logs
  WHERE user_id = p_user_id AND created_at >= CURRENT_DATE;
  RETURN COALESCE(usage_count, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.match_knowledge_base(
  query_embedding vector(1536), match_threshold float, match_count int, filter_subject text DEFAULT NULL
)
RETURNS TABLE (id uuid, subject text, topic text, content text, similarity float)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT k.id, k.subject, k.topic, k.content, 1 - (k.embedding <=> query_embedding) AS similarity
  FROM public.knowledge_base k
  WHERE 1 - (k.embedding <=> query_embedding) > match_threshold
    AND (filter_subject IS NULL OR k.subject = filter_subject)
  ORDER BY k.embedding <=> query_embedding LIMIT match_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_dashboard_data(p_user_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE result json;
BEGIN
  SELECT json_build_object(
    'profile', (SELECT json_build_object('utme_exam_date', p.utme_exam_date, 'current_streak', p.current_streak, 'academic_goals', p.academic_goals, 'subjects_meta', p.subjects_meta) FROM profiles p WHERE p.id = p_user_id),
    'mastery', (SELECT COALESCE(json_agg(json_build_object('subject', cm.subject, 'topic', cm.topic, 'accuracy', cm.accuracy, 'last_quiz_at', cm.last_quiz_at)), '[]'::json) FROM concept_mastery cm WHERE cm.user_id = p_user_id),
    'quiz_results', (SELECT COALESCE(json_agg(json_build_object('score', qr.score, 'total_questions', qr.total_questions, 'completed_at', qr.completed_at) ORDER BY qr.completed_at DESC), '[]'::json) FROM quiz_results qr WHERE qr.user_id = p_user_id),
    'study_sessions', (SELECT COALESCE(json_agg(json_build_object('started_at', ss.started_at, 'duration_minutes', ss.duration_minutes, 'session_type', ss.session_type, 'flashcards_reviewed', ss.flashcards_reviewed)), '[]'::json) FROM study_sessions ss WHERE ss.user_id = p_user_id AND ss.started_at >= (now() - interval '60 days')),
    'achievements', (SELECT COALESCE(json_agg(json_build_object('achievement_id', ua.achievement_id, 'earned_at', ua.earned_at)), '[]'::json) FROM user_achievements ua WHERE ua.user_id = p_user_id),
    'all_mastery_avg', (SELECT COALESCE(AVG(uml.mastery_score), 50) FROM user_mastery_ledger uml)
  ) INTO result;
  RETURN result;
END;
$$;

-- ── 5. TRIGGERS ──────────────────────────────────────────────
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_knowledge_graph_updated_at BEFORE UPDATE ON public.knowledge_graph FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_user_mastery_updated_at BEFORE UPDATE ON public.user_mastery_ledger FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_exam_sessions_updated_at BEFORE UPDATE ON public.exam_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_quizzes_updated_at BEFORE UPDATE ON public.quizzes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_concept_mastery_updated_at BEFORE UPDATE ON public.concept_mastery FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_flashcards_updated_at BEFORE UPDATE ON public.flashcards FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_uploaded_content_updated_at BEFORE UPDATE ON public.uploaded_content FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER on_exam_log_created AFTER INSERT ON public.exam_logs FOR EACH ROW EXECUTE FUNCTION public.update_user_streak();
CREATE TRIGGER update_streak_on_flashcard_review AFTER INSERT ON public.flashcard_reviews FOR EACH ROW EXECUTE FUNCTION public.update_user_streak();
CREATE TRIGGER update_streak_on_study_session AFTER INSERT ON public.study_sessions FOR EACH ROW EXECUTE FUNCTION public.update_user_streak();

-- Auth trigger setup (requires auth schema links)
-- Note: Replace with proper Supabase hook registration if using Dashboard UI
-- CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 6. INDEXES ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS profiles_username_lower_idx ON public.profiles (LOWER(username)) WHERE username IS NOT NULL;
CREATE INDEX exam_logs_user_id_idx ON public.exam_logs(user_id);
CREATE INDEX exam_logs_session_idx ON public.exam_logs(exam_session_id);
CREATE INDEX exam_logs_subject_idx ON public.exam_logs(subject);
CREATE INDEX user_mastery_user_id_idx ON public.user_mastery_ledger(user_id);
CREATE INDEX knowledge_graph_subject_idx ON public.knowledge_graph(subject);
CREATE INDEX idx_past_questions_subject ON public.past_questions(subject);
CREATE INDEX idx_past_questions_topic ON public.past_questions(subject, topic);
CREATE INDEX idx_exam_sessions_user ON public.exam_sessions(user_id);
CREATE INDEX idx_exam_sessions_status ON public.exam_sessions(user_id, status);
CREATE INDEX exam_sessions_user_score_idx ON public.exam_sessions(user_id, score DESC);
CREATE INDEX idx_quizzes_user_id ON public.quizzes(user_id);
CREATE INDEX idx_quizzes_status ON public.quizzes(status);
CREATE INDEX idx_quiz_results_user_id ON public.quiz_results(user_id);
CREATE INDEX idx_quiz_results_quiz_id ON public.quiz_results(quiz_id);
CREATE INDEX idx_concept_mastery_user_subject ON public.concept_mastery(user_id, subject);
CREATE INDEX idx_flashcards_user_id ON public.flashcards(user_id);
CREATE INDEX idx_flashcards_next_review ON public.flashcards(user_id, next_review_date);
CREATE INDEX idx_flashcards_subject ON public.flashcards(user_id, subject);
CREATE INDEX idx_flashcard_reviews_flashcard ON public.flashcard_reviews(flashcard_id);
CREATE INDEX idx_study_sessions_user_id ON public.study_sessions(user_id);
CREATE INDEX idx_study_sessions_started_at ON public.study_sessions(started_at);
CREATE INDEX idx_study_sessions_user_date ON public.study_sessions(user_id, started_at);
CREATE INDEX idx_user_achievements_user_id ON public.user_achievements(user_id);
CREATE INDEX idx_uploaded_content_user_id ON public.uploaded_content(user_id);
CREATE INDEX idx_uploaded_content_status ON public.uploaded_content(processing_status);
CREATE INDEX idx_uploaded_content_subject ON public.uploaded_content(detected_subject);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_date ON public.ai_usage_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_feature ON public.ai_usage_logs(feature_type, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_interactions_conversation_id_idx ON public.ai_interactions(conversation_id);
CREATE INDEX IF NOT EXISTS past_questions_embedding_idx ON public.past_questions USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS knowledge_base_embedding_idx ON public.knowledge_base USING hnsw (embedding vector_cosine_ops);

-- ── 7. RLS POLICIES ──────────────────────────────────────────

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_graph ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_mastery_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.past_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concept_mastery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcard_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploaded_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

-- Polices (Minimal logic for batch run)
CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated USING (true); -- Leaderboard enabled
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "knowledge_graph_view" ON public.knowledge_graph FOR SELECT TO authenticated USING (true);
CREATE POLICY "mastery_view" ON public.user_mastery_ledger FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "exam_logs_view" ON public.exam_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "past_questions_view" ON public.past_questions FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "past_questions_embed" ON public.past_questions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "exam_sessions_view" ON public.exam_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "quizzes_view" ON public.quizzes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "results_view" ON public.quiz_results FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "concept_view" ON public.concept_mastery FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "flashcards_view" ON public.flashcards FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "reviews_view" ON public.flashcard_reviews FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "study_view" ON public.study_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "achievements_view" ON public.user_achievements FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "uploads_view" ON public.uploaded_content FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "conversations_view" ON public.conversations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "interactions_view" ON public.ai_interactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "usage_view" ON public.ai_usage_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "rag_view" ON public.knowledge_base FOR SELECT TO authenticated USING (true);

-- ── 8. VIEWS ─────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.past_questions_public WITH (security_invoker = on) AS
SELECT id, subject, topic, subtopic, year, question_text,
       option_a, option_b, option_c, option_d, difficulty, metadata, created_at
FROM public.past_questions;

GRANT SELECT ON public.past_questions_public TO authenticated;

-- ── 9. STORAGE ───────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-documents', 'user-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "docs_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'user-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "docs_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'user-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "docs_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'user-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
