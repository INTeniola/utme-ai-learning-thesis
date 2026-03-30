import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Question, useStudySession } from '@/hooks/useStudySession';
import { AdaptiveState, SessionPriority } from '@/lib/adaptiveEngine';
import { cn } from '@/lib/utils';
import {
    ArrowLeft,
    Bot,
    Brain,
    CheckCircle2,
    ChevronRight,
    Flame,
    HelpCircle,
    Lightbulb,
    Target,
    TrendingDown,
    TrendingUp,
    XCircle,
    Zap
} from 'lucide-react';
import { useState } from 'react';
import { AITutorPanel } from './AITutorPanel';
import { LatexRenderer } from './LatexRenderer';

interface StudyControllerProps {
  onBack: () => void;
}

export function StudyController({ onBack }: StudyControllerProps) {
  const [showTutor, setShowTutor] = useState(false);
  const [tutorContext, setTutorContext] = useState<{
    studentAnswer?: string;
    correctAnswer?: string;
  }>({});

  const {
    loading,
    priorities,
    adaptiveState,
    currentQuestion,
    lastAction,
    showExplanation,
    selectedAnswer,
    isAnswered,
    hintsUsed,
    startSession,
    submitAnswer,
    nextQuestion,
    useHint,
    endSession,
  } = useStudySession();

  // Open tutor with context when answer is wrong
  const handleAskTutor = () => {
    if (currentQuestion && selectedAnswer) {
      setTutorContext({
        studentAnswer: selectedAnswer,
        correctAnswer: currentQuestion.correctAnswer,
      });
    }
    setShowTutor(true);
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Analyzing your learning profile...</p>
        </div>
      </div>
    );
  }

  // Show priority selection if no active session
  if (!adaptiveState || !currentQuestion) {
    return (
      <PrioritySelector
        priorities={priorities}
        onSelect={startSession}
        onBack={onBack}
      />
    );
  }

  return (
    <>
      <QuestionView
        question={currentQuestion}
        adaptiveState={adaptiveState}
        lastAction={lastAction}
        showExplanation={showExplanation}
        selectedAnswer={selectedAnswer}
        isAnswered={isAnswered}
        hintsUsed={hintsUsed}
        onSubmit={submitAnswer}
        onNext={nextQuestion}
        onHint={useHint}
        onEnd={endSession}
        onBack={onBack}
        onAskTutor={handleAskTutor}
      />
      
      {/* AI Tutor Panel */}
      <AITutorPanel
        subject={currentQuestion.subject}
        topic={currentQuestion.topic}
        subtopic={currentQuestion.subtopic || undefined}
        currentQuestion={currentQuestion.questionText}
        studentAnswer={tutorContext.studentAnswer}
        correctAnswer={tutorContext.correctAnswer}
        masteryScore={adaptiveState.questionHistory.filter(q => q.isCorrect).length / Math.max(1, adaptiveState.questionHistory.length) * 100}
        consecutiveErrors={adaptiveState.consecutiveMisses}
        isOpen={showTutor}
        onClose={() => setShowTutor(false)}
      />
    </>
  );
}

// Priority Selection Screen
function PrioritySelector({
  priorities,
  onSelect,
  onBack,
}: {
  priorities: SessionPriority[];
  onSelect: (priority: SessionPriority) => void;
  onBack: () => void;
}) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <button
        onClick={onBack}
        className="mb-6 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </button>

      <div className="mb-8">
        <h1 className="text-xl font-bold sm:text-2xl">Smart Study Session</h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          Your personalized priorities based on mastery analysis
        </p>
      </div>

      <div className="mb-6 rounded-lg border bg-primary/5 p-4">
        <div className="flex items-start gap-3">
          <Brain className="mt-0.5 h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-medium">Adaptive Learning Active</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Questions will adjust based on your performance. Miss 2 in a row? 
              We&apos;ll ease the difficulty or provide guided hints.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {priorities.map((priority, index) => (
          <Card
            key={`${priority.subject}-${priority.topic}`}
            className={cn(
              'cursor-pointer transition-all hover:border-primary hover:shadow-md',
              index === 0 && 'border-primary bg-primary/5'
            )}
            onClick={() => onSelect(priority)}
          >
            <CardContent className="flex items-center gap-4 p-4 sm:p-6">
              <div
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-full sm:h-12 sm:w-12',
                  index === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted'
                )}
              >
                {index === 0 ? (
                  <Flame className="h-5 w-5 sm:h-6 sm:w-6" />
                ) : (
                  <Target className="h-5 w-5 sm:h-6 sm:w-6" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate font-semibold">{priority.topic}</h3>
                  {index === 0 && (
                    <Badge variant="default" className="shrink-0">
                      Top Priority
                    </Badge>
                  )}
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {priority.subject}
                  {priority.subtopic && ` • ${priority.subtopic}`}
                </p>
                <div className="mt-2 flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Progress value={priority.mastery_score} className="h-1.5 w-16 sm:w-24" />
                    <span className="text-xs text-muted-foreground">{priority.mastery_score}%</span>
                  </div>
                  <Badge
                    variant="secondary"
                    className={cn(
                      'text-xs',
                      priority.recommended_difficulty === 'easy' && 'bg-green-100 text-green-700',
                      priority.recommended_difficulty === 'medium' && 'bg-yellow-100 text-yellow-700',
                      priority.recommended_difficulty === 'hard' && 'bg-red-100 text-red-700'
                    )}
                  >
                    {priority.recommended_difficulty}
                  </Badge>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// Question View
function QuestionView({
  question,
  adaptiveState,
  lastAction,
  showExplanation,
  selectedAnswer,
  isAnswered,
  hintsUsed,
  onSubmit,
  onNext,
  onHint,
  onEnd,
  onBack,
  onAskTutor,
}: {
  question: Question;
  adaptiveState: AdaptiveState;
  lastAction: any;
  showExplanation: boolean;
  selectedAnswer: string | null;
  isAnswered: boolean;
  hintsUsed: number;
  onSubmit: (answer: string) => void;
  onNext: () => void;
  onHint: () => void;
  onEnd: () => void;
  onBack: () => void;
  onAskTutor: () => void;
}) {
  const questionsAnswered = adaptiveState.questionHistory.length;
  const correctAnswers = adaptiveState.questionHistory.filter(q => q.isCorrect).length;
  const isCorrect = selectedAnswer === question.correctAnswer;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={() => {
            if (questionsAnswered > 0) {
              onEnd();
            }
            onBack();
          }}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">End Session</span>
        </button>

        <div className="flex items-center gap-3 sm:gap-4">
          <Badge
            variant="outline"
            className={cn(
              adaptiveState.currentDifficulty === 'easy' && 'border-green-300 text-green-700',
              adaptiveState.currentDifficulty === 'medium' && 'border-yellow-300 text-yellow-700',
              adaptiveState.currentDifficulty === 'hard' && 'border-red-300 text-red-700'
            )}
          >
            {adaptiveState.currentDifficulty}
          </Badge>
          <div className="flex items-center gap-1.5 text-sm">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span className="font-medium">{correctAnswers}/{questionsAnswered}</span>
          </div>
        </div>
      </div>

      {/* Adaptive Action Alert */}
      {lastAction && lastAction.type !== 'continue' && (
        <div
          className={cn(
            'mb-4 rounded-lg p-3 sm:p-4',
            lastAction.type === 'socratic_intervention' && 'bg-primary/10 border border-blue-200',
            lastAction.type === 'difficulty_downgrade' && 'bg-yellow-50 border border-yellow-200',
            lastAction.type === 'difficulty_upgrade' && 'bg-green-50 border border-green-200'
          )}
        >
          <div className="flex items-start gap-3">
            {lastAction.type === 'socratic_intervention' && (
              <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            )}
            {lastAction.type === 'difficulty_downgrade' && (
              <TrendingDown className="mt-0.5 h-5 w-5 shrink-0 text-yellow-600" />
            )}
            {lastAction.type === 'difficulty_upgrade' && (
              <TrendingUp className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
            )}
            <div>
              <p className="text-sm font-medium">
                {lastAction.type === 'socratic_intervention' && 'Socratic Intervention'}
                {lastAction.type === 'difficulty_downgrade' && 'Difficulty Adjusted'}
                {lastAction.type === 'difficulty_upgrade' && 'Level Up!'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                {lastAction.type === 'socratic_intervention' ? (
                  <LatexRenderer content={lastAction.message} />
                ) : (
                  lastAction.message
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Question Card */}
      <Card className="mb-4">
        <CardHeader className="pb-3 sm:pb-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground sm:text-sm">
            <span>{question.subject}</span>
            <span>•</span>
            <span>{question.topic}</span>
            {question.subtopic && (
              <>
                <span>•</span>
                <span className="hidden sm:inline">{question.subtopic}</span>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-6 text-base leading-relaxed sm:text-lg">
            <LatexRenderer content={question.questionText} />
          </div>

          {/* Options */}
          <div className="space-y-3">
            {question.options.map((option, index) => {
              const isSelected = selectedAnswer === option;
              const isCorrectOption = option === question.correctAnswer;
              const showResult = isAnswered;

              return (
                <button
                  key={index}
                  onClick={() => !isAnswered && onSubmit(option)}
                  disabled={isAnswered}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all sm:p-4',
                    !isAnswered && 'hover:border-primary hover:bg-primary/5',
                    showResult && isCorrectOption && 'border-green-500 bg-green-50',
                    showResult && isSelected && !isCorrectOption && 'border-red-500 bg-red-50',
                    isAnswered && !isSelected && !isCorrectOption && 'opacity-50'
                  )}
                >
                  <div
                    className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm font-medium sm:h-8 sm:w-8',
                      showResult && isCorrectOption && 'border-green-500 bg-green-500 text-white',
                      showResult && isSelected && !isCorrectOption && 'border-red-500 bg-red-500 text-white'
                    )}
                  >
                    {showResult && isCorrectOption ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : showResult && isSelected && !isCorrectOption ? (
                      <XCircle className="h-4 w-4" />
                    ) : (
                      String.fromCharCode(65 + index)
                    )}
                  </div>
                  <span className="min-w-0 flex-1 break-words text-sm sm:text-base">
                    <LatexRenderer content={option} />
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Explanation */}
      {showExplanation && (
        <Card className="mb-4 border-primary/20 bg-primary/5">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-start gap-3">
              {isCorrect ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
              ) : (
                <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              )}
              <div>
                <p className="font-medium">
                  {isCorrect ? 'Correct!' : 'Not quite right'}
                </p>
                <div className="mt-2 text-sm text-muted-foreground">
                  <LatexRenderer content={question.explanation} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-2">
          {!isAnswered ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onHint}
              disabled={hintsUsed >= 2}
              className="gap-2"
            >
              <HelpCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Hint ({2 - hintsUsed} left)</span>
              <span className="sm:hidden">{2 - hintsUsed}</span>
            </Button>
          ) : null}
          
          {/* AI Tutor Button - always visible */}
          <Button
            variant="outline"
            size="sm"
            onClick={onAskTutor}
            className="gap-2"
          >
            <Bot className="h-4 w-4" />
            <span className="hidden sm:inline">Ask AI Tutor</span>
          </Button>
        </div>

        {isAnswered && (
          <Button onClick={onNext} className="gap-2">
            Next Question
            <Zap className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Hint Display */}
      {hintsUsed > 0 && !isAnswered && (
        <div className="mt-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3 sm:p-4">
          <div className="flex items-start gap-3">
            <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-yellow-600" />
            <p className="text-sm text-yellow-800">
              {hintsUsed === 1 && "Think about how the expression can be factored."}
              {hintsUsed === 2 && "Look for common factors in numerator and denominator that can cancel."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
