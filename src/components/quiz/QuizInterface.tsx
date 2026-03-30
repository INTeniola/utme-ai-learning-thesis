import { LatexRenderer } from '@/components/study/LatexRenderer';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from "@/components/ui/use-toast";
import { QuizQuestion, QuizState } from '@/hooks/useQuiz';
import { logger } from '@/lib/logger';
import { sanitizeQuestion } from '@/lib/textUtils';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import {
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Clock,
    Flag,
    Lightbulb,
    Loader2,
    Send,
    X
} from 'lucide-react';
import { useMemo, useState } from 'react';

interface QuizInterfaceProps {
  quizState: QuizState;
  currentQuestion: QuizQuestion | null;
  unansweredCount: number;
  onSelectAnswer: (questionId: string, answer: string) => void;
  onToggleFlag: (questionId: string) => void;
  onGoToQuestion: (index: number) => void;
  onRequestHint: (questionId: string) => Promise<string | null>;
  onSubmit: () => Promise<any>;
  onBack?: () => void;
}

export function QuizInterface({
  quizState,
  currentQuestion,
  unansweredCount,
  onSelectAnswer,
  onToggleFlag,
  onGoToQuestion,
  onRequestHint,
  onSubmit,
  onBack,
}: QuizInterfaceProps) {
  const [showHint, setShowHint] = useState(false);
  const [currentHint, setCurrentHint] = useState<string | null>(null);
  const [isLoadingHint, setIsLoadingHint] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const { toast } = useToast();

  const handleCompleteTraining = async () => {
    console.log('Quiz submitted'); // Added for debugging based on user request
    await onSubmit();
    toast({ description: "Performance Data Logged. Path Adjusted." });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isTimeWarning = quizState.timeRemaining <= 120; // Less than 2 minutes
  const progress = ((quizState.currentIndex + 1) / quizState.questions.length) * 100;

  const handleRequestHint = async () => {
    if (!currentQuestion) return;

    setIsLoadingHint(true);
    const hint = await onRequestHint(currentQuestion.id);
    setCurrentHint(hint);
    setShowHint(true);
    setIsLoadingHint(false);
  };

  const hintUsedForCurrent = currentQuestion
    ? quizState.hintsUsed[currentQuestion.id]
    : false;

  // Question palette data
  const paletteData = useMemo(() => {
    return quizState.questions.map((q, index) => ({
      index,
      id: q.id,
      answered: !!quizState.answers[q.id],
      flagged: quizState.flaggedQuestions.has(q.id),
      current: index === quizState.currentIndex,
    }));
  }, [quizState.questions, quizState.answers, quizState.flaggedQuestions, quizState.currentIndex]);

  logger.log('QuizInterface state:', {
    questionsLength: quizState.questions.length,
    currentIndex: quizState.currentIndex,
    currentQuestion,
    currentQuestionDirect: quizState.questions[quizState.currentIndex],
    firstQuestion: quizState.questions[0],
    allQuestions: quizState.questions
  });

  // Sanitization handled by global utility
  const sanitize = (text: string) => sanitizeQuestion(text);

  if (!currentQuestion) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">
            Loading quiz... ({quizState.questions.length} questions loaded)
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background/50">
      {/* Header */}
      <header className="border-b bg-card/95 backdrop-blur px-4 py-3 shrink-0">
        <div className="flex items-center justify-between">
          {onBack ? (
            <button
              onClick={onBack}
              className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-muted transition-colors"
              title="Exit Quiz"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          ) : (
            <Badge variant="outline" className="text-base font-medium">
              {quizState.currentIndex + 1}/{quizState.questions.length}
            </Badge>
          )}
          <Badge variant="outline" className="text-base font-medium">
            {quizState.currentIndex + 1}/{quizState.questions.length}
          </Badge>
          <Badge variant="secondary" className="hidden sm:flex">
            {currentQuestion.subject}
          </Badge>
          <div className={cn(
            "flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
            isTimeWarning ? "bg-destructive text-destructive-foreground animate-pulse" : "bg-muted"
          )}>
            <Clock className="h-4 w-4" />
            {formatTime(quizState.timeRemaining)}
          </div>
        </div>
        <Progress value={progress} className="h-1 mt-3 rounded-none w-full" />
      </header>

      {/* Main Content (Scrollable) */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth">
        <div className={cn(
          "mx-auto pb-20",
          currentQuestion.passageText ? "max-w-7xl grid lg:grid-cols-2 gap-8 items-start" : "max-w-3xl space-y-6"
        )}>
          {/* Comprehension Passage Split-Pane */}
          {currentQuestion.passageText && (
            <div className="lg:sticky lg:top-0 bg-card rounded-xl border border-border/50 shadow-sm p-5 md:p-6 space-y-4 max-h-[calc(100vh-14rem)] overflow-y-auto">
              <div className="flex items-center gap-2 pb-3 border-b border-border/50">
                <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">
                  Reading Comprehension
                </Badge>
              </div>
              <div className="prose prose-sm md:prose-base prose-invert max-w-none text-muted-foreground leading-relaxed">
                <LatexRenderer content={sanitize(currentQuestion.passageText)} />
              </div>
            </div>
          )}

          {/* Question Panel */}
          <div className="w-full space-y-6 min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentQuestion.id}
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs">{currentQuestion.topic}</Badge>
                  <Badge variant={currentQuestion.difficulty === 'hard' ? 'destructive' : 'secondary'} className="text-xs capitalize">
                    {currentQuestion.difficulty}
                  </Badge>
                </div>

                <Card>
                  <CardContent className="pt-6">
                    <div className="text-lg font-medium leading-relaxed">
                      <LatexRenderer content={sanitize(currentQuestion.questionText)} />
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-3">
                  {(['A', 'B', 'C', 'D'] as const).map((option) => {
                    const isSelected = quizState.answers[currentQuestion.id] === option;
                    return (
                      <button
                        key={option}
                        onClick={() => onSelectAnswer(currentQuestion.id, option)}
                        className={cn(
                          "w-full min-h-[60px] rounded-lg border-2 p-4 text-left transition-all",
                          "flex items-start gap-4 hover:border-primary/50 hover:bg-accent/50",
                          isSelected ? "border-primary bg-primary/10 ring-2 ring-primary/20" : "border-border bg-card"
                        )}
                      >
                        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold", isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                          {option}
                        </span>
                        <span className="flex-1 pt-1">
                          <LatexRenderer content={sanitize(currentQuestion.options[option])} />
                        </span>
                        {isSelected && <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Hint Display */}
            {showHint && currentHint && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="border-warning bg-warning/10">
                  <CardContent className="pt-4 flex items-start gap-3">
                    <Lightbulb className="h-5 w-5 shrink-0 text-warning" />
                    <div>
                      <p className="font-medium text-warning mb-1">Hint (-1 point)</p>
                      <p className="text-sm"><LatexRenderer content={sanitize(currentHint)} /></p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={handleRequestHint} disabled={hintUsedForCurrent || isLoadingHint} className="w-full">
                {isLoadingHint ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lightbulb className="mr-2 h-4 w-4" />}
                {hintUsedForCurrent ? 'Hint Used' : 'Need Hint?'}
              </Button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer (Static at bottom of flex container) */}
      <footer className="border-t bg-card/95 backdrop-blur px-3 py-3 shrink-0">
        <div className="mx-auto flex flex-wrap items-center justify-between gap-2">
          <Button variant="outline" size="sm" onClick={() => onGoToQuestion(quizState.currentIndex - 1)} disabled={quizState.currentIndex === 0} className="gap-1 flex-1 sm:flex-none">
            <ChevronLeft className="h-4 w-4" /> <span className="hidden sm:inline">Previous</span>
          </Button>

          <div className="flex gap-2">
            <Button variant={quizState.flaggedQuestions.has(currentQuestion.id) ? "default" : "outline"} size="icon" onClick={() => onToggleFlag(currentQuestion.id)}>
              <Flag className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={() => setShowPalette(!showPalette)} className="text-xs">
              {quizState.questions.length - Object.keys(quizState.answers).length} left
            </Button>
          </div>

          {quizState.currentIndex === quizState.questions.length - 1 ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" className="gap-1 flex-1 sm:flex-none" disabled={quizState.isSubmitting}>
                  {quizState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} <span className="hidden sm:inline">Submit</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Submit Quiz?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {unansweredCount > 0 ? `You have ${unansweredCount} unanswered questions. Check them?` : "Ready to submit?"}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Review</AlertDialogCancel>
                  <AlertDialogAction onClick={handleCompleteTraining}>Complete Training</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <Button variant="outline" size="sm" onClick={() => onGoToQuestion(quizState.currentIndex + 1)} className="gap-1 flex-1 sm:flex-none">
              <span className="hidden sm:inline">Next</span> <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
        {showPalette && (
          <div className="mt-4 rounded-lg border bg-card p-3 animate-slide-up">
            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
              {paletteData.map((q) => (
                <button
                  key={q.id}
                  onClick={() => { onGoToQuestion(q.index); setShowPalette(false); }}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-md text-sm font-medium transition-colors",
                    q.current && "ring-2 ring-primary",
                    q.answered && !q.flagged && "bg-primary text-primary-foreground",
                    q.flagged && "bg-warning text-warning-foreground",
                    !q.answered && !q.flagged && "bg-muted hover:bg-muted/80"
                  )}
                >
                  {q.index + 1}
                </button>
              ))}
            </div>
          </div>
        )}
      </footer>
    </div>
  );
}
