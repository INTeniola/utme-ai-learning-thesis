// @ts-nocheck
/**
 * Shared Gemini API helper for Supabase Edge Functions
 * Replaces the Lovable AI gateway with direct Gemini REST API calls.
 *
 * Usage in edge functions:
 *   import { callGemini, getCorsHeaders } from '../_shared/gemini.ts';
 */

export interface GeminiMessage {
    role: 'user' | 'model';
    parts: Array<{ text: string }>;
}

export interface GeminiOptions {
    model?: string;
    temperature?: number;
    maxOutputTokens?: number;
    systemInstruction?: string;
}

/**
 * Returns CORS headers locked to the allowed production origin.
 * Falls back to '*' only if ALLOWED_ORIGIN env var is not set (local dev).
 */
export function getCorsHeaders(): Record<string, string> {
    const allowedOrigin = Deno.env.get('ALLOWED_ORIGIN') || '*';
    return {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };
}

/**
 * Credit cost per AI feature type.
 * These are the canonical credit weights for the entire platform.
 * Free (0-cost) actions are excluded from this table — they bypass rate-limiting entirely.
 *
 * Daily budget default: 50 credits.
 *   - A student who only chats can send ~50 messages/day.
 *   - A student who generates quizzes will use their budget in ~10 quizzes.
 *   - Concept Maps are expensive (heavy generation) and cost 5 each.
 */
export const CREDIT_COSTS: Record<string, number> = {
  'ai-tutor':              1,  // Standard chat message
  'generate-quiz':         3,  // Quiz generation (DB-heavy + AI scoring)
  'verify-quiz-answers':   1,  // Per-quiz answer grading
  'generate-flashcards':   2,  // AI flashcard generation from syllabus
  'process-document':      4,  // Document ingestion (embedding + chunking)
  'add-to-knowledge-base': 2,  // Adding content to long-term memory
  'concept-visualizer':    5,  // Full Manim/Mermaid concept map generation
  'mentat-swarm':          2,  // Multi-agent orchestration
};

/**
 * Server-side rate limiter using Supabase ai_usage_logs.
 * Checks how many AI credits the user has spent today vs their daily_ai_quota.
 * Logs the call (with its credit cost) if allowed.
 *
 * @param userId     The authenticated user's ID.
 * @param featureType The feature key — must match a key in CREDIT_COSTS.
 * @param corsHeaders CORS headers to attach to the 429 response if blocked.
 * @returns null if allowed, or a 429 Response if quota exceeded.
 */
export async function checkRateLimit(
    userId: string,
    featureType: string,
    corsHeaders: Record<string, string>
): Promise<Response | null> {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseKey) return null; // Skip if not configured

    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(supabaseUrl, supabaseKey);

    const creditCost = CREDIT_COSTS[featureType] ?? 1;

    // Get user's daily quota from profile
    const { data: profile } = await supabase
        .from('profiles')
        .select('daily_ai_quota')
        .eq('id', userId)
        .single();

    const dailyLimit = profile?.daily_ai_quota ?? 50;

    // Sum credits spent today (weighted, not flat count)
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const { data: usageRows } = await supabase
        .from('ai_usage_logs')
        .select('credits_cost')
        .eq('user_id', userId)
        .gte('created_at', todayStart.toISOString());

    const used = (usageRows ?? []).reduce(
        (sum: number, row: { credits_cost?: number }) => sum + (row.credits_cost ?? 1),
        0
    );

    if (used + creditCost > dailyLimit) {
        console.warn(`Credit limit hit: user ${userId} has ${used}/${dailyLimit} credits used, action costs ${creditCost}`);
        return new Response(
            JSON.stringify({
                error: 'QUOTA_EXCEEDED',
                message: `Daily AI credit limit reached (${used}/${dailyLimit} credits used). Resets at midnight UTC.`,
                used,
                limit: dailyLimit,
                creditCost,
            }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // Log this call with its credit cost (fire-and-forget)
    supabase.from('ai_usage_logs').insert({
        user_id: userId,
        feature_type: featureType,
        credits_cost: creditCost,
        tokens_estimated: 0,
    }).then(() => { });

    return null; // Allowed
}


/**
 * Call the Gemini REST API directly.
 * @param userMessage - The user's message
 * @param options - Model config and system instruction
 * @returns The text response from Gemini
 */
export async function callGemini(
    userMessage: string,
    options: GeminiOptions = {}
): Promise<string> {
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not configured in edge function secrets.');
    }

    const model = options.model ?? 'gemini-2.0-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

    const requestBody: Record<string, unknown> = {
        contents: [
            {
                role: 'user',
                parts: [{ text: userMessage }],
            },
        ],
        generationConfig: {
            temperature: options.temperature ?? 0.7,
            maxOutputTokens: options.maxOutputTokens ?? 2000,
        },
    };

    if (options.systemInstruction) {
        requestBody.systemInstruction = {
            parts: [{ text: options.systemInstruction }],
        };
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`Gemini API error ${response.status}:`, errorText);

        if (response.status === 429) {
            throw new Error('RATE_LIMIT: Gemini API rate limit exceeded. Please wait and retry.');
        }
        if (response.status === 403) {
            throw new Error('AUTH_ERROR: Invalid Gemini API key or quota exhausted.');
        }
        throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
        console.error('Unexpected Gemini response shape:', JSON.stringify(data));
        throw new Error('Empty response from Gemini API.');
    }

    return text;
}

/**
 * Generate a multimodal embedding for an image (or image + text).
 * Used for the "Visual Researcher" pilot.
 * @param imageBase64 - Base64 encoded image data
 * @param mimeType - image/jpeg or image/png
 * @param textContext - Optional text to combine with the image
 * @returns 1408-dimension vector
 */
export async function generateMultimodalEmbedding(
    imageBase64: string,
    mimeType: string,
    textContext?: string
): Promise<number[]> {
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured.');

    const url = `https://generativelanguage.googleapis.com/v1beta/models/multimodal-embeddings-001:embedContent?key=${GEMINI_API_KEY}`;
    
    const requestBody = {
        requests: [{
            content: {
                parts: [
                    {
                        inline_data: {
                            mime_type: mimeType,
                            data: imageBase64
                        }
                    }
                ]
            }
        }]
    };

    if (textContext) {
        requestBody.requests[0].content.parts.push({ text: textContext });
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
        const err = await response.text();
        console.error('Multimodal Embedding Error:', err);
        throw new Error(`Multimodal embedding failed: ${response.status}`);
    }

    const data = await response.json();
    return data?.embeddings?.[0]?.values ?? [];
}

/**
 * Generate a text embedding using text-embedding-004 (v2).
 * Optimized for the new 768-dimension architecture.
 */
export async function generateTextEmbedding(
    text: string,
    taskType: 'RETRIEVAL_QUERY' | 'RETRIEVAL_DOCUMENT' = 'RETRIEVAL_QUERY'
): Promise<number[]> {
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured.');

    const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_API_KEY}`;
    
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: "models/text-embedding-004",
            content: { parts: [{ text }] },
            taskType,
            outputDimensionality: 768
        }),
    });

    if (!response.ok) {
        const err = await response.text();
        console.error('Text Embedding Error:', err);
        throw new Error(`Text embedding failed: ${response.status}`);
    }

    const data = await response.json();
    return data?.embedding?.values ?? [];
}

/**
 * Generate multiple text embeddings in a single batch call.
 * Essential for "Project Synthesis" document chunking.
 */
export async function generateTextEmbeddingsBatch(
    texts: string[],
    taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY' = 'RETRIEVAL_DOCUMENT'
): Promise<number[][]> {
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured.');

    const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:batchEmbedContents?key=${GEMINI_API_KEY}`;
    
    const requests = texts.map(text => ({
        model: "models/text-embedding-004",
        content: { parts: [{ text }] },
        taskType,
        outputDimensionality: 768
    }));

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests }),
    });

    if (!response.ok) {
        const err = await response.text();
        console.error('Batch Text Embedding Error:', err);
        throw new Error(`Batch embedding failed: ${response.status}`);
    }

    const data = await response.json();
    return data?.embeddings?.map((e: any) => e.values) ?? [];
}

/**
 * Call Gemini with multi-turn conversation history.
 */
export async function callGeminiWithHistory(
    messages: GeminiMessage[],
    options: GeminiOptions = {}
): Promise<string> {
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not configured in edge function secrets.');
    }

    const model = options.model ?? 'gemini-2.0-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

    const requestBody: Record<string, unknown> = {
        contents: messages,
        generationConfig: {
            temperature: options.temperature ?? 0.7,
            maxOutputTokens: options.maxOutputTokens ?? 2000,
        },
    };

    if (options.systemInstruction) {
        requestBody.systemInstruction = {
            parts: [{ text: options.systemInstruction }],
        };
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`Gemini API error ${response.status}:`, errorText);

        if (response.status === 429) throw new Error('RATE_LIMIT: Rate limit exceeded.');
        if (response.status === 403) throw new Error('AUTH_ERROR: Invalid API key.');
        throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) throw new Error('Empty response from Gemini API.');

    return text;
}

/**
 * Handle common edge function error patterns and return appropriate HTTP responses.
 */
export function handleEdgeFunctionError(
    error: unknown,
    corsHeaders: Record<string, string>
): Response {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (message.startsWith('RATE_LIMIT:')) {
        return new Response(
            JSON.stringify({ error: 'Rate limit exceeded. Please wait a moment and try again.' }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
    if (message.startsWith('QUOTA_EXCEEDED:')) {
        return new Response(
            JSON.stringify({ error: message.replace('QUOTA_EXCEEDED:', '').trim() }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
    if (message.startsWith('AUTH_ERROR:')) {
        return new Response(
            JSON.stringify({ error: 'AI service authentication error. Please contact support.' }),
            { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    console.error('Edge function error:', message);
    return new Response(
        JSON.stringify({ error: message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
}
