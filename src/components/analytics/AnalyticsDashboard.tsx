import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState, NoAnalyticsEmptyState } from '@/components/ui/empty-state';
import { Progress } from '@/components/ui/progress';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAnalytics } from '@/hooks/useAnalytics';
import { cn } from '@/lib/utils';
import {
    Battery, BatteryLow,
    BatteryMedium,
    BatteryWarning,
    Brain, ChevronLeft, FileQuestion, Flame, RefreshCw,
    Target,
    TrendingUp,
    Users,
    Zap
} from 'lucide-react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';

import { useAuth } from '@/hooks/useAuth';

interface AnalyticsDashboardProps {
  onBack: () => void;
}

const SUBJECTS = ['Physics', 'Chemistry', 'Biology', 'Mathematics', 'English'];

export function AnalyticsDashboard({ onBack }: AnalyticsDashboardProps) {
  const { user } = useAuth();

  const {
    loading,
    data,
    error,
    selectedSubject,
    setSelectedSubject,
    refresh,
  } = useAnalytics(user?.id);

  if (loading || !user) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6 space-y-6 animate-fade-in">
        <button
          onClick={onBack}
          className="mb-6 flex items-center w-fit gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Dashboard
        </button>
        <div className="flex items-center justify-between mb-8">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-8 w-24" />
        </div>

        <div className="mb-6">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>

        {/* Top Stats Skeletons */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-6">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>

        {/* Main Grid Skeletons */}
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="lg:col-span-2 h-[400px] w-full rounded-xl" />
          <Skeleton className="h-[400px] w-full rounded-xl" />
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
        <h3 className="text-lg font-semibold">Failed to load analytics</h3>
        <p className="text-sm text-destructive max-w-sm">
          {error || 'An unexpected error occurred while fetching your analytics data.'}
        </p>
        <div className="flex items-center gap-3 mt-2">
          <Button onClick={onBack} variant="outline">
            Go Back
          </Button>
          <Button onClick={refresh} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // Check if user has no data yet (new user)
  const hasNoData = data.scoreTrajectory.length === 0 &&
    data.subjectPerformance.every(s => s.userScore === 0) &&
    data.totalStudyMinutes === 0;

  if (hasNoData) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6">
        <button
          onClick={onBack}
          className="mb-6 flex items-center w-fit gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Dashboard
        </button>
        <NoAnalyticsEmptyState onStart={onBack} />
      </div>
    );
  }

  const getFatigueInfo = () => {
    switch (data.fatigueLevel) {
      case 'low':
        return {
          icon: Battery,
          color: 'text-green-600',
          bg: 'bg-green-100',
          label: 'Fresh & Ready',
          message: 'Great energy levels! Perfect time for challenging topics.',
          percentage: 100,
        };
      case 'moderate':
        return {
          icon: BatteryMedium,
          color: 'text-yellow-600',
          bg: 'bg-yellow-100',
          label: 'Moderate Fatigue',
          message: 'Consider taking a short break soon.',
          percentage: 60,
        };
      case 'high':
        return {
          icon: BatteryLow,
          color: 'text-orange-600',
          bg: 'bg-orange-100',
          label: 'High Fatigue',
          message: 'Your focus may be declining. Take a 15-minute break.',
          percentage: 30,
        };
      case 'critical':
        return {
          icon: BatteryWarning,
          color: 'text-red-600',
          bg: 'bg-red-100',
          label: 'Critical Fatigue',
          message: 'Rest recommended! Continued study may reduce retention.',
          percentage: 10,
        };
    }
  };

  const fatigueInfo = getFatigueInfo();
  const FatigueIcon = fatigueInfo.icon;

  // Calculate progress toward target
  const targetProgress = Math.min(100, (data.projectedScore / data.targetScore) * 100);
  const scoreGap = data.targetScore - data.projectedScore;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center w-fit gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Dashboard
        </button>
        <Button onClick={refresh} variant="ghost" size="sm" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="mb-8">
        <h1 className="text-xl font-bold sm:text-2xl">Performance</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track your progress toward your UTME goals
        </p>
      </div>

      {/* Top Stats Cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xl font-bold">{data.targetScore}</p>
              <p className="text-xs text-muted-foreground">Target Score</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xl font-bold">{data.projectedScore}</p>
              <p className="text-xs text-muted-foreground">Projected Score</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
              <Flame className="h-5 w-5 text-info" />
            </div>
            <div>
              <p className="text-xl font-bold">{data.studyStreak}</p>
              <p className="text-xs text-muted-foreground">Day Streak</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100">
              <Brain className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xl font-bold">{Math.round(data.totalStudyMinutes / 60)}h</p>
              <p className="text-xs text-muted-foreground">Total Study</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Score Trajectory */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-5 w-5 text-primary" />
              Score Trajectory
            </CardTitle>
            <CardDescription>
              Your performance trend and projected improvement
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.scoreTrajectory.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={data.scoreTrajectory}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <ReferenceLine
                    y={(data.targetScore / 400) * 100}
                    stroke="hsl(var(--primary))"
                    strokeDasharray="5 5"
                    label={{ value: 'Target', position: 'right', fontSize: 12 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    name="Actual Score"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--primary))' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="projected"
                    name="Projected"
                    stroke="hsl(var(--muted-foreground))"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-64 items-center justify-center">
                <EmptyState
                  icon={FileQuestion}
                  title="No trajectory data"
                  description="Complete exams to see your projected score trajectory."
                  actionLabel="Start Practice"
                  onAction={onBack}
                  className="py-6"
                />
              </div>
            )}

            {/* Progress to Target */}
            <div className="mt-4 rounded-lg border p-4">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium">Progress to Target</span>
                <span className="text-muted-foreground">
                  {data.projectedScore} / {data.targetScore}
                </span>
              </div>
              <Progress value={targetProgress} className="h-2" />
              <p className="mt-2 text-xs text-muted-foreground">
                {scoreGap > 0
                  ? `${scoreGap} points to reach your goal. Keep practicing!`
                  : 'Congratulations! You\'re on track to exceed your target!'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Study Fatigue Indicator */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="h-5 w-5 text-primary" />
              Cognitive Load
            </CardTitle>
            <CardDescription>
              Your current study fatigue level
            </CardDescription>
          </CardHeader>
          <CardContent>
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
                  className={cn(
                    'h-2',
                    fatigueInfo.percentage > 60 && '[&>div]:bg-green-500',
                    fatigueInfo.percentage <= 60 && fatigueInfo.percentage > 30 && '[&>div]:bg-yellow-500',
                    fatigueInfo.percentage <= 30 && '[&>div]:bg-red-500'
                  )}
                />
              </div>

              <div className="rounded-lg bg-muted/50 p-3">
                <p className="mb-2 text-xs font-medium">Recommendations</p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {data.fatigueLevel === 'low' && (
                    <>
                      <li>• Perfect time for complex problem-solving</li>
                      <li>• Try challenging new topics</li>
                    </>
                  )}
                  {data.fatigueLevel === 'moderate' && (
                    <>
                      <li>• Review familiar concepts</li>
                      <li>• Take a 5-minute break every 25 minutes</li>
                    </>
                  )}
                  {data.fatigueLevel === 'high' && (
                    <>
                      <li>• Switch to lighter review tasks</li>
                      <li>• Take a 15-minute break now</li>
                    </>
                  )}
                  {data.fatigueLevel === 'critical' && (
                    <>
                      <li>• Stop studying and rest</li>
                      <li>• Continue tomorrow for better retention</li>
                    </>
                  )}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Peer Comparison Section */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Subject Performance vs Peers */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-5 w-5 text-primary" />
              Subject Performance vs Peers
            </CardTitle>
            <CardDescription>
              How you compare to other users
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.subjectPerformance.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.subjectPerformance} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <YAxis
                    type="category"
                    dataKey="subject"
                    tick={{ fontSize: 12 }}
                    width={80}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="userScore"
                    name="Your Score"
                    fill="hsl(var(--primary))"
                    radius={[0, 4, 4, 0]}
                  />
                  <Bar
                    dataKey="averageScore"
                    name="Peer Average"
                    fill="hsl(var(--muted-foreground))"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-64 items-center justify-center">
                <EmptyState
                  icon={Users}
                  title="No peer comparison"
                  description="Take an exam to see how you stack up against peers."
                  actionLabel="Take a Quiz"
                  onAction={onBack}
                  className="py-6"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Topic-Level Comparison */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Brain className="h-5 w-5 text-primary" />
                  Topic Comparison
                </CardTitle>
                <CardDescription>
                  Your performance vs. peer average by topic
                </CardDescription>
              </div>
              <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUBJECTS.map((subject) => (
                    <SelectItem key={subject} value={subject}>
                      {subject}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {data.topicComparisons.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.topicComparisons}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="topic"
                    tick={{ fontSize: 10 }}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="userScore"
                    name="You"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="averageScore"
                    name="Peer Avg"
                    fill="hsl(var(--muted-foreground))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-64 items-center justify-center">
                <EmptyState
                  icon={Brain}
                  title="No topic insights"
                  description={`Complete ${selectedSubject} exercises to see topic analysis.`}
                  actionLabel="Study Subject"
                  onAction={onBack}
                  className="py-6"
                />
              </div>
            )}

            {/* Quick Insights */}
            {data.topicComparisons.length > 0 && (
              <div className="mt-4 space-y-2">
                {data.topicComparisons
                  .filter(t => t.userScore > 0 && t.userScore > t.averageScore)
                  .slice(0, 2)
                  .map(t => (
                    <div key={t.topic} className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-xs">
                      <Badge variant="secondary" className="bg-green-100 text-green-700">
                        Above Avg
                      </Badge>
                      <span className="text-green-800">
                        You're {t.userScore - t.averageScore}% above average in {t.topic}
                      </span>
                    </div>
                  ))}
                {data.topicComparisons
                  .filter(t => t.userScore > 0 && t.userScore < t.averageScore)
                  .slice(0, 1)
                  .map(t => (
                    <div key={t.topic} className="flex items-center gap-2 rounded-lg bg-yellow-50 px-3 py-2 text-xs">
                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
                        Focus Area
                      </Badge>
                      <span className="text-yellow-800">
                        Practice more on {t.topic} to catch up
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
