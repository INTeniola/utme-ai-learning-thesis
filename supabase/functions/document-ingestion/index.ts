import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callGemini, getCorsHeaders, handleEdgeFunctionError } from "../_shared/gemini.ts";

const TEXT_CLEANER_SYSTEM_PROMPT = `You are a Text Cleaner Agent specialized in processing OCR output from educational materials (textbooks, handwritten notes). Your tasks:

1. CLEAN: Fix OCR errors, typos, and formatting issues
2. STRUCTURE: Format as proper Markdown with headers, lists, and paragraphs
3. PRESERVE MATH: Identify and format mathematical expressions using LaTeX syntax (wrap in $ for inline, $$ for block)
4. IDENTIFY: Determine the subject area and main topic
5. SUMMARIZE: Generate a concise "Knowledge Summary" (2-3 sentences)

Return a JSON object with this exact structure:
{
  "cleanedMarkdown": "The cleaned and formatted content in Markdown",
  "knowledgeSummary": "A 2-3 sentence summary of the key concepts",
  "extractedFormulas": ["Array of key formulas in LaTeX"],
  "detectedSubject": "The subject area (Physics, Chemistry, Mathematics, Biology, etc.)",
  "detectedTopic": "The main topic or chapter name"
}`;

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

    const formData = await req.formData();
    const imageFile = formData.get('image') as File;
    const subject = formData.get('subject') as string || 'General';

    if (!imageFile) {
      return new Response(
        JSON.stringify({ error: 'No image provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Convert file to base64
    const arrayBuffer = await imageFile.arrayBuffer();
    const base64Image = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    // Step 1: Google Cloud Vision OCR
    const VISION_API_KEY = Deno.env.get('GOOGLE_CLOUD_VISION_API_KEY');
    if (!VISION_API_KEY) {
      throw new Error('Google Cloud Vision API key not configured');
    }

    const visionResponse = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${VISION_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            image: { content: base64Image },
            features: [
              { type: 'TEXT_DETECTION' },
              { type: 'DOCUMENT_TEXT_DETECTION' }
            ]
          }]
        })
      }
    );

    if (!visionResponse.ok) {
      throw new Error(`Vision API error: ${visionResponse.status}`);
    }

    const visionData = await visionResponse.json();
    const rawText = visionData.responses?.[0]?.fullTextAnnotation?.text ||
      visionData.responses?.[0]?.textAnnotations?.[0]?.description || '';

    if (!rawText) {
      return new Response(
        JSON.stringify({
          error: 'No text detected in image',
          suggestion: 'Please ensure the image is clear and contains readable text'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Gemini text cleaner
    const cleanerContent = await callGemini(
      `Process this OCR text from ${subject} educational material:\n\n${rawText}`,
      {
        model: 'gemini-2.0-flash',
        systemInstruction: TEXT_CLEANER_SYSTEM_PROMPT,
        temperature: 0.3,
        maxOutputTokens: 3000,
      }
    );

    // Parse JSON from response
    let parsedResult: any;
    try {
      const jsonMatch = cleanerContent.match(/```(?:json)?\s*([\s\S]*?)```/) ||
        cleanerContent.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : cleanerContent;
      parsedResult = JSON.parse(jsonStr.trim());
    } catch {
      parsedResult = {
        cleanedMarkdown: cleanerContent,
        knowledgeSummary: 'Content processed from uploaded document.',
        extractedFormulas: [],
        detectedSubject: subject,
        detectedTopic: 'General Notes'
      };
    }

    return new Response(
      JSON.stringify({
        success: true,
        result: {
          rawText,
          cleanedMarkdown: parsedResult.cleanedMarkdown || '',
          knowledgeSummary: parsedResult.knowledgeSummary || '',
          extractedFormulas: parsedResult.extractedFormulas || [],
          subject: parsedResult.detectedSubject || subject,
          topic: parsedResult.detectedTopic || 'General Notes'
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return handleEdgeFunctionError(error, getCorsHeaders());
  }
});
