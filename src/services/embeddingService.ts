/**
 * embeddingService.ts
 * Gemini Embedding 2 — vector generation and knowledge_graph similarity search.
 */

import { supabase } from '@/integrations/supabase/client';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GEMINI_EMBEDDING_MODEL = 'gemini-embedding-001'; 
const VECTOR_DIM = 768;
const FALLBACK_MATCH_THRESHOLD = 0.2; // cosine similarity threshold

export interface KnowledgeChunk {
  id: string;
  subject: string;
  topic: string;
  subtopic?: string;
  content_chunk: string;
  metadata: Record<string, any>;
}

// ---------------------------------------------------------------------------
// Step 1 — generateEmbedding
// ---------------------------------------------------------------------------

/**
 * Generate a 768-dimensional embedding vector for the given text using
 * Gemini Embedding 2 (`gemini-embedding-exp-03-07`).
 *
 * Returns null on any failure — never throws.
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  try {
    const apiKey =
      import.meta.env.VITE_GEMINI_API_KEY ||
      import.meta.env.VITE_GEMINI_API_KEY_2;

    if (!apiKey) {
      console.warn('[embeddingService] No Gemini API key found.');
      return null;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: GEMINI_EMBEDDING_MODEL });

    const result = await model.embedContent({
      content: { parts: [{ text }], role: 'user' },
      taskType: 'RETRIEVAL_QUERY' as any,
      outputDimensionality: VECTOR_DIM,
    } as any);

    const values = result.embedding?.values;
    if (!values || values.length !== VECTOR_DIM) {
      console.warn(
        `[embeddingService] Unexpected embedding dimension: ${values?.length} (expected ${VECTOR_DIM})`
      );
      return null;
    }

    return values;
  } catch (err) {
    console.error('[embeddingService] generateEmbedding failed:', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Step 2 — searchKnowledgeGraph
// ---------------------------------------------------------------------------

/**
 * Search knowledge_graph for the most relevant chunks using cosine similarity
 * against the 768-dim `embedding_768` column.
 *
 * Falls back to a direct subject + topic text filter if:
 *   a) embedding generation fails, OR
 *   b) no rows have embeddings yet (RPC returns 0 results)
 */
export async function searchKnowledgeGraph(
  query: string,
  subject: string,
  limit: number = 4
): Promise<KnowledgeChunk[]> {
  // ------------------------------------------------------------------
  // Primary path: vector similarity via match_knowledge_graph RPC
  // ------------------------------------------------------------------
  try {
    const embedding = await generateEmbedding(query);

    if (embedding) {
      const { data, error } = await (supabase.rpc as any)('match_knowledge_graph', {
        query_embedding: embedding,
        match_threshold: FALLBACK_MATCH_THRESHOLD,
        match_count: limit,
        filter_subject: subject,
      }) as { data: any[] | null; error: any };

      if (!error && data && (data as any[]).length > 0) {
        return (data as any[]).map((row: any) => ({
          id: row.id,
          subject: row.subject,
          topic: row.topic,
          subtopic: row.subtopic ?? undefined,
          content_chunk: row.content,
          metadata: row.metadata ?? {},
        }));
      }

      // RPC succeeded but returned 0 results — embeddings may not be backfilled yet
      if (!error && (data as any)?.length === 0) {
        console.info(
          '[embeddingService] Vector search returned 0 results; falling back to text filter.'
        );
      }

      if (error) {
        console.warn('[embeddingService] match_knowledge_graph RPC error:', error.message);
      }
    }
  } catch (err) {
    console.warn('[embeddingService] Vector search path failed:', err);
  }

  // ------------------------------------------------------------------
  // Fallback path: direct subject/query text filter (no embeddings needed)
  // ------------------------------------------------------------------
  try {
    const { data, error } = await supabase
      .from('knowledge_graph')
      .select('id, subject, topic, subtopic, content_chunk, metadata')
      .eq('subject', subject)
      .or(`content_chunk.ilike.%${query}%,topic.ilike.%${query}%`)
      .limit(limit);

    if (error) throw error;

    return (data ?? []).map((row: any) => ({
      id: row.id,
      subject: row.subject,
      topic: row.topic,
      subtopic: row.subtopic ?? undefined,
      content_chunk: row.content_chunk,
      metadata: row.metadata ?? {},
    }));
  } catch (err) {
    console.error('[embeddingService] Fallback text search failed:', err);
    return [];
  }
}

/**
 * Backfill helper — generate + store embeddings for rows that lack them in a specific table/column.
 */
export async function backfillTableEmbeddings(
  tableName: 'knowledge_graph' | 'knowledge_base' | 'past_questions',
  contentColumn: string,
  embeddingColumn: string,
  onProgress?: (done: number, total: number) => void
): Promise<void> {
  const { data: rows, error } = await (supabase.from(tableName as any) as any)
    .select(`id, ${contentColumn}`)
    .is(embeddingColumn, null);

  if (error) {
    console.error(`[embeddingService] Backfill ${tableName}: failed to fetch rows:`, error);
    return;
  }

  const total = rows?.length ?? 0;
  if (total === 0) {
    console.info(`[embeddingService] Backfill ${tableName}: all rows already have embeddings.`);
    return;
  }

  console.info(`[embeddingService] Backfill ${tableName}: processing ${total} rows…`);

  const BATCH = 10;
  let done = 0;

  for (let i = 0; i < total; i += BATCH) {
    const batch = rows!.slice(i, i + BATCH);

    await Promise.all(
      batch.map(async (row) => {
        const text = (row as any)[contentColumn];
        if (!text) return;

        const embedding = await generateEmbedding(text);
        if (!embedding) return;

        const { error: updateErr } = await (supabase.from(tableName as any) as any)
          .update({ [embeddingColumn]: embedding } as any)
          .eq('id', (row as any).id);

        if (updateErr) {
          console.warn(`[embeddingService] Backfill ${tableName}: failed to update row ${(row as any).id}:`, updateErr.message);
        }
      })
    );

    done = Math.min(i + BATCH, total);
    onProgress?.(done, total);
    console.info(`[embeddingService] Backfill ${tableName}: ${done}/${total}`);

    await new Promise((r) => setTimeout(r, 200));
  }

  console.info(`[embeddingService] Backfill ${tableName} complete.`);
}

/** Legacy wrapper for Knowledge Graph */
export async function backfillKnowledgeGraphEmbeddings(
  onProgress?: (done: number, total: number) => void
): Promise<void> {
  return backfillTableEmbeddings('knowledge_graph', 'content_chunk', 'embedding_768', onProgress);
}
