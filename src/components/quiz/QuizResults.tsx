import { LatexRenderer } from '@/components/study/LatexRenderer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { QuizQuestion, QuizResult } from '@/hooks/useQuiz';
import { supabase } from '@/integrations/supabase/client';
import { cleanQuestionText } from '@/lib/textUtils';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import {
    CheckCircle2,
    Clock,
    Lightbulb,
    Sparkles,
    Target,
    TrendingUp,
    Trophy,
    XCircle
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface QuizResultsProps {
  result: QuizResult;
  questions: QuizQuestion[];
  subject: string;
  onReviewTopic: (topic: string) => void;
  onNewQuiz: () => void;
  onBack: () => void;
}

export function QuizResults({
  result,
  questions,
  subject,
  onReviewTopic,
  onNewQuiz,
  onBack,
}: QuizResultsProps) {
  const { user } = useAuth();
  const [showConfetti, setShowConfetti] = useState(false);
  const [pastResults, setPastResults] = useState<{ date: string; score: number }[]>([]);
  const [percentile, setPercentile] = useState<number | null>(null);

  const isGoodScore = result.percentage >= 70;

  // Show celebration animation for good scores
  useEffect(() => {
    if (isGoodScore) {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isGoodScore]);

  // Fetch past results for trend chart
  useEffect(() => {
    async function fetchPastResults() {
      if (!user) return;

      const { data, error } = await supabase
        .from('quiz_results')
        .select('completed_at, score, total_questions')
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false })
        .limit(5);

      if (!error && data) {
        const results = data.map(r => ({
          date: new Date(r.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          score: Math.round((r.score / r.total_questions) * 100),
        })).reverse();
        setPastResults(results);
      }
    }

    async function calculatePercentile() {
      if (!user) return;

      // Get all quiz results for this subject
      const { data, error } = await supabase
        .from('quiz_results')
        .select('score, total_questions')
        .eq('user_id', user.id);

      if (!error && data && data.length > 1) {
        const scores = data.map(r => (r.score / r.total_questions) * 100);
        const currentScore = result.percentage;
        const belowCount = scores.filter(s => s < currentScore).length;
        const pct = Math.round((belowCount / scores.length) * 100);
        setPercentile(pct);
      }
    }

    fetchPastResults();
    calculatePercentile();
  }, [user, result.percentage]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  // Sort topics by performance (weakest first)
  const sortedTopics = Object.entries(result.topicBreakdown)
    .map(([topic, data]) => ({ topic, ...data }))
    .sort((a, b) => a.percentage - b.percentage);

  const weakTopics = sortedTopics.filter(t => t.percentage < 60);

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      {/* Celebration Animation */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative">
              {[...Array(20)].map((_, i) => (
                <div
                  key={i}
                  className="absolute w-3 h-3 rounded-full animate-ping"
                  style={{
                    backgroundColor: ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899'][i % 4],
                    left: `${Math.random() * 200 - 100}px`,
                    top: `${Math.random() * 200 - 100}px`,
                    animationDelay: `${Math.random() * 0.5}s`,
                    animationDuration: `${0.5 + Math.random() * 0.5}s`,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-4xl space-y-6">
        {/* Score Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className={cn(
            "text-center overflow-hidden",
            isGoodScore && "border-success"
          )}>
            <CardHeader className={cn(
              "pb-4",
              isGoodScore ? "bg-success/10" : "bg-muted/50"
            )}>
              <div className="mx-auto mb-4">
                {isGoodScore ? (
                  <Trophy className="h-16 w-16 text-success animate-bounce" />
                ) : (
                  <Target className="h-16 w-16 text-muted-foreground" />
                )}
              </div>
              <CardTitle className="text-4xl font-bold">
                {result.score}/{result.totalQuestions}
              </CardTitle>
              <div className="flex items-center justify-center gap-2 mt-2">
                <Badge
                  variant={isGoodScore ? "default" : "secondary"}
                  className="text-xl px-4 py-1"
                >
                  {result.percentage}%
                </Badge>
              </div>
              {isGoodScore && (
                <p className="text-success font-medium mt-2">
                  🎉 Excellent work! Keep it up!
                </p>
              )}
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <Clock className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                  <p className="text-sm text-muted-foreground">Time Taken</p>
                  <p className="font-semibold">{formatTime(result.timeTaken)}</p>
                </div>
                <div>
                  <Lightbulb className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                  <p className="text-sm text-muted-foreground">Hints Used</p>
                  <p className="font-semibold">{result.hintsUsed}</p>
                </div>
                <div>
                  <TrendingUp className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                  <p className="text-sm text-muted-foreground">Percentile</p>
                  <p className="font-semibold">
                    {percentile !== null ? `Top ${100 - percentile}%` : 'N/A'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Topic Breakdown & Trend */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Topic Breakdown */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="text-lg">Topic Performance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {sortedTopics.map(({ topic, correct, total, percentage }) => (
                  <div key={topic} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium truncate flex-1">{topic}</span>
                      <span className={cn(
                        "ml-2",
                        percentage >= 70 && "text-success",
                        percentage < 60 && "text-destructive"
                      )}>
                        {correct}/{total} ({percentage}%)
                      </span>
                    </div>
                    <Progress
                      value={percentage}
                      className={cn(
                        "h-2",
                        percentage >= 70 && "[&>div]:bg-success",
                        percentage < 60 && "[&>div]:bg-destructive"
                      )}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>

          {/* Score Trend */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="text-lg">Score Trend</CardTitle>
                <CardDescription>Your last 5 quiz scores</CardDescription>
              </CardHeader>
              <CardContent>
                {pastResults.length > 1 ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={pastResults}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        dataKey="date"
                        className="text-xs fill-muted-foreground"
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis
                        domain={[0, 100]}
                        className="text-xs fill-muted-foreground"
                        tick={{ fontSize: 11 }}
                      />
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
                ) : (
                  <div className="flex h-[180px] items-center justify-center text-muted-foreground">
                    Complete more quizzes to see your trend
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>



        {/* Question Review */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Question Review</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="wrong" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="wrong" className="gap-2">
                    <XCircle className="h-4 w-4" />
                    Wrong ({result.totalQuestions - result.score})
                  </TabsTrigger>
                  <TabsTrigger value="correct" className="gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Correct ({result.score})
                  </TabsTrigger>
                </TabsList>

                {['wrong', 'correct'].map(tab => (
                  <TabsContent key={tab} value={tab} className="space-y-4 mt-4">
                    {questions
                      .filter(q => {
                        const answer = result.answers[q.id];
                        return tab === 'wrong' ? !answer?.isCorrect : answer?.isCorrect;
                      })
                      .slice(0, 5)
                      .map((q, index) => {
                        const answer = result.answers[q.id];
                        return (
                          <div key={q.id} className="rounded-lg border p-4 space-y-3">
                            <div className="flex items-start justify-between gap-4">
                              <p className="text-sm font-medium">
                                <LatexRenderer content={cleanQuestionText(q.questionText)} />
                              </p>
                              <Badge variant="outline" className="shrink-0">
                                {q.topic}
                              </Badge>
                            </div>
                            <div className="space-y-2 text-sm">
                              <div className={cn(
                                "rounded-md p-3",
                                tab === 'wrong' ? "bg-destructive/10 border border-destructive/20" : "bg-success/10 border border-success/20"
                              )}>
                                <span className="font-semibold block mb-1">Your answer:</span>
                                <span className={cn(
                                  "inline-block break-words whitespace-pre-wrap max-w-full overflow-hidden",
                                  tab === 'wrong' ? "text-destructive" : "text-success"
                                )}>
                                  {answer?.selected ? (
                                    <>
                                      <strong>{answer.selected.charAt(0)}</strong> - {q.options[answer.selected.charAt(0)]}
                                    </>
                                  ) : 'Skipped'}
                                </span>
                              </div>
                              {tab === 'wrong' && answer?.correct && (
                                <div className="rounded-md p-3 bg-success/10 border border-success/20">
                                  <span className="font-semibold block mb-1 text-success">Correct answer:</span>
                                  <span className="text-success inline-block break-words whitespace-pre-wrap max-w-full overflow-hidden">
                                    <strong>{answer.correct.charAt(0)}</strong> - {q.options[answer.correct.charAt(0)]}
                                  </span>
                                </div>
                              )}
                            </div>
                            {q.explanation && (
                              <p className="text-sm text-muted-foreground bg-muted/50 rounded-md p-2">
                                <LatexRenderer content={q.explanation} />
                              </p>
                            )}
                          </div>
                        );
                      })}
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="flex flex-col sm:flex-row gap-3"
        >
          <Button
            variant="outline"
            onClick={onBack}
            className="flex-1"
          >
            Back to Dashboard
          </Button>
          <Button
            onClick={onNewQuiz}
            className="flex-1 gap-2"
          >
            <Sparkles className="h-4 w-4" />
            Try Another Quiz
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
