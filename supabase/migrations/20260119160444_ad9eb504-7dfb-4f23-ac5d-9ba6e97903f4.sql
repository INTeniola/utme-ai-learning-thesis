-- Create flashcards table for spaced repetition system
CREATE TABLE public.flashcards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  front_text TEXT NOT NULL,
  back_text TEXT NOT NULL,
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  source TEXT DEFAULT 'manual', -- 'manual', 'quiz_mistake', 'past_question', 'ai_generated'
  source_reference TEXT, -- e.g., 'JAMB 2023 Math Q15'
  source_question_id UUID, -- Reference to past_questions if applicable
  easiness_factor NUMERIC NOT NULL DEFAULT 2.5,
  interval_days INTEGER NOT NULL DEFAULT 1,
  repetitions INTEGER NOT NULL DEFAULT 0,
  next_review_date DATE NOT NULL DEFAULT CURRENT_DATE,
  last_reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create flashcard_reviews table for tracking review history
CREATE TABLE public.flashcard_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  flashcard_id UUID NOT NULL REFERENCES public.flashcards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 0 AND rating <= 4),
  time_to_recall_ms INTEGER,
  reviewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcard_reviews ENABLE ROW LEVEL SECURITY;

-- RLS policies for flashcards
CREATE POLICY "Users can view their own flashcards"
  ON public.flashcards FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own flashcards"
  ON public.flashcards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own flashcards"
  ON public.flashcards FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own flashcards"
  ON public.flashcards FOR DELETE
  USING (auth.uid() = user_id);

-- RLS policies for flashcard_reviews
CREATE POLICY "Users can view their own flashcard reviews"
  ON public.flashcard_reviews FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own flashcard reviews"
  ON public.flashcard_reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_flashcards_user_id ON public.flashcards(user_id);
CREATE INDEX idx_flashcards_next_review ON public.flashcards(user_id, next_review_date);
CREATE INDEX idx_flashcards_subject ON public.flashcards(user_id, subject);
CREATE INDEX idx_flashcard_reviews_flashcard ON public.flashcard_reviews(flashcard_id);

-- Trigger to update updated_at
CREATE TRIGGER update_flashcards_updated_at
  BEFORE UPDATE ON public.flashcards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to update user streak on flashcard review
CREATE TRIGGER update_streak_on_flashcard_review
  AFTER INSERT ON public.flashcard_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_streak();