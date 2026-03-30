import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { BookOpen, Brain, CheckCircle2, Clock, Target } from 'lucide-react';
import { useEffect, useState } from 'react';

interface DailyGoal {
    id: string;
    label: string;
    icon: React.ElementType;
    targetValue: number;
    currentValue: number;
    unit: string;
    completed: boolean;
}

interface DailyGoalsCardProps {
    className?: string;
}

export function DailyGoalsCard({ className }: DailyGoalsCardProps) {
    const { user } = useAuth();
    const [goals, setGoals] = useState<DailyGoal[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;

        async function fetchTodayProgress() {
            try {
                const today = format(new Date(), 'yyyy-MM-dd');

                // Fetch today's study sessions
                const { data: sessions, error: sessionsError } = await supabase
                    .from('study_sessions')
                    .select('duration_minutes, session_type, flashcards_reviewed, questions_answered')
                    .eq('user_id', user.id)
                    .gte('started_at', `${today}T00:00:00`)
                    .lte('started_at', `${today}T23:59:59`);

                if (sessionsError) throw sessionsError;

                // Fetch today's completed quiz sessions (exam_sessions is the correct table)
                const { data: quizzes, error: quizzesError } = await supabase
                    .from('exam_sessions')
                    .select('score, total_questions')
                    .eq('user_id', user.id)
                    .gte('completed_at', `${today}T00:00:00`)
                    .lte('completed_at', `${today}T23:59:59`);

                if (quizzesError) console.warn('Quizzes fetch:', quizzesError);

                // Calculate totals
                const totalStudyMinutes = sessions?.reduce((sum, s) => sum + (s.duration_minutes || 0), 0) || 0;
                const totalFlashcards = sessions?.reduce((sum, s) => sum + (s.flashcards_reviewed || 0), 0) || 0;
                const totalQuestions = quizzes?.reduce((sum, q) => sum + (q.total_questions || 0), 0) || 0;
                const quizCount = quizzes?.length || 0;

                // Get user's goals from profile (or use defaults)
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('academic_goals')
                    .eq('id', user.id)
                    .single();

                const academicGoals = profile?.academic_goals as {
                    dailyStudyMinutes?: number;
                    dailyQuizzes?: number;
                    dailyFlashcards?: number;
                } | null;

                const targetStudyMinutes = academicGoals?.dailyStudyMinutes || 60;
                const targetQuizzes = academicGoals?.dailyQuizzes || 1;
                const targetFlashcards = academicGoals?.dailyFlashcards || 20;

                setGoals([
                    {
                        id: 'study-time',
                        label: 'Study Time',
                        icon: Clock,
                        targetValue: targetStudyMinutes,
                        currentValue: totalStudyMinutes,
                        unit: 'min',
                        completed: totalStudyMinutes >= targetStudyMinutes,
                    },
                    {
                        id: 'quizzes',
                        label: 'Complete Quizzes',
                        icon: Brain,
                        targetValue: targetQuizzes,
                        currentValue: quizCount,
                        unit: 'quiz',
                        completed: quizCount >= targetQuizzes,
                    },
                    {
                        id: 'flashcards',
                        label: 'Review Flashcards',
                        icon: BookOpen,
                        targetValue: targetFlashcards,
                        currentValue: totalFlashcards,
                        unit: 'cards',
                        completed: totalFlashcards >= targetFlashcards,
                    },
                ]);
            } catch (error) {
                console.error('Error fetching daily goals:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchTodayProgress();

        // Refresh every 5 minutes as a fallback
        const interval = setInterval(fetchTodayProgress, 300_000);

        // Real-time updates — re-fetch immediately when any session is inserted
        const channel = supabase
            .channel(`daily-goals:${user.id}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'study_sessions',
                filter: `user_id=eq.${user.id}`,
            }, () => { fetchTodayProgress(); })
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'exam_sessions',
                filter: `user_id=eq.${user.id}`,
            }, () => { fetchTodayProgress(); })
            .subscribe();

        return () => {
            clearInterval(interval);
            supabase.removeChannel(channel);
        };
    }, [user]);

    const completedCount = goals.filter(g => g.completed).length;
    const totalGoals = goals.length;

    if (loading) {
        return (
            <Card className={className}>
                <CardHeader>
                    <CardTitle className="text-base">Today's Goals</CardTitle>
                    <CardDescription>Loading...</CardDescription>
                </CardHeader>
            </Card>
        );
    }

    return (
        <Card className={className}>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-base">Today's Goals</CardTitle>
                        <CardDescription>
                            {completedCount} of {totalGoals} completed
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <Target className="h-4 w-4 text-primary" />
                        <span className="text-sm font-semibold">
                            {Math.round((completedCount / totalGoals) * 100)}%
                        </span>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {goals.length === 0 ? (
                    <div className="py-4 text-center">
                        <p className="text-sm text-muted-foreground">
                            The desert is vast, but the path is yours to make. Set your first goal.
                        </p>
                    </div>
                ) : (
                    goals.map((goal) => {
                        const Icon = goal.icon;
                        const progress = Math.min(100, (goal.currentValue / goal.targetValue) * 100);

                        return (
                            <div key={goal.id} className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2">
                                        {goal.completed ? (
                                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                                        ) : (
                                            <Icon className="h-4 w-4 text-muted-foreground" />
                                        )}
                                        <span className={cn(
                                            goal.completed && "text-muted-foreground line-through",
                                            !goal.completed && "font-medium"
                                        )}>
                                            {goal.label}
                                        </span>
                                    </div>
                                    <span className="text-muted-foreground">
                                        {goal.currentValue}/{goal.targetValue} {goal.unit}
                                    </span>
                                </div>
                                <Progress
                                    value={progress}
                                    className={cn(
                                        "h-2",
                                        goal.completed && "[&>div]:bg-green-500"
                                    )}
                                />
                            </div>
                        );
                    }))}

                {completedCount === totalGoals && (
                    <div className="mt-4 rounded-lg bg-green-50 p-3 text-center dark:bg-green-950">
                        <p className="text-sm font-medium text-green-700 dark:text-green-300">
                            🎉 All goals completed! Great work!
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
