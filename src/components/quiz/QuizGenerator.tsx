import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { aiGateway } from '@/lib/aiGateway';
import { BrainCircuit, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface Question {
    question: string;
    options: string[];
    answer: string;
    explanation: string;
}

export function QuizGenerator({ onBack }: { onBack?: () => void }) {
    const [topic, setTopic] = useState('');
    const [loading, setLoading] = useState(false);
    const [quiz, setQuiz] = useState<Question[] | null>(null);
    const [answers, setAnswers] = useState<Record<number, string>>({});
    const [showResults, setShowResults] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);

    // Get current user
    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            setUserId(user?.id ?? null);
        });
    }, []);

    const handleGenerate = async () => {
        if (!topic.trim() || !userId) return;

        setLoading(true);
        setQuiz(null);
        setAnswers({});
        setShowResults(false);

        try {
            const prompt = `Generate a quiz with 5 multiple choice questions about "${topic}". 
      Return ONLY a raw JSON array (no markdown code blocks). 
      Each object must have these exact keys: "question", "options" (array of 4 strings), "answer" (string matching exactly one option), "explanation".`;

            const result = await aiGateway.generateSafe(prompt, {
                subject: topic,
                featureType: 'quiz_generation',
                userId: userId
            });

            // Clean up the response in case it contains markdown
            const cleanedResult = result.replace(/```json/g, '').replace(/```/g, '').trim();

            const parsedQuiz = JSON.parse(cleanedResult);
            if (Array.isArray(parsedQuiz)) {
                setQuiz(parsedQuiz);
            } else {
                throw new Error("Invalid format");
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to generate quiz. Try a different topic.");
        } finally {
            setLoading(false);
        }
    };

    const handleSelectOption = (qIndex: number, option: string) => {
        if (showResults) return;
        setAnswers(prev => ({ ...prev, [qIndex]: option }));
    };

    const calculateScore = () => {
        if (!quiz) return 0;
        return quiz.reduce((score, q, idx) => {
            return score + (answers[idx] === q.answer ? 1 : 0);
        }, 0);
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                {onBack && <Button variant="ghost" onClick={onBack}>&larr; Back</Button>}
                <h1 className="text-3xl font-bold font-serif text-primary">Mentat Quiz Generator</h1>
            </div>

            {!quiz ? (
                <Card className="border-primary/20 bg-card/50 backdrop-blur">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BrainCircuit className="h-6 w-6 text-primary" />
                            Generate Prediction Module
                        </CardTitle>
                        <CardDescription>
                            Enter a subject to generate an instant assessment simulation using Gemini.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex gap-4">
                            <Input
                                placeholder="e.g. Dune Ecology, Quantum Mechanics, Abuja History..."
                                value={topic}
                                onChange={(e) => setTopic(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                                className="text-lg p-6 bg-background/50"
                            />
                            <Button onClick={handleGenerate} disabled={loading || !topic} className="h-auto px-8 text-lg font-serif">
                                {loading ? <Loader2 className="animate-spin" /> : "Generate"}
                            </Button>
                        </div>

                        {loading && (
                            <div className="text-center py-12 text-muted-foreground animate-pulse">
                                Consulting the Machine Logic...
                            </div>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                    {quiz.map((q, idx) => {
                        const isCorrect = answers[idx] === q.answer;
                        const isSelected = !!answers[idx];

                        return (
                            <Card key={idx} className={`border-primary/10 ${showResults ? (isCorrect ? 'border-green-500/50 bg-green-500/5' : 'border-red-500/50 bg-red-500/5') : ''}`}>
                                <CardHeader>
                                    <CardTitle className="text-xl font-medium font-sans">
                                        <span className="text-primary/60 mr-2">{idx + 1}.</span> {q.question}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {q.options.map((option) => (
                                            <Button
                                                key={option}
                                                variant={answers[idx] === option ? "default" : "outline"}
                                                className={`h-auto py-3 px-4 justify-start text-left whitespace-normal ${showResults && option === q.answer ? "ring-2 ring-green-500 border-green-500" : ""
                                                    } ${showResults && answers[idx] === option && answers[idx] !== q.answer ? "ring-2 ring-red-500 border-red-500" : ""
                                                    }`}
                                                onClick={() => handleSelectOption(idx, option)}
                                            >
                                                {option}
                                            </Button>
                                        ))}
                                    </div>

                                    {showResults && (
                                        <div className="mt-4 p-3 bg-secondary/10 rounded-lg text-sm">
                                            <p className="font-semibold text-primary flex items-center gap-2">
                                                {isCorrect ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4 text-destructive" />}
                                                Explanation:
                                            </p>
                                            <p className="text-muted-foreground mt-1">{q.explanation}</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}

                    <div className="flex items-center justify-between p-6 bg-card rounded-xl border border-primary/20 sticky bottom-4 shadow-xl backdrop-blur-xl">
                        <div className="text-xl font-serif">
                            {showResults ? (
                                <span>Score: <span className="text-primary font-bold">{calculateScore()}</span> / {quiz.length}</span>
                            ) : (
                                <span>Answered: {Object.keys(answers).length} / {quiz.length}</span>
                            )}
                        </div>

                        {!showResults ? (
                            <Button size="lg" onClick={() => setShowResults(true)} disabled={Object.keys(answers).length < quiz.length}>
                                Submit Assessment
                            </Button>
                        ) : (
                            <Button size="lg" variant="secondary" onClick={() => setQuiz(null)}>
                                Generate Another
                            </Button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
