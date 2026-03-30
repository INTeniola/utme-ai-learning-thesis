import { LatexRenderer } from '@/components/study/LatexRenderer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DiagnosticData, ExamQuestion } from '@/hooks/useCBTExam';
import { sanitizeQuestion } from '@/lib/textUtils';
import { cn } from '@/lib/utils';
import {
    AlertTriangle,
    ArrowLeft,
    Award,
    BarChart3,
    BookOpen,
    CheckCircle2,
    Clock,
    Target,
    TrendingDown,
    TrendingUp,
    XCircle,
} from 'lucide-react';

interface DiagnosticReportProps {
  diagnostic: DiagnosticData;
  questions: ExamQuestion[];
  answers: Record<string, string>;
  onBack: () => void;
}

export function DiagnosticReport({
  diagnostic,
  questions,
  answers,
  onBack,
}: DiagnosticReportProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getScoreColor = (scaled: number) => {
    if (scaled >= 300) return 'text-green-600';
    if (scaled >= 200) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBackground = (scaled: number) => {
    if (scaled >= 300) return 'bg-green-100 border-green-200';
    if (scaled >= 200) return 'bg-yellow-100 border-yellow-200';
    return 'bg-red-100 border-red-200';
  };

  const getGradeLabel = (scaled: number) => {
    if (scaled >= 300) return 'Excellent';
    if (scaled >= 200) return 'Average';
    return 'Below Average';
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </button>
        <Badge variant="outline" className="font-bold tracking-widest uppercase text-[10px]">
          Official Diagnostic Analysis
        </Badge>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-black tracking-tighter sm:text-3xl">Performance Audit</h1>
        <p className="mt-1 text-sm text-muted-foreground font-medium italic">
          Aggregate analysis across {diagnostic.totalQuestions} standardized metrics.
        </p>
      </div>

      {/* Overall Score Card — High-Contrast Focus */}
      <Card className={cn('mb-8 border-2 shadow-xl shadow-primary/5', getScoreBackground(diagnostic.scaledScore ?? 0))}>
        <CardContent className="flex flex-col items-center gap-8 p-8 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-6">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white shadow-md sm:h-28 sm:w-28 border-2 border-primary/10">
              <Award className={cn('h-10 w-10 sm:h-14 sm:w-14', getScoreColor(diagnostic.scaledScore ?? 0))} />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground opacity-70">Estimated JAMB Score</p>
              <div className="flex items-baseline gap-1">
                <span className={cn('text-5xl font-black tabular-nums tracking-tighter sm:text-7xl', getScoreColor(diagnostic.scaledScore ?? 0))}>
                  {diagnostic.scaledScore ?? diagnostic.score}
                </span>
                <span className="text-xl font-bold text-muted-foreground opacity-40">/400</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={cn('font-black uppercase tracking-tighter px-3 h-6', getScoreColor(diagnostic.scaledScore ?? 0), 'bg-white border-2')}>
                  {getGradeLabel(diagnostic.scaledScore ?? 0)}
                </Badge>
                <span className="text-xs font-bold text-muted-foreground">
                  Raw: {diagnostic.score}/{diagnostic.totalQuestions} ({diagnostic.percentage}%)
                </span>
              </div>
            </div>
          </div>
          <div className="text-center sm:text-right">
            <p className="text-sm text-muted-foreground">Total Time</p>
            <p className="text-2xl font-bold">{formatTime(diagnostic.timeAnalysis.totalTimeSeconds)}</p>
            <p className="text-sm text-muted-foreground">
              Avg: {formatTime(diagnostic.timeAnalysis.avgTimePerQuestion)}/question
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Insights */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-5 w-5 text-primary" />
            Performance Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {diagnostic.performanceInsights.map((insight, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{insight}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Detailed Tabs */}
      <Tabs defaultValue="subjects" className="mb-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="subjects" className="text-xs sm:text-sm">
            By Subject
          </TabsTrigger>
          <TabsTrigger value="topics" className="text-xs sm:text-sm">
            By Topic
          </TabsTrigger>
          <TabsTrigger value="time" className="text-xs sm:text-sm">
            Time Analysis
          </TabsTrigger>
        </TabsList>

        {/* Subject Breakdown */}
        <TabsContent value="subjects">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Subject Performance</CardTitle>
              <CardDescription>How you performed in each subject</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(diagnostic.subjectBreakdown).map(([subject, data]) => {
                const scaled = diagnostic.subjectScaledScores?.[subject];
                return (
                  <div key={subject} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{subject}</span>
                      </div>
                      <div className="flex items-center gap-2 text-right">
                        <span className="text-xs text-muted-foreground">
                          {data.correct}/{data.total} raw
                        </span>
                        {scaled && (
                          <Badge
                            variant="secondary"
                            className={cn(
                              scaled.scaledScore >= 80 && 'bg-green-100 text-green-700',
                              scaled.scaledScore >= 50 && scaled.scaledScore < 80 && 'bg-yellow-100 text-yellow-700',
                              scaled.scaledScore < 50 && 'bg-red-100 text-red-700'
                            )}
                          >
                            {scaled.scaledScore}/100 JAMB
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Progress value={scaled?.scaledScore ?? data.percentage} className="h-2" />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Topic Breakdown */}
        <TabsContent value="topics">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Topic Performance</CardTitle>
              <CardDescription>Detailed breakdown by topic with time spent</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-80">
                <div className="space-y-3 pr-4">
                  {Object.entries(diagnostic.topicBreakdown)
                    .sort((a, b) => a[1].percentage - b[1].percentage)
                    .map(([topic, data]) => (
                      <div
                        key={topic}
                        className={cn(
                          'rounded-lg border p-3',
                          data.percentage < 50 && 'border-red-200 bg-red-50'
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{topic}</p>
                            <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                              <span>{data.correct}/{data.total} correct</span>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatTime(data.avgTimeSeconds)} avg
                              </span>
                            </div>
                          </div>
                          <Badge
                            variant={data.percentage >= 50 ? 'secondary' : 'destructive'}
                            className="shrink-0"
                          >
                            {data.percentage}%
                          </Badge>
                        </div>
                        <Progress value={data.percentage} className="mt-2 h-1.5" />
                      </div>
                    ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Time Analysis */}
        <TabsContent value="time">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-5 w-5" />
                Time Wasted Analysis
              </CardTitle>
              <CardDescription>
                Understanding where you spent too much time
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <p className="text-xs text-muted-foreground">Total Time</p>
                  <p className="text-lg font-bold">
                    {formatTime(diagnostic.timeAnalysis.totalTimeSeconds)}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <p className="text-xs text-muted-foreground">Avg Per Question</p>
                  <p className="text-lg font-bold">
                    {formatTime(diagnostic.timeAnalysis.avgTimePerQuestion)}
                  </p>
                </div>
                <div className="col-span-2 rounded-lg bg-muted/50 p-3 text-center sm:col-span-1">
                  <p className="text-xs text-muted-foreground">Over 3 min</p>
                  <p className="text-lg font-bold">
                    {diagnostic.timeAnalysis.questionsOverThreshold.length} questions
                  </p>
                </div>
              </div>

              {diagnostic.timeAnalysis.fastestQuestion && diagnostic.timeAnalysis.slowestQuestion && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-3">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="text-sm font-medium text-green-800">Fastest Answer</p>
                      <p className="text-xs text-green-600">
                        Q{diagnostic.timeAnalysis.fastestQuestion.index}: {formatTime(diagnostic.timeAnalysis.fastestQuestion.time)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-3">
                    <TrendingDown className="h-5 w-5 text-red-600" />
                    <div>
                      <p className="text-sm font-medium text-red-800">Slowest Answer</p>
                      <p className="text-xs text-red-600">
                        Q{diagnostic.timeAnalysis.slowestQuestion.index}: {formatTime(diagnostic.timeAnalysis.slowestQuestion.time)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {diagnostic.timeAnalysis.questionsOverThreshold.length > 0 && (
                <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-yellow-600" />
                    <div>
                      <p className="text-sm font-medium text-yellow-800">Time Management Alert</p>
                      <p className="text-xs text-yellow-700">
                        Questions that took over 3 minutes: {' '}
                        {diagnostic.timeAnalysis.questionsOverThreshold.join(', ')}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Question Review */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-5 w-5" />
            Question Review
          </CardTitle>
          <CardDescription>Review your answers and explanations</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96">
            <div className="space-y-4 pr-4">
              {questions.map((q, index) => {
                const userAnswer = answers[q.id];
                // Use verified results from server
                const verifiedResult = diagnostic.verifiedResults?.find(r => r.questionId === q.id);
                const isCorrect = verifiedResult?.isCorrect ?? false;
                const correctOption = verifiedResult?.correctOption ?? '';
                const explanation = verifiedResult?.explanation ?? null;

                return (
                  <div
                    key={q.id}
                    className={cn(
                      'rounded-lg border p-4',
                      isCorrect ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'
                    )}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <Badge variant="outline" className="gap-1">
                        Q{index + 1}
                        {isCorrect ? (
                          <CheckCircle2 className="h-3 w-3 text-green-600" />
                        ) : (
                          <XCircle className="h-3 w-3 text-red-600" />
                        )}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {q.subject} • {q.topic}
                      </span>
                    </div>
                    <div className="mb-3 text-sm">
                      <LatexRenderer content={sanitizeQuestion(q.questionText)} />
                    </div>
                    <div className="space-y-1 text-sm">
                      <p className="flex items-start gap-1">
                        <span className="text-muted-foreground shrink-0 mt-0.5">Your answer: </span>
                        <span className={cn(
                          "break-words whitespace-pre-wrap max-w-full overflow-hidden",
                          isCorrect ? 'text-green-700' : 'text-red-700'
                        )}>
                          {userAnswer || 'Not answered'} - {userAnswer ? sanitizeQuestion(q.options[userAnswer as keyof typeof q.options]) : ''}
                        </span>
                      </p>
                      {!isCorrect && correctOption && (
                        <p className="flex items-start gap-1">
                          <span className="text-muted-foreground shrink-0 mt-0.5">Correct answer: </span>
                          <span className="text-green-700 break-words whitespace-pre-wrap max-w-full overflow-hidden">
                            {correctOption} - {sanitizeQuestion(q.options[correctOption as keyof typeof q.options])}
                          </span>
                        </p>
                      )}
                      {explanation && (
                        <p className="mt-2 text-muted-foreground">
                          <LatexRenderer content={sanitizeQuestion(explanation)} />
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Action */}
      <div className="mt-6">
        <Button onClick={onBack} className="w-full sm:w-auto">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Return to Dashboard
        </Button>
      </div>
    </div>
  );
}
