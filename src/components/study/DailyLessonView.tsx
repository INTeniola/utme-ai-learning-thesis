import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAITutor } from '@/hooks/useAITutor';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { BookOpen, Brain, ChevronLeft, Play, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';

interface DailyLessonViewProps {
    subject: string;
    onBack: () => void;
    onStartLesson: (topic: string) => void;
}

export function DailyLessonView({ subject, onBack, onStartLesson }: DailyLessonViewProps) {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [weakestTopic, setWeakestTopic] = useState<string | null>(null);
    const [lessonPlan, setLessonPlan] = useState<any>(null); // Simplified for now
    const { sendMessage } = useAITutor(); // Reuse for generating content if needed, or just prompt

    useEffect(() => {
        async function fetchWeakestTopic() {
            if (!user) return;
            setLoading(true);
            try {
                // 1. Try to find a topic with low mastery from concept_mastery
                const { data: masteryData } = await supabase
                    .from('concept_mastery')
                    .select('topic, accuracy')
                    .eq('user_id', user.id)
                    .eq('subject', subject)
                    .lt('accuracy', 60)
                    .order('accuracy', { ascending: true })
                    .limit(1);

                if (masteryData && masteryData.length > 0) {
                    setWeakestTopic(masteryData[0].topic);
                } else {
                    // 2. If no data, pick a random topic from syllabus (fallback)
                    const { data: syllabusData } = await supabase
                        .from('jamb_syllabus')
                        .select('topic')
                        .eq('subject', subject)
                        .limit(5); // Get a few and pick one

                    if (syllabusData && syllabusData.length > 0) {
                        const randomTopic = syllabusData[Math.floor(Math.random() * syllabusData.length)].topic;
                        setWeakestTopic(randomTopic);
                    } else {
                        setWeakestTopic("General Introduction");
                    }
                }
            } catch (error) {
                console.error("Error fetching daily lesson topic:", error);
                setWeakestTopic("General Review");
            } finally {
                setLoading(false);
            }
        }

        fetchWeakestTopic();
    }, [user, subject]);

    if (loading) {
        return (
            <div className="p-6 space-y-4">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-48 w-full rounded-xl" />
                <Skeleton className="h-12 w-full" />
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto p-4 md:p-6">
            <button
                onClick={onBack}
                className="mb-4 flex items-center w-fit gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
                <ChevronLeft className="h-4 w-4" />
                Dashboard
            </button>
            <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold">Daily Lesson: {subject}</h1>
            </div>

            <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                <CardHeader>
                    <div className="flex items-center gap-2 mb-2">
                        <Badge variant="secondary" className="bg-primary/20 text-primary hover:bg-primary/30">
                            <Sparkles className="h-3 w-3 mr-1" />
                            Recommended for You
                        </Badge>
                    </div>
                    <CardTitle className="text-2xl sm:text-3xl">{weakestTopic}</CardTitle>
                    <CardDescription>
                        Based on your recent performance, we've identified this as a key area for improvement.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col sm:flex-row gap-4 mt-4">
                        <Button
                            size="lg"
                            className="w-full sm:w-auto gap-2 text-lg h-12"
                            onClick={() => weakestTopic && onStartLesson(weakestTopic)}
                        >
                            <Play className="h-5 w-5" />
                            Start Interactive Lesson
                        </Button>
                        <Button variant="outline" size="lg" className="w-full sm:w-auto gap-2 h-12" onClick={onBack}>
                            I'll do this later
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Brain className="h-4 w-4 text-muted-foreground" />
                            Why this topic?
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">
                            Mastering <strong>{weakestTopic}</strong> is crucial for a high score in {subject}.
                            It frequently appears in JAMB past questions.
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <BookOpen className="h-4 w-4 text-muted-foreground" />
                            What you'll learn
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                            <li>Key definitions and concepts</li>
                            <li>Common pitfalls and how to avoid them</li>
                            <li>Step-by-step problem solving</li>
                        </ul>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
