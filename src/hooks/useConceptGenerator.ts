import { gemini } from '@/lib/gemini';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

export interface ConceptStep {
    id: string;
    title: string;
    explanation: string;
    visualDescription: string;
    mermaidDiagram?: string;
    motionData?: any; // Structured data for the MathVisualizer (points, lines, vectors, etc)
    narration: string;
}

export interface ConceptLesson {
    topic: string;
    overview: string;
    steps: ConceptStep[];
    totalDuration: number; // in seconds
}

interface UseConceptGeneratorReturn {
    generating: boolean;
    lesson: ConceptLesson | null;
    generateLesson: (topic: string, subject?: string) => Promise<void>;
    reset: () => void;
}

export function useConceptGenerator(): UseConceptGeneratorReturn {
    const [generating, setGenerating] = useState(false);
    const [lesson, setLesson] = useState<ConceptLesson | null>(null);

    const generateLesson = useCallback(async (topic: string, subject = 'General') => {
        setGenerating(true);
        setLesson(null);

        try {
            const prompt = `You are an expert educator creating a visual, step-by-step explanation similar to 3Blue1Brown videos.

Topic: "${topic}" (Subject: ${subject})

Create a comprehensive lesson with 5-7 steps that build upon each other. For each step, provide:
1. A clear title
2. Detailed explanation (2-3 sentences)
3. Visual description (what diagram/illustration would help)
4. Mermaid diagram code (if applicable).
   - Use "graph TD" or "graph LR" for flowcharts.
   - Use "subgraph" to group related concepts.
   - Use "direction TB" or "direction LR" inside subgraphs for clarity.
   - Ensure nodes have consistent, descriptive labels.
   - Keep diagrams focused on the current step's concept.
5. motionData: A JSON array of geometric objects for a 3b1b-style visualization (ONLY for Math/Physics).
   Example motionData structure: [{"type": "line", "points": [[0,0], [1,1]], "label": "Vector v", "animate": "draw"}, {"type": "circle", "center": [0,0], "radius": 1, "color": "blue"}]
   Supported types: "line", "circle", "point", "vector", "function_plot", "arc".
   Coordinates are from -10 to 10.
6. Narration text (conversational, engaging explanation)

Return ONLY a valid JSON object with this structure:
{
  "topic": "${topic}",
  "overview": "Brief overview of what we'll learn",
  "steps": [
    {
      "id": "step1",
      "title": "Step title",
      "explanation": "Detailed explanation",
      "visualDescription": "Description of visual aid",
      "mermaidDiagram": "graph TD\n  A[Concept] --> B[Detail]",
      "motionData": [],
      "narration": "Engaging narration text"
    }
  ]
}

Make it educational, engaging, and highly visual. For Math/Physics, focus more on the motionData than Mermaid.`;

            const responseText = await gemini.generateContent(prompt);
            const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
            const lessonData = JSON.parse(cleanJson);

            // Add IDs if missing and calculate duration
            const processedSteps: ConceptStep[] = lessonData.steps.map((step: any, index: number) => ({
                id: step.id || `step${index + 1}`,
                title: step.title,
                explanation: step.explanation,
                visualDescription: step.visualDescription,
                mermaidDiagram: step.mermaidDiagram,
                motionData: step.motionData,
                narration: step.narration
            }));

            const totalDuration = processedSteps.reduce((acc, step) => {
                // Estimate ~3 seconds per sentence
                const sentences = step.narration.split(/[.!?]+/).filter(s => s.trim().length > 0);
                return acc + (sentences.length * 3);
            }, 0);

            const processedLesson: ConceptLesson = {
                topic: lessonData.topic,
                overview: lessonData.overview,
                steps: processedSteps,
                totalDuration
            };

            setLesson(processedLesson);
            toast.success('Lesson generated successfully!');
        } catch (error) {
            console.error('Failed to generate lesson:', error);
            toast.error('Failed to generate lesson. Please try again.');
        } finally {
            setGenerating(false);
        }
    }, []);

    const reset = useCallback(() => {
        setLesson(null);
    }, []);

    return {
        generating,
        lesson,
        generateLesson,
        reset
    };
}
