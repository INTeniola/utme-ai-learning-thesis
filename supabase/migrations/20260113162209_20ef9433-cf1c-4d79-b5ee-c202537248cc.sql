-- Create a secure view that hides correct answers and explanations
CREATE VIEW public.past_questions_public
WITH (security_invoker = on) AS
SELECT 
  id,
  subject,
  topic,
  subtopic,
  year,
  question_text,
  option_a,
  option_b,
  option_c,
  option_d,
  difficulty,
  metadata,
  created_at
FROM public.past_questions;
-- Excludes: correct_option, explanation

-- Drop existing permissive policies on past_questions
DROP POLICY IF EXISTS "Authenticated users can view past questions" ON public.past_questions;
DROP POLICY IF EXISTS "Admins can manage past questions" ON public.past_questions;

-- Create restrictive policies - only admins can access base table directly
CREATE POLICY "Only admins can view past questions directly"
ON public.past_questions FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert past questions"
ON public.past_questions FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update past questions"
ON public.past_questions FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete past questions"
ON public.past_questions FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- Grant SELECT on the view to authenticated users
GRANT SELECT ON public.past_questions_public TO authenticated;