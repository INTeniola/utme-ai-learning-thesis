import { GoogleGenerativeAI } from "@google/generative-ai";
import { logger } from "./logger";
import { RATE_LIMITS, rateLimiter } from "./rateLimiter";

const primaryKey = import.meta.env.VITE_GEMINI_API_KEY;
const secondaryKey = import.meta.env.VITE_GEMINI_API_KEY_2;

const keys = [primaryKey, secondaryKey].filter(Boolean);

if (keys.length === 0) {
  logger.warn("No Gemini API keys found in environment variables");
}

/**
 * Create a Gemini client for a specific API key
 */
const PRIMARY_GEMINI_MODEL = "gemini-3.1-flash-lite-preview";

export const createGeminiClient = (key: string) => {
  const genAI = new GoogleGenerativeAI(key || "");

  return {
    model: genAI.getGenerativeModel({ model: PRIMARY_GEMINI_MODEL }),
    visionModel: genAI.getGenerativeModel({ model: PRIMARY_GEMINI_MODEL }),

    generateContent: async (prompt: string, generationConfig?: Record<string, any>, tools?: any[]) => {
      if (!rateLimiter.isAllowed('gemini-api', RATE_LIMITS.GEMINI_API)) {
        const waitTime = rateLimiter.getTimeUntilNextRequest('gemini-api', RATE_LIMITS.GEMINI_API);
        const waitSeconds = Math.ceil(waitTime / 1000);
        throw new Error(`RATE_LIMIT_EXCEEDED:${waitSeconds}`);
      }

      try {
        const model = genAI.getGenerativeModel({ 
          model: PRIMARY_GEMINI_MODEL, 
          ...(generationConfig ? { generationConfig } : {}),
          ...(tools ? { tools } : {})
        });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
      } catch (error) {
        throw error;
      }
    },

    generateContentStream: async function* (prompt: string, generationConfig?: Record<string, any>, tools?: any[]) {
      try {
        const model = genAI.getGenerativeModel({ 
          model: PRIMARY_GEMINI_MODEL, 
          ...(generationConfig ? { generationConfig } : {}),
          ...(tools ? { tools } : {})
        });
        const result = await model.generateContentStream(prompt);
        for await (const chunk of result.stream) {
          yield chunk.text();
        }
      } catch (error) {
        throw error;
      }
    },

    generateFromImage: async (prompt: string, imageBase64: string, mimeType: string = "image/jpeg") => {
      try {
        const model = genAI.getGenerativeModel({ model: PRIMARY_GEMINI_MODEL });
        const result = await model.generateContent([
          prompt,
          { inlineData: { data: imageBase64, mimeType } }
        ]);
        return result.response.text();
      } catch (error) {
        throw error;
      }
    },

    embedContent: async (text: string) => {
      try {
        const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
        return await model.embedContent(text);
      } catch (error) {
        throw error;
      }
    }
  };
};

// Export a default instance for backward compatibility
export const gemini = createGeminiClient(primaryKey);
