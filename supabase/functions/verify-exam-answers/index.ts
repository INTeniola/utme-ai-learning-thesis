import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/gemini.ts";

interface VerifyRequest {
  sessionId?: string;
  answers: Record<string, string>;
}

interface QuestionResult {
  questionId: string;
  userAnswer: string;
  correctOption: string;
  isCorrect: boolean;
  explanation: string | null;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders();

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the user from the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { sessionId, answers } = await req.json() as VerifyRequest;

    if (!answers) {
      return new Response(
        JSON.stringify({ error: 'Answers are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If a session ID is provided, verify the session belongs to this user
    if (sessionId) {
      const { data: session, error: sessionError } = await supabase
        .from('exam_sessions')
        .select('id, user_id, question_order, status')
        .eq('id', sessionId)
        .single();

      if (sessionError || !session) {
        return new Response(
          JSON.stringify({ error: 'Session not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (session.user_id !== user.id) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized access to session' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Get the questions with correct answers (using service role key bypasses RLS)
    const questionIds = Object.keys(answers);
    const { data: questions, error: questionsError } = await supabase
      .from('past_questions')
      .select('id, subject, topic, correct_option, explanation')
      .in('id', questionIds);

    if (questionsError) {
      console.error('Failed to fetch questions:', questionsError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify answers' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build results
    const results: QuestionResult[] = [];
    let correctCount = 0;
    const subjectBreakdown: Record<string, { correct: number; total: number }> = {};
    const topicBreakdown: Record<string, { correct: number; total: number }> = {};

    for (const question of questions || []) {
      const userAnswer = answers[question.id] || '';
      const isCorrect = userAnswer === question.correct_option;

      if (isCorrect) correctCount++;

      results.push({
        questionId: question.id,
        userAnswer,
        correctOption: question.correct_option,
        isCorrect,
        explanation: question.explanation,
      });

      // Subject breakdown
      if (!subjectBreakdown[question.subject]) {
        subjectBreakdown[question.subject] = { correct: 0, total: 0 };
      }
      subjectBreakdown[question.subject].total++;
      if (isCorrect) subjectBreakdown[question.subject].correct++;

      // Topic breakdown
      const topicKey = `${question.subject} - ${question.topic}`;
      if (!topicBreakdown[topicKey]) {
        topicBreakdown[topicKey] = { correct: 0, total: 0 };
      }
      topicBreakdown[topicKey].total++;
      if (isCorrect) topicBreakdown[topicKey].correct++;
    }

    const response = {
      score: correctCount,
      totalQuestions: questions?.length || 0,
      percentage: questions?.length ? Math.round((correctCount / questions.length) * 100) : 0,
      results,
      subjectBreakdown,
      topicBreakdown,
    };
    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Verify answers error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Verification failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
