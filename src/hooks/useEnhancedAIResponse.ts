import { gemini } from '@/lib/gemini';
import { useCallback, useState } from 'react';

export interface VisualAid {
    type: 'mermaid' | 'desmos' | 'image' | 'link';
    content: string;
    caption?: string;
}

export interface ComprehensionCheck {
    question: string;
    options: string[];
    correctAnswer: string;
    explanation: string;
}

export interface RelatedResources {
    flashcards?: string[];
    pastQuestions?: string[];
    conceptVideos?: string[];
    relatedTopics?: string[];
}

export interface EnhancedAIResponse {
    text: string;
    visualAids: VisualAid[];
    comprehensionCheck: ComprehensionCheck | null;
    relatedResources: RelatedResources;
    commonMistakes: string[];
    nextSteps: string[];
}

interface UseEnhancedAIResponseReturn {
    generateEnhancedResponse: (
        question: string,
        subject: string,
        context?: {
            masteryLevel?: number;
            recentMistakes?: string[];
            imageData?: { base64: string; mimeType: string };
        }
    ) => Promise<EnhancedAIResponse>;
    generateEnhancedResponseStream: (
        question: string,
        subject: string,
        onChunk: (text: string) => void,
        context?: {
            masteryLevel?: number;
            recentMistakes?: string[];
            imageData?: { base64: string; mimeType: string };
        }
    ) => Promise<void>;
    loading: boolean;
    error: string | null;
}

export function useEnhancedAIResponse(): UseEnhancedAIResponseReturn {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const generateDesmosLink = (equation: string): string => {
        const encoded = encodeURIComponent(equation);
        return `https://www.desmos.com/calculator?expression=${encoded}`;
    };

    const generateEnhancedResponseStream = useCallback(
        async (
            question: string,
            subject: string,
            onChunk: (text: string) => void,
            context?: {
                masteryLevel?: number;
                recentMistakes?: string[];
                imageData?: { base64: string; mimeType: string };
            }
        ): Promise<void> => {
            setLoading(true);
            setError(null);

            try {
                // Simple streaming prompt for faster responses
                const streamPrompt = `You are an expert tutor for ${subject}. Provide a clear, helpful explanation.

User Question: "${question}"

Provide a detailed, step-by-step explanation. Be concise but thorough.`;

                if (context?.imageData) {
                    for await (const chunk of gemini.generateFromImageStream(
                        streamPrompt,
                        context.imageData.base64,
                        context.imageData.mimeType
                    )) {
                        onChunk(chunk);
                    }
                } else {
                    for await (const chunk of gemini.generateContentStream(streamPrompt)) {
                        onChunk(chunk);
                    }
                }
            } catch (err) {
                console.error('Streaming Error:', err);
                setError('Failed to generate response');
                throw err;
            } finally {
                setLoading(false);
            }
        },
        []
    );

    const generateEnhancedResponse = useCallback(
        async (
            question: string,
            subject: string,
            context?: {
                masteryLevel?: number;
                recentMistakes?: string[];
                imageData?: { base64: string; mimeType: string };
            }
        ): Promise<EnhancedAIResponse> => {
            setLoading(true);
            setError(null);

            try {
                const masteryLevel = context?.masteryLevel || 50;
                const recentMistakes = context?.recentMistakes || [];

                const enhancedPrompt = `You are an expert tutor for ${subject}. Provide a comprehensive, multi-modal response.

User Question: "${question}"
User's Mastery Level: ${masteryLevel}/100
Recent Struggles: ${recentMistakes.join(', ') || 'None'}

IMPORTANT: Respond with ONLY a valid JSON object (no markdown, no code blocks) with this exact structure:
{
  "explanation": "Clear, detailed explanation with step-by-step breakdown",
  "visualAid": {
    "type": "mermaid" | "desmos" | "none",
    "content": "Mermaid diagram code OR equation for Desmos OR empty string",
    "caption": "Brief description of the visual"
  },
  "comprehensionCheck": {
    "question": "A follow-up question to verify understanding",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": "Option A",
    "explanation": "Why this is correct"
  },
  "relatedResources": {
    "flashcards": ["Topic 1", "Topic 2"],
    "pastQuestions": ["2023 Q15", "2022 Q8"],
    "relatedTopics": ["Related Topic 1", "Related Topic 2"]
  },
  "commonMistakes": ["Common mistake 1", "Common mistake 2"],
  "nextSteps": ["What to learn next", "Practice suggestion"]
}

Guidelines:
1. For math/physics: Include Desmos visualization when applicable
2. For processes/concepts: Include Mermaid flowchart or graph
3. ALWAYS include a comprehension check question
4. Highlight 2-3 common mistakes students make
5. Suggest concrete next learning steps
6. Keep explanation clear and structured`;

                let responseText: string;

                if (context?.imageData) {
                    responseText = await gemini.generateFromImage(
                        enhancedPrompt,
                        context.imageData.base64,
                        context.imageData.mimeType
                    );
                } else {
                    responseText = await gemini.generateContent(enhancedPrompt);
                }

                // Clean and parse JSON response
                const cleanJson = responseText
                    .replace(/```json/g, '')
                    .replace(/```/g, '')
                    .trim();

                const parsed = JSON.parse(cleanJson);

                // Process visual aids
                const visualAids: VisualAid[] = [];

                if (parsed.visualAid && parsed.visualAid.type !== 'none') {
                    if (parsed.visualAid.type === 'desmos' && parsed.visualAid.content) {
                        visualAids.push({
                            type: 'desmos',
                            content: generateDesmosLink(parsed.visualAid.content),
                            caption: parsed.visualAid.caption || 'Interactive graph'
                        });
                    } else if (parsed.visualAid.type === 'mermaid' && parsed.visualAid.content) {
                        visualAids.push({
                            type: 'mermaid',
                            content: parsed.visualAid.content,
                            caption: parsed.visualAid.caption || 'Diagram'
                        });
                    }
                }

                const enhancedResponse: EnhancedAIResponse = {
                    text: parsed.explanation || responseText,
                    visualAids,
                    comprehensionCheck: parsed.comprehensionCheck || null,
                    relatedResources: parsed.relatedResources || {},
                    commonMistakes: parsed.commonMistakes || [],
                    nextSteps: parsed.nextSteps || []
                };

                return enhancedResponse;
            } catch (err) {
                console.error('Enhanced AI Response Error:', err);
                setError('Failed to generate enhanced response');

                // Fallback to basic response
                const fallbackText = context?.imageData
                    ? await gemini.generateFromImage(
                        `Explain this in the context of ${subject}: ${question}`,
                        context.imageData.base64,
                        context.imageData.mimeType
                    )
                    : await gemini.generateContent(`You are a helpful tutor for ${subject}. User asks: ${question}`);

                return {
                    text: fallbackText,
                    visualAids: [],
                    comprehensionCheck: null,
                    relatedResources: {},
                    commonMistakes: [],
                    nextSteps: []
                };
            } finally {
                setLoading(false);
            }
        },
        []
    );

    return {
        generateEnhancedResponse,
        generateEnhancedResponseStream,
        loading,
        error
    };
}
