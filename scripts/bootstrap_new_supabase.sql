-- ================================================================
-- QUIZANT COMPLETE DATABASE BOOTSTRAP
-- Run this ONCE in your new Supabase SQL Editor
-- Project: https://nncuapyunhcmbpxflpgb.supabase.co
-- ================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 1. PROFILES ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  active_session_id TEXT,
  is_premium BOOLEAN DEFAULT FALSE,
  daily_ai_quota INTEGER DEFAULT 50,
  xp_points INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  last_activity_date DATE,
  total_study_minutes INTEGER DEFAULT 0,
  utme_exam_date DATE,
  academic_goals JSONB,
  subjects_meta JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. USER ROLES ────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. PAST QUESTIONS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.past_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject TEXT NOT NULL,
  year INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  option_e TEXT,
  correct_option TEXT NOT NULL CHECK (correct_option IN ('A','B','C','D','E')),
  explanation TEXT,
  topic TEXT NOT NULL DEFAULT 'General',
  subtopic TEXT,
  difficulty TEXT CHECK (difficulty IN ('easy','medium','hard')),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 4. JAMB SYLLABUS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.jamb_syllabus (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  subtopics JSONB,
  objectives TEXT[],
  recommended_resources TEXT[],
  syllabus_code TEXT,
  created_at TIMESTAMPTZ
);

-- ── 5. QUIZZES ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.quizzes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  focus_weak_topics BOOLEAN DEFAULT FALSE,
  question_count INTEGER DEFAULT 10,
  difficulty_mode TEXT DEFAULT 'medium',
  question_ids TEXT[],
  ai_generated_questions JSONB,
  status TEXT DEFAULT 'in_progress',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 6. QUIZ RESULTS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.quiz_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score INTEGER DEFAULT 0,
  total_questions INTEGER NOT NULL,
  time_taken_seconds INTEGER DEFAULT 0,
  hints_used INTEGER DEFAULT 0,
  answers JSONB,
  flagged_questions TEXT[],
  topic_breakdown JSONB,
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 7. CONCEPT MASTERY ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.concept_mastery (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  accuracy NUMERIC DEFAULT 0,
  total_attempts INTEGER DEFAULT 0,
  total_correct INTEGER DEFAULT 0,
  last_quiz_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, subject, topic)
);

-- ── 8. FLASHCARDS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.flashcards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  front_text TEXT NOT NULL,
  back_text TEXT NOT NULL,
  source TEXT,
  source_question_id UUID,
  source_reference TEXT,
  easiness_factor NUMERIC DEFAULT 2.5,
  interval_days INTEGER DEFAULT 1,
  repetitions INTEGER DEFAULT 0,
  next_review_date DATE DEFAULT CURRENT_DATE,
  last_reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 9. FLASHCARD REVIEWS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.flashcard_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  flashcard_id UUID NOT NULL REFERENCES public.flashcards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL,
  time_to_recall_ms INTEGER,
  reviewed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 10. KNOWLEDGE GRAPH ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.knowledge_graph (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  subtopic TEXT,
  content_chunk TEXT NOT NULL,
  embedding TEXT,
  source_year INTEGER,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 11. USER MASTERY LEDGER ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_mastery_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  subtopic TEXT,
  topic_id UUID REFERENCES public.knowledge_graph(id),
  mastery_score NUMERIC DEFAULT 0,
  attempts_count INTEGER DEFAULT 0,
  error_patterns JSONB,
  last_practiced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 12. STUDY SESSIONS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.study_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_type TEXT DEFAULT 'general',
  subject TEXT,
  duration_minutes INTEGER DEFAULT 0,
  questions_answered INTEGER DEFAULT 0,
  flashcards_reviewed INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 13. EXAM SESSIONS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.exam_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subjects TEXT[] NOT NULL,
  total_questions INTEGER DEFAULT 60,
  time_limit_minutes INTEGER DEFAULT 120,
  status TEXT DEFAULT 'in_progress',
  score INTEGER,
  answers JSONB,
  question_order TEXT[],
  current_question_index INTEGER DEFAULT 0,
  time_spent_per_question JSONB,
  diagnostic_data JSONB,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 14. EXAM LOGS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.exam_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exam_session_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  question_index INTEGER NOT NULL,
  selected_answer TEXT,
  correct_answer TEXT,
  is_correct BOOLEAN,
  confidence_level INTEGER,
  hints_used INTEGER DEFAULT 0,
  time_spent_seconds INTEGER,
  interaction_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 15. CONVERSATIONS & AI INTERACTIONS ────────────────────────
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  title TEXT DEFAULT 'New Conversation',
  message_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ai_interactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  message_type TEXT NOT NULL,
  content TEXT NOT NULL,
  context JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ
);

-- ── 16. AI USAGE LOGS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature_type TEXT NOT NULL,
  tokens_estimated INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 17. USER ACHIEVEMENTS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 18. UPLOADED CONTENT ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.uploaded_content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  file_url TEXT,
  processing_status TEXT DEFAULT 'pending',
  processing_error TEXT,
  raw_text TEXT,
  cleaned_markdown TEXT,
  knowledge_summary TEXT,
  detected_subject TEXT,
  detected_topic TEXT,
  concepts JSONB,
  generated_questions JSONB,
  extracted_formulas TEXT[],
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

-- ── VIEW: past_questions_public (no correct_option exposed) ──────
CREATE OR REPLACE VIEW public.past_questions_public AS
  SELECT id, subject, year, question_text,
         option_a, option_b, option_c, option_d, option_e,
         topic, subtopic, difficulty, metadata, created_at
  FROM public.past_questions;

-- ================================================================
-- ROW LEVEL SECURITY
-- ================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concept_mastery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcard_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_mastery_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploaded_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Users can only see/edit their own data
CREATE POLICY "users_own_profile" ON public.profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "users_own_quizzes" ON public.quizzes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_quiz_results" ON public.quiz_results FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_concept_mastery" ON public.concept_mastery FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_flashcards" ON public.flashcards FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_flashcard_reviews" ON public.flashcard_reviews FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_study_sessions" ON public.study_sessions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_exam_sessions" ON public.exam_sessions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_exam_logs" ON public.exam_logs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_ai_interactions" ON public.ai_interactions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_conversations" ON public.conversations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_ai_usage" ON public.ai_usage_logs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_achievements" ON public.user_achievements FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_mastery" ON public.user_mastery_ledger FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_uploads" ON public.uploaded_content FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- Public read for questions and syllabus (no auth required)
ALTER TABLE public.past_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jamb_syllabus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_graph ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_questions" ON public.past_questions FOR SELECT USING (TRUE);
CREATE POLICY "public_read_syllabus" ON public.jamb_syllabus FOR SELECT USING (TRUE);
CREATE POLICY "public_read_knowledge" ON public.knowledge_graph FOR SELECT USING (TRUE);

-- ================================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, updated_at)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ================================================================
-- INDEXES FOR PERFORMANCE
-- ================================================================
CREATE INDEX IF NOT EXISTS idx_past_questions_subject ON public.past_questions(subject);
CREATE INDEX IF NOT EXISTS idx_past_questions_topic ON public.past_questions(topic);
CREATE INDEX IF NOT EXISTS idx_quizzes_user_id ON public.quizzes(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_results_user_id ON public.quiz_results(user_id);
CREATE INDEX IF NOT EXISTS idx_concept_mastery_user_subject ON public.concept_mastery(user_id, subject);
CREATE INDEX IF NOT EXISTS idx_flashcards_user_review ON public.flashcards(user_id, next_review_date);

-- ================================================================
-- DONE ✅
-- ================================================================
SELECT 'Bootstrap complete. Tables created: ' || count(*)::text || ' tables.'
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

-- ================================================================
-- TIMEZONE-AWARE STREAK TRACKING (AFRICA/LAGOS)
-- ================================================================
CREATE OR REPLACE FUNCTION public.update_user_streak()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
