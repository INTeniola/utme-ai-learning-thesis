/**
 * Visual Generator for Mentat Tutor
 * Interfaces with Google Cloud Imagen 4 to create educational illustrations.
 */
import { toast } from "sonner";

// Tier 1 identifies 'Imagen 4 Generate' - currently mapped to stable model ID
const IMAGEN_MODEL = "imagen-3.0-generate-001"; // Fallback to stable if 4.0 is restricted to Vertex-only

export async function generateVisualAid(prompt: string, subject?: string): Promise<string | null> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
      console.warn("[VisualGenerator] No Gemini API key found.");
      return null;
  }

  // Educational prompt engineering
  const educationalPrompt = `Educational illustration for ${subject || 'Academic Study'}. 
  SUBJECT: ${prompt}. 
  STYLE: Vector illustration, clean, textbook-style, professional. 
  FOCUS: Scientific accuracy and semantic clarity. No text unless requested.`;

  try {
    console.log(`[VisualGenerator] Generating illustration for: ${prompt}...`);
    
    // We use the Generative Language v1beta endpoint for Imagen Tooling
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${IMAGEN_MODEL}:predict?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [{ prompt: educationalPrompt }],
        parameters: { 
            sampleCount: 1,
            aspectRatio: "1:1",
            safetySettings: [
                { category: "HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" }
            ]
        }
      })
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const base64 = data?.predictions?.[0]?.bytesBase64Encoded;

    if (!base64) {
        throw new Error("No image was generated.");
    }

    return `data:image/png;base64,${base64}`;
  } catch (error: any) {
    console.error("[VisualGenerator] Imagen generation failed:", error);
    // Don't toast for deep background failures unless necessary
    return null;
  }
}
