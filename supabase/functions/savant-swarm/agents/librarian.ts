// @ts-ignore - Deno resolution
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
// @ts-ignore - Deno resolution
import { GoogleGenerativeAI } from "npm:@google/generative-ai";
import { generateMultimodalEmbedding } from "../../_shared/gemini.ts";

export interface LibrarianParams {
  userId: string;
  query: string;
  subject: string;
}

/**
 * The Librarian Subagent is responsible for executing advanced RAG:
 * 1. HyDE (Hypothetical Document Embedding)
 * 2. Vector Retrieval (Depth 10)
 * 3. LLM-Based Reranking
 */
export async function getLibrarianContext(
  supabaseUrl: string,
  supabaseKey: string,
  geminiKey: string,
  params: LibrarianParams
): Promise<string> {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const genAI = new GoogleGenerativeAI(geminiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
  const GEMINI_EMBEDDING_MODEL = 'text-embedding-004';
  const VECTOR_DIM = 768;
  const embedModel = genAI.getGenerativeModel({ model: GEMINI_EMBEDDING_MODEL });

  // 1. HyDE Step: Generate a hypothetical answer to improve embedding relevance
  const generateHyDE = async (query: string) => {
    try {
      const prompt = `You are a world-class academic librarian. 
Generate a brief, factual, and high-quality hypothetical answer to the following student's question. 
This will be used for vector search retrieval. 
Question: ${query}`;
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (e) {
      console.warn("[Librarian] HyDE generation failed, falling back to raw query.", e);
      return query;
    }
  };

  try {
    const hypotheticalAnswer = await generateHyDE(params.query);
    console.log(`[Librarian] HyDE Answer generated: ${hypotheticalAnswer.substring(0, 50)}...`);

    // 2. Generate text embeddings using the hypothetical answer
    const result = await embedModel.embedContent({
      content: { parts: [{ text: hypotheticalAnswer }], role: 'user' },
      taskType: 'RETRIEVAL_QUERY' as any,
      outputDimensionality: VECTOR_DIM,
    } as any);
    const queryVector = result.embedding?.values;

    // 2.5 Visual Investigator Step: Generate 1408-dim multimodal vector for visual search
    const visualQueryVector = await generateMultimodalEmbedding(
      "", // No image for the query itself
      "image/png",
      params.query
    );

    if (!queryVector || queryVector.length !== VECTOR_DIM) {
      console.warn("Librarian vector generation failed.");
      return "No specific reference material loaded.";
    }

    // 2.2 Semantic Cache Check
    const { data: cacheMatch } = await supabase.rpc('match_semantic_cache', {
      query_embedding: queryVector,
      match_threshold: 0.95,
      match_count: 1,
      filter_subject: params.subject
    });

    if (cacheMatch && cacheMatch.length > 0) {
      console.log(`[Librarian] Semantic Cache HIT (Similarity: ${cacheMatch[0].similarity.toFixed(4)})`);
      // Update access time / usage count in background
      supabase.from('semantic_cache').update({ 
        last_accessed_at: new Date().toISOString(),
        usage_count: (cacheMatch[0].usage_count || 1) + 1 
      }).eq('id', cacheMatch[0].id).then(() => {});
      
      return cacheMatch[0].response_context;
    }

    // 3. Retrieve broader set of results (10) for reranking
    const [globalGraphRes, userUploadsRes, userChunksRes, visualPagesRes] = await Promise.all([
      supabase.rpc('match_knowledge_graph', {
        query_embedding: queryVector,
        match_threshold: 0.15, 
        match_count: 10,
        filter_subject: params.subject,
      }),
      supabase
        .from('uploaded_content')
        .select('raw_text, file_name, created_at')
        .eq('user_id', params.userId)
        .order('created_at', { ascending: false })
        .limit(2),
      supabase.rpc('match_user_doc_chunks', {
        query_embedding: queryVector,
        match_threshold: 0.15,
        match_count: 8,
        p_user_id: params.userId
      }),
      supabase.rpc('match_doc_pages', {
        query_embedding: visualQueryVector,
        match_threshold: 0.15,
        match_count: 5,
        p_user_id: params.userId
      })
    ]);

    let rawResults: string[] = [];
    if (globalGraphRes.data) {
      rawResults.push(...globalGraphRes.data.map((r: any, i: number) => 
        `[Textbook Excerpt ${i+1}]\n${r.content}`
      ));
    }

    // Add specific student note fragments (Project Synthesis)
    if (userChunksRes.data) {
      rawResults.push(...userChunksRes.data.map((r: any, i: number) => 
        `[Student's Note Fragment ${i+1}]\n${r.content}`
      ));
    }
    
    // Add visual matches with "Visual Evidence" tags
    if (visualPagesRes.data) {
      rawResults.push(...visualPagesRes.data.map((r: any) => 
        `[VISUAL EVIDENCE: Document Page ${r.page_number} (Diagram/Table)]\nPage Text: ${r.ocr_text?.substring(0, 500)}...\nURL: ${r.storage_path}`
      ));
    }

    if (userUploadsRes.data) {
      rawResults.push(...userUploadsRes.data.map((r: any) => 
        `[Student's Uploaded Doc: ${r.file_name}]\n${r.raw_text.substring(0, 1500)}`
      ));
    }

    if (rawResults.length === 0) return "No specific reference material loaded.";

    // 4. Reranking (LLM Selection / Content Compression)
    const rerankPrompt = `You are an expert academic document reranker. 
You have been given a student's question and several possible snippets of context.
Your task is to select and return ONLY the 3 most relevant paragraphs that directly answer the student's question.
DO NOT summarize or change the text. Return the verbatim text of the 3 best snippets, separated by '---'.

Student Question: "${params.query}"

Context snippets:
${rawResults.join('\n\n---NEXT SNIPPET---\n\n')}
`;
    
    console.log(`[Librarian] Reranking ${rawResults.length} snippets...`);
    const rerankResult = await model.generateContent(rerankPrompt);
    const refinedContext = rerankResult.response.text();

    const finalResult = refinedContext.trim() || rawResults.slice(0, 3).join('\n\n');

    // 5. Populate Semantic Cache (Fire and Forget)
    if (finalResult && finalResult !== "No specific reference material loaded.") {
      supabase.from('semantic_cache').insert({
        query_text: params.query,
        query_embedding: queryVector,
        response_context: finalResult,
        subject: params.subject,
        metadata: { source: 'librarian_rag' }
      }).then(() => {
        console.log("[Librarian] Populated semantic cache for query");
      }).catch((err: any) => {
        console.warn("[Librarian] Failed to populate cache:", err);
      });
    }

    return finalResult;
  } catch (error) {
    console.error("Librarian Subagent Exception:", error);
    return "Error retrieving reference material.";
  }
}
