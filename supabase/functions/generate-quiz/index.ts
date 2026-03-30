// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callGemini, checkRateLimit, getCorsHeaders, handleEdgeFunctionError } from "../_shared/gemini.ts";

/**
 * Normalise the incoming subject string to match the exact value stored in the
 * past_questions table. This prevents cross-subject contamination when the
 * frontend sends lowercase IDs (e.g. 'english') or alternate spellings.
 */
const SUBJECT_NORMALISATION_MAP: Record<string, string> = {
  english: 'English',
  mathematics: 'Mathematics',
  math: 'Mathematics',
  maths: 'Mathematics',
  physics: 'Physics',
  chemistry: 'Chemistry',
  biology: 'Biology',
  geography: 'Geography',
  government: 'Government',
  economics: 'Economics',
  literature: 'Literature',
  'literature in english': 'English',
  'english language': 'English',
};

/**
 * Core function: normaliseSubject
 *  * 
 *  * **Side Effects:** Interacts with Supabase or external APIs.
 *  * @param raw - The raw parameter
 *  * @returns {string} The expected output
 */
function normaliseSubject(raw: string): string {
  const key = raw.toLowerCase().trim();
  return SUBJECT_NORMALISATION_MAP[key] ?? raw.charAt(0).toUpperCase() + raw.slice(1);
}

const AI_QUESTION_GENERATION_PROMPT = `You are an expert JAMB UTME question generator.

CRITICAL RULE — SUBJECT LOCK:
- You will be told which SUBJECT to generate questions for.
- Every single question you generate MUST belong to that subject and ONLY that subject.
- If the subject is English, generate ONLY English language / comprehension / grammar / oral English / literature questions.
- If the subject is Physics, generate ONLY Physics questions.
- If the subject is Mathematics, generate ONLY Mathematics questions.
- NEVER mix subjects. A Physics question appearing in an English quiz, or vice versa, is a critical failure.

REQUIREMENTS:
1. Questions must be at the specified difficulty level
2. Questions must test understanding, not just memorization
3. All options must be plausible - no obviously wrong answers
4. Include mathematical expressions in LaTeX format where appropriate (use $...$ for inline, $$...$$ for display)
5. Each question must have exactly 4 options (A, B, C, D)
6. Provide clear, educational explanations
7. Return a RAW JSON array only. No markdown, no filler text.

DIFFICULTY GUIDELINES:
- Easy: Basic recall and simple application
- Medium: Standard JAMB level, requires understanding
- Hard: Complex problem-solving, multi-step reasoning

FORMAT:
[
  {
    "questionText": "The question text here",
    "options": {
      "A": "First option",
      "B": "Second option",
      "C": "Third option",
      "D": "Fourth option"
    },
    "correctAnswer": "A",
    "explanation": "Clear explanation of why this is correct",
    "topic": "Specific topic name",
    "difficulty": "easy|medium|hard",
    "passageText": "Optional reading passage or shared text if applicable"
  }
]`;

interface QuizRequest {
  subject: string;
  topic?: string;
  userId?: string;
  focusWeakTopics: boolean;
  questionCount: 10 | 20;
  difficultyMode: 'easy' | 'medium' | 'hard' | 'auto-adapt';
}

interface GeneratedQuestion {
  id: string;
  questionText: string;
  options: { A: string; B: string; C: string; D: string };
  correctAnswer: string;
  explanation: string;
  topic: string;
  difficulty: string;
  passageText?: string;
}

/**
 * Core function: generateAIQuestions
 *  * 
 *  * **Side Effects:** Interacts with Supabase or external APIs.
 *  * @param subject - The subject parameter
 *  * @param topics - The topics parameter
 *  * @param count - The count parameter
 *  * @param difficulty - The difficulty parameter
 *  * @returns {Promise<GeneratedQuestion[]>} The expected output
 */
async function generateAIQuestions(
  subject: string,
  topics: string[],
  count: number,
  difficulty: string
): Promise<GeneratedQuestion[]> {
  const topicsStr = topics.length > 0 ? topics.join(', ') : 'various topics';
  const prompt = `SUBJECT: ${subject}\nGenerate ${count} ${difficulty} difficulty ${subject} questions for JAMB UTME.\nFocus on these topics: ${topicsStr}\nREMEMBER: Every question must be exclusively about ${subject}. Do not generate any question from another subject.`;

  try {
    const content = await callGemini(prompt, {
      model: 'gemini-3.1-flash-lite-preview',
      systemInstruction: AI_QUESTION_GENERATION_PROMPT,
      temperature: 0.8,
      maxOutputTokens: 4000,
    });

    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error("Could not parse AI response as JSON array");
      return [];
    }

    const questions = JSON.parse(jsonMatch[0]);
    return questions.map((q: GeneratedQuestion, index: number) => ({
      ...q,
      id: `ai-${Date.now()}-${index}`,
    }));
  } catch (error) {
    console.error("Error generating AI questions:", error);
    return [];
  }
}

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders();

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Missing or invalid authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Server-side rate limit check
    const rateLimitResponse = await checkRateLimit(user.id, 'generate-quiz', corsHeaders);
    if (rateLimitResponse) return rateLimitResponse;

    const body: QuizRequest = await req.json();
    const { subject: rawSubject, topic, userId: reqUserId, focusWeakTopics, difficultyMode } = body;
    const questionCount = body.questionCount ?? 10;
    // Normalise subject to the exact string stored in past_questions
    const subject = normaliseSubject(rawSubject);
    const userId = reqUserId || user.id;
    // Fetch previously seen questions for deduplication
    let seenQuestionIds: string[] = [];
    if (userId) {
      const { data: history } = await supabase
        .from('ai_interactions')
        .select('metadata')
        .eq('user_id', userId)
        .eq('message_type', 'quiz_question_seen')
        .order('created_at', { ascending: false })
        .limit(200);

      seenQuestionIds = history?.map((h: any) => h.metadata?.questionId).filter(Boolean) || [];
    }

    const dbQuestionCount = Math.floor(questionCount * 0.7);
    const aiQuestionCount = questionCount - dbQuestionCount;

    let weakTopics: string[] = [];
    if (focusWeakTopics) {
      const { data: masteryData } = await supabase
        .from('concept_mastery')
        .select('topic')
        .eq('user_id', userId)
        .eq('subject', subject)
        .lt('accuracy', 60)
        .gt('total_attempts', 0);
      if (masteryData) weakTopics = masteryData.map((m: any) => m.topic);
    }

    let difficulties = ['medium'];
    if (difficultyMode === 'easy') difficulties = ['easy'];
    else if (difficultyMode === 'hard') difficulties = ['hard'];
    else if (difficultyMode === 'auto-adapt') {
      const { data: recentResults } = await supabase
        .from('quiz_results')
        .select('score, total_questions')
        .eq('user_id', userId)
        .order('completed_at', { ascending: false })
        .limit(3);

      if (recentResults?.length) {
        const avgScore = recentResults.reduce((sum: number, r: any) => sum + (r.score / r.total_questions) * 100, 0) / recentResults.length;
        if (avgScore < 50) difficulties = ['easy', 'medium'];
        else if (avgScore > 80) difficulties = ['medium', 'hard'];
        else difficulties = ['easy', 'medium', 'hard'];
      }
    }

    const allDbQuestions: any[] = [];

    // Helper to try fetching questions with difficulty fallback
    async function fetchWithFallback(queryFn: () => any, difficultiesToTry: string[], limit: number) {
      if (limit <= 0) return [];
      
      for (const diff of difficultiesToTry) {
        const { data } = await queryFn().in('difficulty', [diff]).limit(limit);
        if (data && data.length > 0) return data;
      }
      // Final fallback: try any difficulty (including NULL)
      const { data } = await queryFn().limit(limit);
      return data || [];
    }

    if (topic) {
      const topicQuestions = await fetchWithFallback(
        () => {
          let q = supabase.from('past_questions').select('*').eq('subject', subject).eq('topic', topic);
          if (seenQuestionIds.length > 0) q = q.not('id', 'in', seenQuestionIds);
          return q;
        },
        difficulties,
        dbQuestionCount
      );
      if (topicQuestions) allDbQuestions.push(...topicQuestions);
    } else if (focusWeakTopics && weakTopics.length > 0) {
      const weakTopicQuestions = await fetchWithFallback(
        () => {
          let q = supabase.from('past_questions').select('*').eq('subject', subject).in('topic', weakTopics);
          if (seenQuestionIds.length > 0) q = q.not('id', 'in', seenQuestionIds);
          return q;
        },
        difficulties,
        dbQuestionCount
      );
      if (weakTopicQuestions) allDbQuestions.push(...weakTopicQuestions);
    }

    const remainingCount = dbQuestionCount - allDbQuestions.length;
    if (remainingCount > 0) {
      const existingIds = allDbQuestions.map(q => q.id);
      const randomQuestions = await fetchWithFallback(
        () => {
          let q = supabase.from('past_questions').select('*').eq('subject', subject);
          if (topic) q = q.eq('topic', topic);
          const excludeIds = [...existingIds, ...seenQuestionIds];
          if (excludeIds.length > 0) q = q.not('id', 'in', excludeIds);
          return q;
        },
        difficulties,
        remainingCount
      );

      if (randomQuestions) {
        const filtered = randomQuestions
          .filter((q: any) => !existingIds.includes(q.id))
          .sort(() => Math.random() - 0.5)
          .slice(0, remainingCount);
        allDbQuestions.push(...filtered);
      }
    }

    // Proactive AI questions (30%) + AI Fallback for missing DB questions
    const totalAiNeeded = aiQuestionCount + (dbQuestionCount - allDbQuestions.length);
    const aiQuestions: any[] = [];
    
    if (totalAiNeeded > 0) {
      console.log(`Generating ${totalAiNeeded} AI questions for ${subject}`);
      const fallbackAi = await generateAIQuestions(
        subject, 
        topic ? [topic] : weakTopics.slice(0, 3), 
        totalAiNeeded, 
        difficultyMode === 'auto-adapt' ? 'medium' : difficultyMode
      );
      if (fallbackAi) aiQuestions.push(...fallbackAi);
    }

    const formattedQuestions = [
      ...allDbQuestions.map(q => ({
        id: q.id,
        questionText: q.question_text,
        options: { A: q.option_a, B: q.option_b, C: q.option_c, D: q.option_d },
        subject: q.subject,
        topic: q.topic,
        isAIGenerated: false,
        correctAnswer: q.correct_option,
        explanation: q.explanation,
        passageText: q.passage_text || q.linked_passage || q.metadata?.passage_text || q.metadata?.linked_passage,
      })),
      ...aiQuestions.map(q => ({
        id: q.id,
        questionText: q.questionText,
        options: q.options,
        subject,
        topic: q.topic,
        isAIGenerated: true,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        passageText: q.passageText,
      })),
    ].sort(() => Math.random() - 0.5);

    const questionIds = formattedQuestions.filter(q => !q.isAIGenerated).map(q => q.id);
    const aiGeneratedData = formattedQuestions.filter(q => q.isAIGenerated).map(q => ({
      id: q.id,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
    }));

    const { data: quizData, error: quizError } = await supabase
      .from('quizzes')
      .insert({
        user_id: userId,
        subject,
        focus_weak_topics: focusWeakTopics,
        question_count: questionCount,
        difficulty_mode: difficultyMode,
        question_ids: questionIds,
        ai_generated_questions: aiGeneratedData,
        status: 'in_progress',
      })
      .select()
      .single();

    if (quizError) throw new Error("Failed to create quiz");

    if (formattedQuestions.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'NO_QUESTIONS_FOUND', 
          message: `We couldn't find enough past questions for ${subject} ${topic ? `(${topic})` : ''} at the ${difficultyMode} level. Please try a different topic or difficulty.`
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ quizId: quizData.id, questions: formattedQuestions }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return handleEdgeFunctionError(error, getCorsHeaders());
  }
});
