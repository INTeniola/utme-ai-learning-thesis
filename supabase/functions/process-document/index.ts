import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  callGemini, 
  generateTextEmbeddingsBatch, 
  generateMultimodalEmbedding, 
  getCorsHeaders, 
  handleEdgeFunctionError 
} from "../_shared/gemini.ts";

const DOCUMENT_ANALYSIS_PROMPT = `You are an expert academic tutor. Analyze the OCR text and:
1. CLEAN: Fix OCR errors, typos, and formatting.
2. STRUCTURE: Format as proper Markdown with headers.
3. IDENTIFY: Determine JAMB subject and topic.
4. SUMMARIZE: Concise 2-3 sentence summary.
5. EXTRACT CONCEPTS: Identify 3-5 key concepts.

Return a JSON object:
{
  "cleanedMarkdown": "Markdown content",
  "knowledgeSummary": "Summary text",
  "detectedSubject": "Subject",
  "detectedTopic": "Topic",
  "concepts": [{"name": "Name", "description": "Desc"}]
}`;

/**
 * Project Synthesis: Semantic Chunking
 * Splits markdown into meaningful chunks for vector indexing.
 */
function chunkMarkdown(text: string, maxChars = 1000): string[] {
  // Simple paragraph-based chunking for now
  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let currentChunk = "";

  for (const p of paragraphs) {
    if ((currentChunk + p).length > maxChars && currentChunk) {
      chunks.push(currentChunk.trim());
      currentChunk = "";
    }
    currentChunk += p + "\n\n";
  }
  if (currentChunk.trim()) chunks.push(currentChunk.trim());
  return chunks;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders();
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { contentId, triggerSync } = await req.json();
    if (!contentId) throw new Error("Missing contentId");

    // 1. Fetch the pending record
    const { data: record, error: fetchError } = await supabase
      .from('uploaded_content')
      .select('*')
      .eq('id', contentId)
      .single();

    if (fetchError || !record) throw new Error("Record not found");

    // 2. Already processed?
    if (record.processing_status === 'completed' && !triggerSync) {
      return new Response(JSON.stringify({ status: 'already_completed' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 3. Update status: analyzing
    await supabase.from('uploaded_content').update({ processing_status: 'analyzing' }).eq('id', contentId);

    // 4. Perform Analysis (Gemini)
    // For PDFs/Images, we use the raw_text from step 1 (Vision OCR happened in the first pass or we do it here)
    let rawText = record.raw_text;
    
    // If raw_text is missing, we might need to perform OCR (for simplicity we assume it was captured during upload)
    const analysis = await callGemini(
      `Analyze this material:\n\n${rawText.substring(0, 10000)}`,
      {
        model: 'gemini-2.0-flash',
        systemInstruction: DOCUMENT_ANALYSIS_PROMPT,
        temperature: 0.2
      }
    );

    let parsed: any;
    try {
      const jsonMatch = analysis.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : analysis);
    } catch {
      parsed = { cleanedMarkdown: analysis };
    }

    // 5. Project Synthesis: Chunking & Vectorization
    await supabase.from('uploaded_content').update({ 
      processing_status: 'vectorizing',
      cleaned_markdown: parsed.cleanedMarkdown,
      knowledge_summary: parsed.knowledgeSummary,
      detected_subject: parsed.detectedSubject || record.detected_subject,
      detected_topic: parsed.detectedTopic || 'General'
    }).eq('id', contentId);

    const chunks = chunkMarkdown(parsed.cleanedMarkdown);
    const embeddings = await generateTextEmbeddingsBatch(chunks, 'RETRIEVAL_DOCUMENT');

    // 6. Bulk Insert Chunks
    const chunkInserts = chunks.map((c, i) => ({
      user_id: record.user_id,
      upload_id: contentId,
      content: c,
      embedding: embeddings[i],
      metadata: { index: i, subject: parsed.detectedSubject }
    }));

    await supabase.from('user_doc_chunks').insert(chunkInserts);

    // 7. Final Completion
    await supabase.from('uploaded_content').update({ 
      processing_status: 'completed',
      concepts: parsed.concepts || []
    }).eq('id', contentId);

    return new Response(JSON.stringify({ success: true }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    return handleEdgeFunctionError(error, getCorsHeaders());
  }
});
