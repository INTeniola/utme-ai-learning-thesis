// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getLibrarianContext } from "./agents/librarian.ts";
import { getOrchestratorAction } from "./agents/orchestrator.ts";
import { getTeacherResponse, TeacherContext } from "./agents/teacher.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Secret keys configured in Supabase CLI (Required)
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || '';

/**
 * Normalized query hash for caching
 */
async function hashQuery(text: string) {
  const normalized = text.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const msgUint8 = new TextEncoder().encode(normalized);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Authenticate Request
    const supabaseClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error("Auth Error:", authError);
      return new Response(JSON.stringify({ error: 'Unauthorized', details: authError?.message }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!GEMINI_API_KEY) {
      throw new Error("Missing GEMINI_API_KEY secret on the Edge. Please run: npx supabase secrets set GEMINI_API_KEY=...");
    }

    if (!SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY secret on the Edge.");
    }

    // 2. Parse payload from React useAITutor payload
    const body = await req.json();
    const { message, activeContext } = body;
    
    if (!message) {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const subject = activeContext.subject || 'General Studies';
    const topic = activeContext.topic || 'General';

    // 2.2 Check Semantic Cache (TurboQuant Strategy)
    const queryHash = await hashQuery(message);
    const { data: cached } = await supabaseService
      .from('savant_cache')
      .select('response_text')
      .eq('query_hash', queryHash)
      .eq('subject', subject)
      .eq('topic', topic)
      .gt('expires_at', new Date().toISOString())
      .limit(1)
      .maybeSingle();

    if (cached) {
      console.log(`[Cache] Hit for hash: ${queryHash}`);
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: 'text', content: cached.response_text })}\n\n`));
          controller.enqueue(new TextEncoder().encode(`data: [DONE]\n\n`));
          controller.close();
        }
      });
      return new Response(stream, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }
    // 3. Initiate Librarian Subagent (Fast RAG Search)
    const ragContext = await getLibrarianContext(
      SUPABASE_URL, 
      SUPABASE_SERVICE_ROLE_KEY, 
      GEMINI_API_KEY, 
      {
        userId: user.id,
        query: message,
        subject: activeContext.subject || 'General Studies'
      }
    );
    // 4. Construct Teacher Context
    const conversationHistory = (activeContext.newInteractions || [])
      .slice(-10)
      .map((i: any) => `${i.role}: ${i.content}`)
      .join('\n');

    const teacherContext: TeacherContext = {
      // Core identity
      firstName: activeContext.firstName || 'Student',
      examType: activeContext.examType || 'UTME',
      examFullName: activeContext.examFullName || 'JAMB UTME',
      studentStage: activeContext.studentStage || 'early_learner',
      studentStyle: activeContext.studentStyle || { tone: 'conversational', usesSlang: false, usesEmoji: true },
      conversationHistory,
      currentQuestion: activeContext.currentQuestion,
      studentAnswer: activeContext.studentAnswer,
      ragContext,
      userMessage: message,
      // Part 1 — new context fields passed through to the prompt
      subject: activeContext.subject || 'General Studies',
      topic: activeContext.topic || 'General',
      daysToExam: activeContext.daysToExam ?? null,
      weakTopics: activeContext.weakTopics || [],
      strongTopics: activeContext.strongTopics || [],
      recentQuizResults: activeContext.recentQuizResults || [],
      topicsNeverAttempted: activeContext.topicsNeverAttempted || [],
      currentSyllabusObjectives: activeContext.currentSyllabusObjectives || [],
      selectedSubjects: activeContext.selectedSubjects || [],
      teachingQuestions: activeContext.teachingQuestions || [],
      studentRank: activeContext.studentRank ?? null,
      leaderboardContext: activeContext.leaderboardContext || [],
      learningPatterns: activeContext.learningPatterns ?? null,
      lastSession: activeContext.lastSession ?? null,
      lastToolResult: activeContext.lastToolResult ?? null,
      knowledgeChunks: activeContext.knowledgeChunks || [],
      userUploads: activeContext.userUploads || [],
      currentStreak: activeContext.currentStreak || 0
    };

    // 5. Stream Teacher Subagent Output directly to client
    let teacherStream;
    try {
      teacherStream = await getTeacherResponse(GEMINI_API_KEY, teacherContext);
    } catch (apiError: any) {
      console.error("Teacher subagent failed:", apiError);
      
      const stream = new ReadableStream({
        start(controller) {
          const fallbackText = "I'm currently experiencing unusually high demand and need a quick breather. Please try your message again in a few moments!";
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: 'text', content: fallbackText })}\n\n`));
          controller.enqueue(new TextEncoder().encode(`data: [DONE]\n\n`));
          controller.close();
        }
      });
      return new Response(stream, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    // We collect the full text as it streams, so the Orchestrator can read it after
    let collectedTeacherText = "";

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of teacherStream.stream) {
            const chunkText = chunk.text();
            collectedTeacherText += chunkText;
            
            // Send chunk to React immediately
            if (chunkText) {
              const dataStr = `data: ${JSON.stringify({ type: 'text', content: chunkText })}\n\n`;
              controller.enqueue(new TextEncoder().encode(dataStr));
            }
          }

          // 6. After Teacher finishes, trigger Orchestrator Subagent
          const jsonActionStr = await getOrchestratorAction(GEMINI_API_KEY, {
            topic: activeContext.topic || 'General',
            weakTopics: activeContext.weakTopics || [],
            recentQuizResults: activeContext.recentQuizResults || [],
            teacherText: collectedTeacherText,
            interactionsCount: (activeContext.newInteractions?.length || 0) + 1
          });

          // 7. If Orchestrator decided to launch a tool, append it to the stream
          if (jsonActionStr) {
            const actionPayload = `data: ${JSON.stringify({ type: 'action', content: jsonActionStr })}\n\n`;
            controller.enqueue(new TextEncoder().encode(actionPayload));
          }

          // Terminate standard Server-Sent Events stream
          controller.enqueue(new TextEncoder().encode(`data: [DONE]\n\n`));
          controller.close();

          // 8. Background: Persist to Cache if meaningful
          if (collectedTeacherText.length > 50) {
            supabaseService.from('mentat_cache').insert({
              subject,
              topic,
              query_hash: queryHash,
              query_text: message.slice(0, 500),
              response_text: collectedTeacherText
            }).then(({ error }) => {
              if (error && error.code !== '23505') console.warn("[Cache] Insert error:", error);
            });
          }
        } catch (e) {
          console.error("Streaming error in Swarm Router:", e);
          controller.error(e);
        }
      }
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });

  } catch (error: any) {
    console.error("Swarm Gateway Error:", error);
    return new Response(JSON.stringify({ error: error.message || 'Unknown error occurred' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
