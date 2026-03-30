import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callGeminiWithHistory, checkRateLimit, getCorsHeaders, handleEdgeFunctionError } from "../_shared/gemini.ts";

const PEDAGOGICAL_SCAFFOLDING_PROMPT = `You are an expert Socratic tutor for UTME/JAMB preparation. You operate under a strict "Pedagogical Scaffolding" framework.

CORE PRINCIPLES:
1. NEVER give direct answers - guide students to discover answers themselves
2. Identify the student's "Zone of Proximal Development" (ZPD) - what they can almost do with guidance
3. Provide scaffolded hints that build on prior knowledge
4. Use probing questions to uncover misconceptions
5. Celebrate effort and progress, not just correctness

RESPONSE STRUCTURE:
1. First, acknowledge what the student understands correctly
2. Identify the specific conceptual gap or misconception
3. Ask a simpler, scaffolded question that leads toward understanding
4. If the student is struggling after 2-3 attempts, provide a worked example of a SIMILAR (not the same) problem
5. Use LaTeX for mathematical expressions (wrap in $..$ for inline, $$...$$ for display)

TONE:
- Warm, encouraging, and patient
- Never condescending
- Celebrate small wins
- Frame mistakes as learning opportunities

SUBJECT EXPERTISE:
- Mathematics, Physics, Chemistry, Biology, English
- Focus on JAMB/UTME syllabus content
- Use Nigerian educational context where appropriate`;

interface SyllabusData {
  topic: string;
  subtopics: { name: string; objectives?: string[] }[] | null;
  objectives: string[] | null;
  recommended_resources: string[] | null;
}

interface TutorRequest {
  context: {
    subject: string;
    topic: string;
    subtopic?: string;
    currentQuestion?: string;
    studentAnswer?: string;
    correctAnswer?: string;
    previousInteractions?: Array<{
      role: 'student' | 'tutor';
      content: string;
    }>;
    masteryScore?: number;
    consecutiveErrors?: number;
  };
  studentMessage: string;
}

const SUBJECT_NORMALISATION_MAP: Record<string, string> = {
  english: 'English', mathematics: 'Mathematics', math: 'Mathematics', maths: 'Mathematics',
  physics: 'Physics', chemistry: 'Chemistry', biology: 'Biology', geography: 'Geography',
  government: 'Government', economics: 'Economics', literature: 'Literature',
  'literature in english': 'English', 'english language': 'English',
};
function normaliseSubject(raw: string): string {
  const key = raw.toLowerCase().trim();
  return SUBJECT_NORMALISATION_MAP[key] ?? raw.charAt(0).toUpperCase() + raw.slice(1);
}

async function getSyllabusContext(subject: string, topic: string): Promise<SyllabusData | null> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) return null;

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase
      .from("jamb_syllabus")
      .select("topic, subtopics, objectives, recommended_resources")
      .eq("subject", subject)
      .eq("topic", topic)
      .single();

    if (error) return null;
    return data as SyllabusData;
  } catch {
    return null;
  }
}

async function getRelevantPastQuestions(rawSubject: string, topic: string): Promise<string> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) return "";

    const subject = normaliseSubject(rawSubject);
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data } = await supabase
      .from("past_questions")
      .select("question_text, year")
      .eq("subject", subject)
      .eq("topic", topic)
      .limit(3)
      .order("year", { ascending: false });

    if (!data || data.length === 0) return "";

    return "\n\nRELEVANT PAST JAMB QUESTIONS (for reference — do NOT reveal answers):\n" +
      data.map((q, i) => `Q${i + 1} (${q.year}): ${q.question_text}`).join("\n");
  } catch {
    return "";
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders();

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { context, studentMessage }: TutorRequest = await req.json();

    // Validate auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized - Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Server-side rate limit check
    const rateLimitResponse = await checkRateLimit(user.id, 'ai-tutor', corsHeaders);
    if (rateLimitResponse) return rateLimitResponse;


    let systemPrompt = PEDAGOGICAL_SCAFFOLDING_PROMPT;

    const syllabusContext = await getSyllabusContext(context.subject, context.topic);
    if (syllabusContext) {
      systemPrompt += `\n\nJAMB SYLLABUS CONTEXT:`;
      if (syllabusContext.objectives?.length) {
        systemPrompt += `\nLearning Objectives:\n${syllabusContext.objectives.map(o => `- ${o}`).join('\n')}`;
      }
      if (Array.isArray(syllabusContext.subtopics)) {
        systemPrompt += `\nRelated Subtopics: ${syllabusContext.subtopics.map((s: { name: string }) => s.name).join(', ')}`;
      }
    }

    // RAG: inject relevant past questions
    const pastQuestionsContext = await getRelevantPastQuestions(context.subject, context.topic);
    if (pastQuestionsContext) systemPrompt += pastQuestionsContext;

    systemPrompt += `\n\nCURRENT CONTEXT:
- Subject: ${context.subject}
- Topic: ${context.topic}
${context.subtopic ? `- Subtopic: ${context.subtopic}` : ''}
${context.masteryScore !== undefined ? `- Student mastery: ${context.masteryScore}%` : ''}
${context.consecutiveErrors ? `- Consecutive errors: ${context.consecutiveErrors} (be more supportive)` : ''}`;

    if (context.currentQuestion) {
      systemPrompt += `\n\nCURRENT QUESTION:\n${context.currentQuestion}`;
    }
    if (context.studentAnswer && context.correctAnswer) {
      systemPrompt += `\n\nStudent answered: ${context.studentAnswer}\nCorrect answer: ${context.correctAnswer}\nThe student got this WRONG. Guide them without revealing the answer.`;
    }

    // Build conversation history for Gemini
    const messages: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
    if (context.previousInteractions?.length) {
      for (const interaction of context.previousInteractions.slice(-6)) {
        messages.push({
          role: interaction.role === 'student' ? 'user' : 'model',
          parts: [{ text: interaction.content }]
        });
      }
    }
    messages.push({ role: 'user', parts: [{ text: studentMessage }] });

    const response = await callGeminiWithHistory(messages, {
      model: 'gemini-2.0-flash',
      systemInstruction: systemPrompt,
      temperature: 0.7,
      maxOutputTokens: 1500,
    });

    return new Response(JSON.stringify({
      response,
      context: { subject: context.subject, topic: context.topic }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return handleEdgeFunctionError(error, getCorsHeaders());
  }
});
