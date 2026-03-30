import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callGemini, checkRateLimit, getCorsHeaders, handleEdgeFunctionError } from "../_shared/gemini.ts";

const SEMANTIC_SUMMARY_PROMPT = `Generate a dense semantic representation of the following educational content.
Extract key concepts, formulas, and relationships. Output as a single dense paragraph of keywords and phrases
that capture the semantic meaning for text search. Focus on: subject-specific terms, mathematical concepts,
scientific principles, definitions, and relationships.`;

// Helper function to chunk content
function chunkContent(content: string, maxWords: number): string[] {
  const paragraphs = content.split(/\n\n+/);
  const chunks: string[] = [];
  let currentChunk = '';
  let currentWordCount = 0;

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(w => w.length > 0);
    if (currentWordCount + words.length > maxWords && currentChunk) {
      chunks.push(currentChunk.trim());
      currentChunk = '';
      currentWordCount = 0;
    }
    currentChunk += paragraph + '\n\n';
    currentWordCount += words.length;
  }

  if (currentChunk.trim()) chunks.push(currentChunk.trim());
  if (chunks.length === 0 && content.trim()) chunks.push(content.trim());

  return chunks;
}

serve(async (req) => {
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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
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
    const rateLimitResponse = await checkRateLimit(user.id, 'add-to-knowledge-base', corsHeaders);
    if (rateLimitResponse) return rateLimitResponse;

    const userId = user.id;
    const { content, subject, topic, summary, sourceType = 'user_upload' } = await req.json();

    if (!content || !subject || !topic) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: content, subject, topic' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const chunks = chunkContent(content, 500);
    const insertedRecords = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      // Generate a semantic summary for text-based search
      const semanticRepresentation = await callGemini(chunk, {
        model: 'gemini-2.0-flash',
        systemInstruction: SEMANTIC_SUMMARY_PROMPT,
        temperature: 0.1,
        maxOutputTokens: 200,
      }).catch(() => ''); // Non-fatal if semantic summary fails

      const { data, error } = await supabase
        .from('knowledge_graph')
        .insert({
          subject,
          topic,
          subtopic: summary ? summary.substring(0, 100) : null,
          content_chunk: chunk,
          embedding: semanticRepresentation,
          source_year: new Date().getFullYear(),
          metadata: {
            user_id: userId,
            source_type: sourceType,
            chunk_index: i,
            total_chunks: chunks.length,
            created_at: new Date().toISOString()
          }
        })
        .select('id')
        .single();

      if (error) {
        console.error('Insert error:', error);
        continue;
      }

      insertedRecords.push(data.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Added ${insertedRecords.length} knowledge chunks to your knowledge base`,
        recordIds: insertedRecords
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return handleEdgeFunctionError(error, getCorsHeaders());
  }
});
