-- Optimize pagination and filtering for PastQuestionsBrowser
-- Creates a composite index to accelerate queries filtering by subject, year, and topic simultaneously

CREATE INDEX IF NOT EXISTS idx_past_questions_browser ON public.past_questions(subject, year, topic);
