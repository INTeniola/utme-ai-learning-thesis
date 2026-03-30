import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/hooks/useAuth';
import {
    CheckCircle2,
    Clock,
    Flame,
    Target,
    TrendingUp
} from 'lucide-react';
import { useEffect, useState } from 'react';

interface DailyGoal {
    id: string;
    label: string;
    targetMinutes: number;
    currentMinutes: number;
    completed: boolean;
}

export function AccountabilityTracker() {
    const { user } = useAuth();
    const [streak, setStreak] = useState(0);
    const [lastStudyDate, setLastStudyDate] = useState<Date | null>(null);
    const [studyHistory, setStudyHistory] = useState<Date[]>([]);
    const [goals, setGoals] = useState<DailyGoal[]>([
        { id: '1', label: 'Daily Study Time', targetMinutes: 60, currentMinutes: 45, completed: false },
        { id: '2', label: 'Solve Questions', targetMinutes: 20, currentMinutes: 20, completed: true },
        { id: '3', label: 'Review Flashcards', targetMinutes: 15, currentMinutes: 5, completed: false }
    ]);

    useEffect(() => {
        if (!user) return;

        // In a real app, we would fetch this from the database
        // For now, we'll simulate some data
        setStreak(12);
        const today = new Date();
        setLastStudyDate(today);

        // Generate some fake history for the calendar
        const history = [];
        for (let i = 0; i < 15; i++) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            if (Math.random() > 0.2) history.push(date);
        }
        setStudyHistory(history);

    }, [user]);

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {/* Streak Card */}
                <Card className="border-info/20 bg-orange-500/5">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Current Streak</CardTitle>
                        <Flame className="h-4 w-4 text-info fill-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-600">{streak} Days</div>
                        <p className="text-xs text-muted-foreground">
                            You're on fire! Keep it up!
                        </p>
                    </CardContent>
                </Card>

                {/* Goals Progress */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Daily Goals</CardTitle>
                        <Target className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {goals.filter(g => g.completed).length}/{goals.length}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Goals completed today
                        </p>
                    </CardContent>
                </Card>

                {/* Total Time */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Time Studied</CardTitle>
                        <Clock className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">2.5 hrs</div>
                        <p className="text-xs text-muted-foreground">
                            +30m from yesterday
                        </p>
                    </CardContent>
                </Card>

                {/* Focus Score */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Focus Score</CardTitle>
                        <TrendingUp className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">85%</div>
                        <p className="text-xs text-muted-foreground">
                            Based on quiz accuracy
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-7">
                {/* Goals Detail */}
                <Card className="md:col-span-4">
                    <CardHeader>
                        <CardTitle>Today's Commitments</CardTitle>
                        <CardDescription>
                            Track your daily study goals and build consistency.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {goals.map((goal) => (
                            <div key={goal.id} className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2">
                                        {goal.completed ? (
                                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                                        ) : (
                                            <Target className="h-4 w-4 text-muted-foreground" />
                                        )}
                                        <span className={goal.completed ? "line-through text-muted-foreground" : "font-medium"}>
                                            {goal.label}
                                        </span>
                                    </div>
                                    <span className="text-muted-foreground">
                                        {goal.currentMinutes}/{goal.targetMinutes}
                                    </span>
                                </div>
                                <Progress
                                    value={(goal.currentMinutes / goal.targetMinutes) * 100}
                                    className="h-2"
                                // indicatorClassName={goal.completed ? "bg-green-500" : ""}
                                />
                            </div>
                        ))}
                    </CardContent>
                </Card>

                {/* Calendar */}
                <Card className="md:col-span-3">
                    <CardHeader>
                        <CardTitle>Consistency Log</CardTitle>
                        <CardDescription>Visualizing your study habit.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex justify-center">
                        <div className="grid grid-cols-7 gap-2">
                            {Array.from({ length: 28 }, (_, i) => {
                                const date = new Date();
                                date.setDate(date.getDate() - (27 - i));
                                const hasStudied = studyHistory.some(d =>
                                    d.toDateString() === date.toDateString()
                                );
                                return (
                                    <div
                                        key={i}
                                        className={`w-8 h-8 rounded-md flex items-center justify-center text-xs ${hasStudied
                                            ? 'bg-primary text-primary-foreground font-bold'
                                            : 'bg-muted text-muted-foreground'
                                            }`}
                                        title={date.toLocaleDateString()}
                                    >
                                        {date.getDate()}
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
