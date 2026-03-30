import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useProgressDashboard } from '@/hooks/useProgressDashboard';
import { cn } from '@/lib/utils';
import {
    Battery,
    BatteryWarning,
    Brain,
    ChevronLeft,
    Clock,
    Flame,
    RefreshCw,
    Target,
    TrendingUp,
    Zap
} from 'lucide-react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from 'recharts';
import { ActivityHeatmap } from './ActivityHeatmap';
import { DailyGoalsCard } from './DailyGoalsCard';

import { useAuth } from '@/hooks/useAuth';

interface UnifiedProgressDashboardProps {
    onBack?: () => void;
}

export function UnifiedProgressDashboard({ onBack }: UnifiedProgressDashboardProps) {
    const { user } = useAuth();
    const { loading, data, error, refresh } = useProgressDashboard(user?.id);

    if (loading || !user) {
        return (
            <div className="mx-auto max-w-7xl px-4 py-6 space-y-6 animate-fade-in">
                {onBack && (
                    <button
                        onClick={onBack}
                        className="mb-6 flex items-center w-fit gap-1 text-sm font-medium text-muted-foreground transition-colors"
                    >
                        <ChevronLeft className="h-4 w-4" />
                        Dashboard
                    </button>
                )}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <Skeleton className="h-8 w-64 mb-2" />
                        <Skeleton className="h-4 w-48" />
                    </div>
                    <Skeleton className="h-8 w-24" />
                </div>

                {/* Top Stats Cards Skeletons */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-6">
                    <Skeleton className="h-24 w-full rounded-xl" />
                    <Skeleton className="h-24 w-full rounded-xl" />
                    <Skeleton className="h-24 w-full rounded-xl" />
                    <Skeleton className="h-24 w-full rounded-xl" />
                </div>

                {/* Main Content Grid Skeletons */}
                <div className="grid gap-6 lg:grid-cols-3">
                    <div className="space-y-6 lg:col-span-2">
                        <Skeleton className="h-[300px] w-full rounded-xl" />
                        <Skeleton className="h-[350px] w-full rounded-xl" />
                        <Skeleton className="h-[250px] w-full rounded-xl" />
                    </div>
                    <div className="space-y-6">
                        <Skeleton className="h-[280px] w-full rounded-xl" />
                        <Skeleton className="h-[200px] w-full rounded-xl" />
                        <Skeleton className="h-[150px] w-full rounded-xl" />
                    </div>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center px-4">
                <div className="rounded-full bg-destructive/10 p-3">
                    <BatteryWarning className="h-6 w-6 text-destructive" />
                </div>
                <h3 className="text-lg font-semibold">Failed to load dashboard</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                    {error || 'An unexpected error occurred while fetching your progress data.'}
                </p>
                <div className="flex items-center gap-3 mt-2">
                    {onBack && (
                        <Button onClick={onBack} variant="outline">
                            Go Back
                        </Button>
                    )}
                    <Button onClick={refresh} className="gap-2">
                        <RefreshCw className="h-4 w-4" />
                        Retry
                    </Button>
                </div>
            </div>
        );
    }

    // Calculate some derived metrics
    const hasData = data.subjects.length > 0 || data.totalStudyHours > 0;

    // Real score trajectory from exam_sessions (computed in hook)
    const scoreTrajectoryData = data.scoreTrajectory ?? [];

    // Prepare subject performance data array safely
    const subjectsList = data.subjects ?? [];
    const subjectPerformanceData = subjectsList.map(subject => ({
        subject: subject.name,
        mastery: subject.mastery,
    }));

    // Calculate fatigue level based on study patterns (simplified) safely
    const getFatigueLevel = () => {
        const activities = data.dailyActivities ?? [];
        if (activities.length === 0) return 'fresh'; // Handle empty state gracefully

        const recentActivity = activities
            .slice(-7)
            .reduce((sum, day) => sum + (day.minutes || 0), 0);

        if (recentActivity > 600) return 'high';
        if (recentActivity > 400) return 'moderate';
        return 'low';
    };

    const fatigueLevel = getFatigueLevel();

    const getFatigueInfo = () => {
        switch (fatigueLevel) {
            case 'low':
                return {
                    icon: Battery,
                    color: 'text-green-600',
                    bg: 'bg-green-100 dark:bg-green-950',
                    label: 'Fresh & Ready',
                    message: 'Great energy levels! Perfect time for challenging topics.',
                    percentage: 100,
                };
            case 'moderate':
                return {
                    icon: Battery,
                    color: 'text-yellow-600',
                    bg: 'bg-yellow-100 dark:bg-yellow-950',
                    label: 'Moderate Fatigue',
                    message: 'Consider taking a short break soon.',
                    percentage: 60,
                };
            case 'high':
                return {
                    icon: BatteryWarning,
                    color: 'text-orange-600',
                    bg: 'bg-orange-100 dark:bg-orange-950',
                    label: 'High Fatigue',
                    message: 'Your focus may be declining. Take a 15-minute break.',
                    percentage: 30,
                };
            case 'fresh':
                return {
                    icon: Battery,
                    color: 'text-blue-600',
                    bg: 'bg-blue-100 dark:bg-blue-950',
                    label: 'Ready to Start',
                    message: 'Take your first quiz or review a flashcard to begin tracking fatigue.',
                    percentage: 100,
                };
            default:
                return {
                    icon: Battery,
                    color: 'text-green-600',
                    bg: 'bg-green-100 dark:bg-green-950',
                    label: 'Fresh',
                    message: 'Ready to study!',
                    percentage: 100,
                };
        }
    };

    const fatigueInfo = getFatigueInfo();
    const FatigueIcon = fatigueInfo.icon;

    const dailyActivitiesSafe = data.dailyActivities ?? [];

    return (
        <div className="mx-auto max-w-7xl px-4 py-6">
            {/* Header */}
            {onBack && (
                <button
                    onClick={onBack}
                    className="mb-6 flex items-center w-fit gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                    <ChevronLeft className="h-4 w-4" />
                    Dashboard
                </button>
            )}

            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold sm:text-2xl">Progress & Performance</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Track your study habits and academic progress
                    </p>
                </div>
                <Button onClick={refresh} variant="ghost" size="sm" className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                </Button>
            </div>

            {/* Top Stats Cards */}
            <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Card>
                    <CardContent className="flex items-center gap-3 p-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-950">
                            <Flame className="h-5 w-5 fill-orange-500 text-info" />
                        </div>
                        <div>
                            <p className="text-xl font-bold">{data.studyStreak}</p>
                            <p className="text-xs text-muted-foreground">Day Streak</p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="flex items-center gap-3 p-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 dark:bg-blue-950">
                            <Clock className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-xl font-bold">{data.totalStudyHours}h</p>
                            <p className="text-xs text-muted-foreground">Total Study</p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="flex items-center gap-3 p-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-950">
                            <Brain className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                            <p className="text-xl font-bold">{data.quizAverage}%</p>
                            <p className="text-xs text-muted-foreground">Quiz Average</p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="flex items-center gap-3 p-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                            <Target className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-xl font-bold">{data.daysToUTME || '--'}</p>
                            <p className="text-xs text-muted-foreground">Days to UTME</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Main Content Grid */}
            <div className="grid gap-6 lg:grid-cols-3">
                {/* Left Column - Charts and Goals */}
                <div className="space-y-6 lg:col-span-2">
                    {/* Score Trajectory */}
                    {scoreTrajectoryData.length > 0 && (
                        <Card>
                            <CardContent className="p-6">
                                <h3 className="mb-4 flex items-center gap-2 text-base font-semibold">
                                    <TrendingUp className="h-5 w-5 text-primary" />
                                    Performance Trend
                                </h3>
                                <ResponsiveContainer width="100%" height={200}>
                                    <LineChart data={scoreTrajectoryData}>
                                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                                        <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: 'hsl(var(--card))',
                                                border: '1px solid hsl(var(--border))',
                                                borderRadius: '8px',
                                            }}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="score"
                                            stroke="hsl(var(--primary))"
                                            strokeWidth={2}
                                            dot={{ fill: 'hsl(var(--primary))' }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    )}

                    {/* Subject Performance */}
                    {subjectPerformanceData.length > 0 ? (
                        <Card>
                            <CardContent className="p-6">
                                <h3 className="mb-4 flex items-center gap-2 text-base font-semibold">
                                    <Brain className="h-5 w-5 text-primary" />
                                    Subject Mastery
                                </h3>
                                <ResponsiveContainer width="100%" height={250}>
                                    <BarChart data={subjectPerformanceData} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                                        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
                                        <YAxis type="category" dataKey="subject" tick={{ fontSize: 12 }} width={100} />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: 'hsl(var(--card))',
                                                border: '1px solid hsl(var(--border))',
                                                borderRadius: '8px',
                                            }}
                                        />
                                        <Bar dataKey="mastery" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card className="border-dashed bg-muted/30">
                            <CardContent className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                                <Brain className="h-10 w-10 mb-4 opacity-20" />
                                <p className="font-medium text-foreground">No Mastery Data Yet</p>
                                <p className="text-sm max-w-sm mt-1">Complete a Mock Exam or Quick Quiz to generate your Subject Mastery charting.</p>
                            </CardContent>
                        </Card>
                    )}

                    {/* Daily Goals */}
                    <DailyGoalsCard />
                </div>

                {/* Right Column - Activity & Insights */}
                <div className="space-y-6">
                    {/* Activity Heatmap */}
                    {dailyActivitiesSafe.length > 0 && (
                        <ActivityHeatmap activities={dailyActivitiesSafe} />
                    )}

                    {/* Cognitive Load */}
                    <Card>
                        <CardContent className="p-6">
                            <h3 className="mb-4 flex items-center gap-2 text-base font-semibold">
                                <Zap className="h-5 w-5 text-primary" />
                                Cognitive Load
                            </h3>
                            <div className={cn('mb-4 rounded-lg p-4', fatigueInfo.bg)}>
                                <div className="flex items-center gap-3">
                                    <FatigueIcon className={cn('h-8 w-8', fatigueInfo.color)} />
                                    <div>
                                        <p className={cn('font-semibold', fatigueInfo.color)}>
                                            {fatigueInfo.label}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {fatigueInfo.message}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <div className="mb-1 flex justify-between text-sm">
                                        <span>Energy Level</span>
                                        <span className="font-medium">{fatigueInfo.percentage}%</span>
                                    </div>
                                    <Progress
                                        value={fatigueInfo.percentage}
                                        className="h-2 [&>div]:bg-primary"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Peer Comparison */}
                    {data.percentileRank > 0 ? (
                        <Card>
                            <CardContent className="p-6">
                                <h3 className="mb-2 text-base font-semibold">Peer Comparison</h3>
                                <p className="mb-3 text-2xl font-bold text-primary">
                                    Top {100 - data.percentileRank}%
                                </p>
                                <p className="text-sm text-muted-foreground">{data.peerInsight}</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card>
                            <CardContent className="p-6">
                                <h3 className="mb-2 text-base font-semibold">Peer Comparison</h3>
                                <p className="text-sm text-muted-foreground">{data.peerInsight}</p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
