import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/hooks/useAuth';
import {
    AlertCircle,
    Brain,
    Calendar,
    CheckCircle2,
    Clock,
    Loader2,
    Pause,
    Play,
    Target,
    Zap
} from 'lucide-react';
import { useEffect, useState } from 'react';

interface ScheduleBlock {
    id: string;
    subject: string;
    topic: string;
    startTime: string;
    duration: number; // minutes
    priority: 'high' | 'medium' | 'low';
    completed: boolean;
    type: 'study' | 'practice' | 'review' | 'break';
}

interface FocusSession {
    active: boolean;
    subject: string;
    startTime: Date | null;
    duration: number; // minutes
    elapsed: number; // seconds
}

export function AdaptiveScheduler() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [schedule, setSchedule] = useState<ScheduleBlock[]>([]);
    const [focusSession, setFocusSession] = useState<FocusSession>({
        active: false,
        subject: '',
        startTime: null,
        duration: 25,
        elapsed: 0
    });
    const [examDate] = useState(new Date('2026-03-15'));

    useEffect(() => {
        if (!user) return;
        // Load or generate today's schedule
        loadSchedule();
    }, [user]);

    // Focus mode timer
    useEffect(() => {
        if (!focusSession.active) return;

        const interval = setInterval(() => {
            setFocusSession(prev => {
                const newElapsed = prev.elapsed + 1;
                if (newElapsed >= prev.duration * 60) {
                    // Session complete
                    return { ...prev, active: false, elapsed: 0 };
                }
                return { ...prev, elapsed: newElapsed };
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [focusSession.active]);

    const loadSchedule = async () => {
        // In production, fetch from database
        // For now, generate sample schedule
        const sampleSchedule: ScheduleBlock[] = [
            {
                id: '1',
                subject: 'Mathematics',
                topic: 'Quadratic Equations',
                startTime: '09:00',
                duration: 45,
                priority: 'high',
                completed: true,
                type: 'study'
            },
            {
                id: '2',
                subject: 'Physics',
                topic: 'Newton\'s Laws',
                startTime: '10:00',
                duration: 30,
                priority: 'high',
                completed: false,
                type: 'practice'
            },
            {
                id: '3',
                subject: 'Chemistry',
                topic: 'Organic Reactions',
                startTime: '11:00',
                duration: 40,
                priority: 'medium',
                completed: false,
                type: 'study'
            },
            {
                id: '4',
                subject: 'Break',
                topic: 'Rest & Recharge',
                startTime: '12:00',
                duration: 15,
                priority: 'low',
                completed: false,
                type: 'break'
            },
            {
                id: '5',
                subject: 'English',
                topic: 'Essay Writing',
                startTime: '12:30',
                duration: 35,
                priority: 'medium',
                completed: false,
                type: 'practice'
            }
        ];
        setSchedule(sampleSchedule);
    };

    const generateSchedule = async () => {
        setLoading(true);
        try {
            // In production, this would call Gemini to generate personalized schedule
            // based on user's subjects, mastery levels, and exam date
            await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API call
            loadSchedule();
        } catch (error) {
            console.error('Failed to generate schedule:', error);
        } finally {
            setLoading(false);
        }
    };

    const startFocusMode = (block: ScheduleBlock) => {
        setFocusSession({
            active: true,
            subject: block.subject,
            startTime: new Date(),
            duration: block.duration,
            elapsed: 0
        });
    };

    const toggleFocus = () => {
        setFocusSession(prev => ({ ...prev, active: !prev.active }));
    };

    const daysUntilExam = Math.ceil((examDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'high': return 'text-red-500 bg-red-500/10 border-red-500/20';
            case 'medium': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
            case 'low': return 'text-green-500 bg-green-500/10 border-green-500/20';
            default: return '';
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="space-y-4 sm:space-y-6 p-2 sm:p-0">
            {/* Header Stats - Mobile Responsive Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <Card className="border-primary/20">
                    <CardHeader className="pb-2 sm:pb-3">
                        <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-1 sm:gap-2">
                            <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
                            <span className="hidden sm:inline">Exam In</span>
                            <span className="sm:hidden">Exam</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl sm:text-2xl font-bold">{daysUntilExam}d</div>
                        <p className="text-xs text-muted-foreground hidden sm:block">
                            {examDate.toLocaleDateString()}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2 sm:pb-3">
                        <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-1 sm:gap-2">
                            <Target className="h-3 w-3 sm:h-4 sm:w-4" />
                            <span>Today</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl sm:text-2xl font-bold">
                            {schedule.filter(s => s.completed).length}/{schedule.length}
                        </div>
                        <p className="text-xs text-muted-foreground hidden sm:block">Tasks done</p>
                    </CardContent>
                </Card>

                <Card className="col-span-2 lg:col-span-2">
                    <CardHeader className="pb-2 sm:pb-3">
                        <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-1 sm:gap-2">
                            <Zap className="h-3 w-3 sm:h-4 sm:w-4 text-info" />
                            <span>Focus Mode</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {focusSession.active ? (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm sm:text-base font-medium">{focusSession.subject}</span>
                                    <Badge variant="outline" className="text-xs">
                                        {formatTime(focusSession.duration * 60 - focusSession.elapsed)}
                                    </Badge>
                                </div>
                                <Progress
                                    value={(focusSession.elapsed / (focusSession.duration * 60)) * 100}
                                    className="h-1 sm:h-2"
                                />
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={toggleFocus}
                                    className="w-full text-xs sm:text-sm"
                                >
                                    <Pause className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                                    Pause
                                </Button>
                            </div>
                        ) : (
                            <p className="text-xs sm:text-sm text-muted-foreground">
                                Not active - Click a task to start
                            </p>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Main Schedule Area */}
            <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
                {/* Schedule List */}
                <Card className="lg:col-span-2">
                    <CardHeader className="pb-3 sm:pb-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0">
                            <div>
                                <CardTitle className="text-base sm:text-lg">Today's Study Plan</CardTitle>
                                <CardDescription className="text-xs sm:text-sm">
                                    AI-optimized for your exam prep
                                </CardDescription>
                            </div>
                            <Button
                                onClick={generateSchedule}
                                disabled={loading}
                                size="sm"
                                className="text-xs sm:text-sm"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 animate-spin" />
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        <Brain className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                                        <span className="hidden sm:inline">Regenerate</span>
                                        <span className="sm:hidden">Regen</span>
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-[400px] sm:h-[500px] pr-2 sm:pr-4">
                            <div className="space-y-2 sm:space-y-3">
                                {schedule.map((block) => (
                                    <Card
                                        key={block.id}
                                        className={`${block.completed ? 'opacity-60' : ''} ${block.type === 'break' ? 'bg-muted/30' : ''
                                            }`}
                                    >
                                        <CardContent className="p-3 sm:p-4">
                                            <div className="flex items-start gap-2 sm:gap-3">
                                                <div className="flex-shrink-0 mt-0.5">
                                                    {block.completed ? (
                                                        <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
                                                    ) : (
                                                        <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                                                    )}
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2 mb-1 sm:mb-2">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="font-semibold text-sm sm:text-base truncate">
                                                                {block.subject}
                                                            </span>
                                                            <Badge
                                                                variant="outline"
                                                                className={`text-xs ${getPriorityColor(block.priority)}`}
                                                            >
                                                                {block.priority}
                                                            </Badge>
                                                        </div>
                                                        <span className="text-xs sm:text-sm text-muted-foreground">
                                                            {block.startTime} • {block.duration}min
                                                        </span>
                                                    </div>

                                                    <p className="text-xs sm:text-sm text-muted-foreground mb-2">
                                                        {block.topic}
                                                    </p>

                                                    {!block.completed && block.type !== 'break' && (
                                                        <Button
                                                            size="sm"
                                                            onClick={() => startFocusMode(block)}
                                                            disabled={focusSession.active}
                                                            className="text-xs"
                                                        >
                                                            <Play className="h-3 w-3 mr-1" />
                                                            Start Focus
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>

                {/* Priority Topics Sidebar */}
                <Card className="lg:col-span-1">
                    <CardHeader className="pb-3 sm:pb-4">
                        <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-info" />
                            Priority Topics
                        </CardTitle>
                        <CardDescription className="text-xs">
                            Focus on these for maximum impact
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs sm:text-sm">
                                    <span className="font-medium">Quadratic Equations</span>
                                    <Badge variant="destructive" className="text-xs">Critical</Badge>
                                </div>
                                <Progress value={35} className="h-1 sm:h-2" />
                                <p className="text-xs text-muted-foreground">35% mastery • 12 days left</p>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs sm:text-sm">
                                    <span className="font-medium">Newton's Laws</span>
                                    <Badge variant="outline" className="text-xs text-yellow-500">High</Badge>
                                </div>
                                <Progress value={60} className="h-1 sm:h-2" />
                                <p className="text-xs text-muted-foreground">60% mastery • Practice needed</p>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs sm:text-sm">
                                    <span className="font-medium">Organic Chemistry</span>
                                    <Badge variant="outline" className="text-xs text-yellow-500">High</Badge>
                                </div>
                                <Progress value={45} className="h-1 sm:h-2" />
                                <p className="text-xs text-muted-foreground">45% mastery • Review soon</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
