// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/gemini.ts";

interface VerifyRequest {
  quizId: string;
  answers: Record<string, string>;
  timeTaken: number;
  hintsUsed: number;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders();

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }


  try {
    const { quizId, answers, timeTaken, hintsUsed }: VerifyRequest = await req.json();

    // Extract and verify user from auth token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Missing or invalid authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify the user from the auth token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;
    // Get quiz data and verify ownership
    const { data: quiz, error: quizError } = await supabase
      .from('quizzes')
      .select('*')
      .eq('id', quizId)
      .eq('user_id', userId)  // Verify the quiz belongs to the authenticated user
      .single();

    if (quizError || !quiz) {
      return new Response(
        JSON.stringify({ error: 'Quiz not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get correct answers from past_questions
    const dbQuestionIds = quiz.question_ids || [];
    const aiQuestions = quiz.ai_generated_questions || [];

    let correctAnswersMap: Record<string, { correct: string; topic: string; explanation?: string }> = {};

    // Fetch correct answers for DB questions
    if (dbQuestionIds.length > 0) {
      const { data: dbQuestions } = await supabase
        .from('past_questions')
        .select('id, correct_option, topic, explanation')
        .in('id', dbQuestionIds);

      if (dbQuestions) {
        dbQuestions.forEach(q => {
          correctAnswersMap[q.id] = {
            correct: q.correct_option,
            topic: q.topic,
            explanation: q.explanation,
          };
        });
      }
    }

    // Add AI-generated question answers
    aiQuestions.forEach((q: { id: string; correctAnswer: string; topic?: string; explanation?: string }) => {
      correctAnswersMap[q.id] = {
        correct: q.correctAnswer,
        topic: q.topic || 'General',
        explanation: q.explanation,
      };
    });

    // Calculate results
    let score = 0;
    const totalQuestions = Object.keys(correctAnswersMap).length;
    const answerResults: Record<string, { selected: string; correct: string; isCorrect: boolean }> = {};
    const topicStats: Record<string, { correct: number; total: number }> = {};

    Object.entries(correctAnswersMap).forEach(([questionId, data]) => {
      const userAnswer = answers[questionId] || '';
      const isCorrect = userAnswer.toUpperCase() === data.correct.toUpperCase();

      if (isCorrect) {
        score++;
      }

      answerResults[questionId] = {
        selected: userAnswer,
        correct: data.correct,
        isCorrect,
      };

      // Track topic performance
      if (!topicStats[data.topic]) {
        topicStats[data.topic] = { correct: 0, total: 0 };
      }
      topicStats[data.topic].total++;
      if (isCorrect) {
        topicStats[data.topic].correct++;
      }
    });

    // Apply hint penalty
    const finalScore = Math.max(0, score - hintsUsed);

    // Calculate topic breakdown with percentages
    const topicBreakdown: Record<string, { correct: number; total: number; percentage: number }> = {};
    Object.entries(topicStats).forEach(([topic, stats]) => {
      topicBreakdown[topic] = {
        ...stats,
        percentage: Math.round((stats.correct / stats.total) * 100),
      };
    });

    const percentage = Math.round((finalScore / totalQuestions) * 100);
    // Save quiz result
    const { error: resultError } = await supabase
      .from('quiz_results')
      .insert({
        quiz_id: quizId,
        user_id: userId,
        score: finalScore,
        total_questions: totalQuestions,
        time_taken_seconds: timeTaken,
        topic_breakdown: topicBreakdown,
        answers: answerResults,
        hints_used: hintsUsed,
      });

    if (resultError) {
      console.error("Error saving result:", resultError);
    }

    // Update quiz status
    await supabase
      .from('quizzes')
      .update({ status: 'completed' })
      .eq('id', quizId);

    // Update concept mastery for each topic
    for (const [topic, stats] of Object.entries(topicStats)) {
      // Check if mastery record exists
      const { data: existing } = await supabase
        .from('concept_mastery')
        .select('*')
        .eq('user_id', userId)
        .eq('subject', quiz.subject)
        .eq('topic', topic)
        .maybeSingle();

      if (existing) {
        // Update existing record
        const newTotalCorrect = existing.total_correct + stats.correct;
        const newTotalAttempts = existing.total_attempts + stats.total;
        const newAccuracy = (newTotalCorrect / newTotalAttempts) * 100;

        await supabase
          .from('concept_mastery')
          .update({
            total_correct: newTotalCorrect,
            total_attempts: newTotalAttempts,
            accuracy: newAccuracy,
            last_quiz_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } else {
        // Create new record
        const accuracy = (stats.correct / stats.total) * 100;

        await supabase
          .from('concept_mastery')
          .insert({
            user_id: userId,
            subject: quiz.subject,
            topic: topic,
            total_correct: stats.correct,
            total_attempts: stats.total,
            accuracy: accuracy,
            last_quiz_at: new Date().toISOString(),
          });
      }
    }

    // Update user_mastery_ledger as well for consistency
    for (const [topic, stats] of Object.entries(topicStats)) {
      const { data: ledger } = await supabase
        .from('user_mastery_ledger')
        .select('*')
        .eq('user_id', userId)
        .eq('subject', quiz.subject)
        .eq('topic', topic)
        .maybeSingle();

      if (ledger) {
        const newAttempts = (ledger.attempts_count || 0) + stats.total;
        const sessionScore = (stats.correct / stats.total) * 100;
        const oldScore = ledger.mastery_score || 0;
        const newScore = Math.round((oldScore * 0.7) + (sessionScore * 0.3));

        await supabase
          .from('user_mastery_ledger')
          .update({
            attempts_count: newAttempts,
            mastery_score: newScore,
            last_practiced_at: new Date().toISOString(),
          })
          .eq('id', ledger.id);
      } else {
        const accuracy = Math.round((stats.correct / stats.total) * 100);

        await supabase
          .from('user_mastery_ledger')
          .insert({
            user_id: userId,
            subject: quiz.subject,
            topic: topic,
            attempts_count: stats.total,
            mastery_score: accuracy,
            last_practiced_at: new Date().toISOString(),
          });
      }
    }

    return new Response(JSON.stringify({
      score: finalScore,
      totalQuestions,
      percentage,
      timeTaken,
      topicBreakdown,
      hintsUsed,
      answers: answerResults,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Verify quiz error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Failed to verify quiz"
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
