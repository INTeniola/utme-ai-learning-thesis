import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { EnhancedAIResponse } from '@/hooks/useEnhancedAIResponse';
import {
    AlertTriangle,
    ArrowRight,
    BookOpen,
    CheckCircle2,
    ExternalLink,
    FileQuestion,
    Lightbulb,
    Link as LinkIcon,
    XCircle
} from 'lucide-react';
import mermaid from 'mermaid';
import { useEffect, useRef, useState } from 'react';

interface EnhancedResponseDisplayProps {
    response: EnhancedAIResponse;
    onQuizAnswer?: (isCorrect: boolean) => void;
}

export function EnhancedResponseDisplay({ response, onQuizAnswer }: EnhancedResponseDisplayProps) {
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [showExplanation, setShowExplanation] = useState(false);
    const mermaidRef = useRef<HTMLDivElement>(null);

    // Initialize Mermaid
    useEffect(() => {
        mermaid.initialize({
            startOnLoad: true,
            theme: 'dark',
            themeVariables: {
                primaryColor: '#8b5cf6',
                primaryTextColor: '#fff',
                primaryBorderColor: '#7c3aed',
                lineColor: '#a78bfa',
                secondaryColor: '#c4b5fd',
                tertiaryColor: '#ddd6fe'
            }
        });
    }, []);

    // Render Mermaid diagrams
    useEffect(() => {
        const mermaidDiagram = response.visualAids.find(v => v.type === 'mermaid');
        if (mermaidDiagram && mermaidRef.current) {
            mermaidRef.current.innerHTML = '';
            const id = `mermaid-${Date.now()}`;
            mermaid.render(id, mermaidDiagram.content).then(({ svg }) => {
                if (mermaidRef.current) {
                    mermaidRef.current.innerHTML = svg;
                }
            }).catch(error => {
                console.error('Mermaid rendering error:', error);
            });
        }
    }, [response.visualAids]);

    const handleAnswerSelect = (answer: string) => {
        if (selectedAnswer) return; // Already answered

        setSelectedAnswer(answer);
        setShowExplanation(true);

        if (response.comprehensionCheck) {
            const isCorrect = answer === response.comprehensionCheck.correctAnswer;
            onQuizAnswer?.(isCorrect);
        }
    };

    return (
        <div className="space-y-4">
            {/* Main Explanation */}
            <div className="prose prose-sm dark:prose-invert max-w-none">
                <p className="whitespace-pre-wrap leading-relaxed">{response.text}</p>
            </div>

            {/* Visual Aids */}
            {response.visualAids.length > 0 && (
                <div className="space-y-3">
                    {response.visualAids.map((visual, index) => (
                        <Card key={index} className="border-primary/20">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <Lightbulb className="h-4 w-4 text-primary" />
                                    {visual.caption || 'Visual Aid'}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {visual.type === 'mermaid' && (
                                    <div
                                        ref={mermaidRef}
                                        className="flex items-center justify-center p-4 bg-muted/30 rounded-lg overflow-auto"
                                    />
                                )}
                                {visual.type === 'desmos' && (
                                    <div className="flex flex-col gap-2">
                                        <Button
                                            variant="outline"
                                            className="w-full gap-2"
                                            onClick={() => window.open(visual.content, '_blank')}
                                        >
                                            <ExternalLink className="h-4 w-4" />
                                            Open Interactive Graph in Desmos
                                        </Button>
                                        <p className="text-xs text-muted-foreground text-center">
                                            Visualize and interact with the equation
                                        </p>
                                    </div>
                                )}
                                {visual.type === 'link' && (
                                    <Button
                                        variant="outline"
                                        className="w-full gap-2"
                                        onClick={() => window.open(visual.content, '_blank')}
                                    >
                                        <LinkIcon className="h-4 w-4" />
                                        {visual.caption || 'View Resource'}
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Common Mistakes Warning */}
            {response.commonMistakes.length > 0 && (
                <Alert className="border-yellow-500/50 bg-yellow-500/10">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    <AlertDescription>
                        <p className="font-semibold text-sm mb-2">⚠️ Common Mistakes to Avoid:</p>
                        <ul className="text-sm space-y-1 ml-4">
                            {response.commonMistakes.map((mistake, index) => (
                                <li key={index} className="list-disc">{mistake}</li>
                            ))}
                        </ul>
                    </AlertDescription>
                </Alert>
            )}

            {/* Comprehension Check */}
            {response.comprehensionCheck && (
                <Card className="border-primary/30 bg-primary/5">
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-primary" />
                            Quick Comprehension Check
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <p className="text-sm font-medium">{response.comprehensionCheck.question}</p>
                        <div className="grid gap-2">
                            {response.comprehensionCheck.options.map((option, index) => {
                                const isSelected = selectedAnswer === option;
                                const isCorrect = option === response.comprehensionCheck?.correctAnswer;
                                const showResult = selectedAnswer !== null;

                                return (
                                    <Button
                                        key={index}
                                        variant={isSelected ? (isCorrect ? "default" : "destructive") : "outline"}
                                        className="justify-start text-left h-auto py-3 px-4"
                                        onClick={() => handleAnswerSelect(option)}
                                        disabled={selectedAnswer !== null}
                                    >
                                        <span className="flex items-center gap-2 flex-1">
                                            {showResult && isCorrect && <CheckCircle2 className="h-4 w-4" />}
                                            {showResult && isSelected && !isCorrect && <XCircle className="h-4 w-4" />}
                                            <span>{option}</span>
                                        </span>
                                    </Button>
                                );
                            })}
                        </div>
                        {showExplanation && response.comprehensionCheck.explanation && (
                            <Alert className="mt-3">
                                <AlertDescription className="text-sm">
                                    <strong>Explanation:</strong> {response.comprehensionCheck.explanation}
                                </AlertDescription>
                            </Alert>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Related Resources */}
            {(response.relatedResources.flashcards?.length ||
                response.relatedResources.pastQuestions?.length ||
                response.relatedResources.relatedTopics?.length) && (
                    <Card className="border-primary/30 bg-primary/100/5">
                        <CardHeader>
                            <CardTitle className="text-sm flex items-center gap-2">
                                <BookOpen className="h-4 w-4 text-primary" />
                                Related Resources
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {response.relatedResources.flashcards && response.relatedResources.flashcards.length > 0 && (
                                <div>
                                    <p className="text-xs font-semibold text-muted-foreground mb-1">📚 Flashcard Sets:</p>
                                    <div className="flex flex-wrap gap-1">
                                        {response.relatedResources.flashcards.map((card, index) => (
                                            <Badge key={index} variant="secondary" className="text-xs">
                                                {card}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {response.relatedResources.pastQuestions && response.relatedResources.pastQuestions.length > 0 && (
                                <div>
                                    <p className="text-xs font-semibold text-muted-foreground mb-1">
                                        <FileQuestion className="h-3 w-3 inline mr-1" />
                                        Past Questions:
                                    </p>
                                    <div className="flex flex-wrap gap-1">
                                        {response.relatedResources.pastQuestions.map((q, index) => (
                                            <Badge key={index} variant="outline" className="text-xs">
                                                {q}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {response.relatedResources.relatedTopics && response.relatedResources.relatedTopics.length > 0 && (
                                <div>
                                    <p className="text-xs font-semibold text-muted-foreground mb-1">🔗 Related Topics:</p>
                                    <div className="flex flex-wrap gap-1">
                                        {response.relatedResources.relatedTopics.map((topic, index) => (
                                            <Badge key={index} variant="outline" className="text-xs">
                                                {topic}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

            {/* Next Steps */}
            {response.nextSteps.length > 0 && (
                <Card className="border-green-500/30 bg-green-500/5">
                    <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2">
                            <ArrowRight className="h-4 w-4 text-green-500" />
                            What to Learn Next
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="text-sm space-y-2">
                            {response.nextSteps.map((step, index) => (
                                <li key={index} className="flex items-start gap-2">
                                    <span className="text-green-500 mt-0.5">→</span>
                                    <span>{step}</span>
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
