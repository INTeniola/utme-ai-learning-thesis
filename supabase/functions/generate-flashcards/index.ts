import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callGemini, getCorsHeaders, handleEdgeFunctionError } from "../_shared/gemini.ts";


const FLASHCARD_SYSTEM_PROMPT = `You are an expert JAMB tutor creating flashcards for Nigerian students.
Create clear, concise flashcards that help with memorization and understanding.
For formulas, include when to use them.
For definitions, include examples.
Always use simple, clear language.
Return only valid JSON, no markdown formatting.`;

interface FlashcardRequest {
  subject: string;
  topic: string;
  mode: 'from_topic' | 'from_question' | 'from_concept';
  count?: number;
  questionText?: string;
  conceptText?: string;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders();

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { subject, topic, mode, count = 5, questionText, conceptText }: FlashcardRequest = await req.json();

    let prompt: string;

    switch (mode) {
      case 'from_topic':
        prompt = `Generate ${count} JAMB-style flashcards for:
Subject: ${subject}
Topic: ${topic}

Create flashcards that help students memorize key concepts, formulas, definitions, and important facts.
Each flashcard should have:
- Front: A clear question, term, or concept to recall
- Back: A concise but complete answer with examples where helpful

Focus on what's commonly tested in JAMB exams for this topic.

Return as JSON array:
[
  {
    "front": "Question or term",
    "back": "Answer with explanation"
  }
]

Only return the JSON array, no other text.`;
        break;

      case 'from_question':
        prompt = `Create a flashcard from this JAMB question:
Subject: ${subject}
Topic: ${topic}
Question: ${questionText}

Create a flashcard that helps students remember this concept:
- Front: Rephrase as a clear recall prompt
- Back: Complete answer with key points to remember

Return as JSON:
{
  "front": "The flashcard front",
  "back": "The flashcard back"
}

Only return the JSON, no other text.`;
        break;

      case 'from_concept':
        prompt = `Create a flashcard from this concept explanation:
Subject: ${subject}
Topic: ${topic}
Concept: ${conceptText}

Transform into a memorable flashcard:
- Front: A question that tests understanding of this concept
- Back: Key points from the explanation, formatted for easy recall

Return as JSON:
{
  "front": "The flashcard front",
  "back": "The flashcard back"
}

Only return the JSON, no other text.`;
        break;

      default:
        throw new Error("Invalid mode");
    }

    const content = await callGemini(prompt, {
      model: 'gemini-2.0-flash',
      systemInstruction: FLASHCARD_SYSTEM_PROMPT,
      temperature: 0.7,
      maxOutputTokens: 2000,
    });

    // Parse the JSON response
    let flashcards;
    try {
      let cleanContent = content.trim();
      if (cleanContent.startsWith("```json")) cleanContent = cleanContent.slice(7);
      else if (cleanContent.startsWith("```")) cleanContent = cleanContent.slice(3);
      if (cleanContent.endsWith("```")) cleanContent = cleanContent.slice(0, -3);
      cleanContent = cleanContent.trim();

      const parsed = JSON.parse(cleanContent);
      if (Array.isArray(parsed)) {
        flashcards = parsed;
      } else if (parsed.front && parsed.back) {
        flashcards = [parsed];
      } else {
        throw new Error("Invalid flashcard format");
      }
    } catch {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse flashcard response");
    }

    return new Response(
      JSON.stringify({ flashcards }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    return handleEdgeFunctionError(error, getCorsHeaders());
  }
});
