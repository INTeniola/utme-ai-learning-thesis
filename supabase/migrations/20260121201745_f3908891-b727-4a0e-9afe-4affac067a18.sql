-- Create a function to get all dashboard data in a single call
CREATE OR REPLACE FUNCTION public.get_dashboard_data(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'profile', (
      SELECT json_build_object(
        'utme_exam_date', p.utme_exam_date,
        'current_streak', p.current_streak,
        'academic_goals', p.academic_goals,
        'subjects_meta', p.subjects_meta
      )
      FROM profiles p
      WHERE p.id = p_user_id
    ),
    'mastery', (
      SELECT COALESCE(json_agg(json_build_object(
        'subject', cm.subject,
        'topic', cm.topic,
        'accuracy', cm.accuracy,
        'last_quiz_at', cm.last_quiz_at
      )), '[]'::json)
      FROM concept_mastery cm
      WHERE cm.user_id = p_user_id
    ),
    'quiz_results', (
      SELECT COALESCE(json_agg(json_build_object(
        'score', qr.score,
        'total_questions', qr.total_questions,
        'completed_at', qr.completed_at
      ) ORDER BY qr.completed_at DESC), '[]'::json)
      FROM quiz_results qr
      WHERE qr.user_id = p_user_id
    ),
    'study_sessions', (
      SELECT COALESCE(json_agg(json_build_object(
        'started_at', ss.started_at,
        'duration_minutes', ss.duration_minutes,
        'session_type', ss.session_type,
        'flashcards_reviewed', ss.flashcards_reviewed
      )), '[]'::json)
      FROM study_sessions ss
      WHERE ss.user_id = p_user_id
        AND ss.started_at >= (now() - interval '60 days')
    ),
    'achievements', (
      SELECT COALESCE(json_agg(json_build_object(
        'achievement_id', ua.achievement_id,
        'earned_at', ua.earned_at
      )), '[]'::json)
      FROM user_achievements ua
      WHERE ua.user_id = p_user_id
    ),
    'all_mastery_avg', (
      SELECT COALESCE(AVG(uml.mastery_score), 50)
      FROM user_mastery_ledger uml
    )
  ) INTO result;
  
  RETURN result;
END;
$$;