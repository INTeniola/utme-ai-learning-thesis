import { AITutorSplit } from '@/components/study/AITutorSplit';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/hooks/useAuth';
import type { QuizConfig } from '@/hooks/useQuiz';
import { useQuiz } from '@/hooks/useQuiz';
import { logger } from '@/lib/logger';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { QuizConfigPage } from './QuizConfigPage';
import { QuizInterface } from './QuizInterface';
import { QuizResults } from './QuizResults';

interface QuizControllerProps {
  onBack: () => void;
  initialSubject?: string | null;
  initialTopic?: string | null;
  onComplete?: (result: any) => void;
}

type QuizPhase = 'config' | 'quiz' | 'results' | 'error';

export function QuizController({ onBack, initialSubject, initialTopic, onComplete }: QuizControllerProps) {
  const [phase, setPhase] = useState<QuizPhase>('config');
  const [pendingStart, setPendingStart] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const lastConfigRef = useRef<QuizConfig | null>(null);
  const { user, loading: authLoading } = useAuth();
  const isMobile = useIsMobile();

  const {
    quizState,
    result,
    currentQuestion,
    unansweredCount,
    selectAnswer,
    toggleFlag,
    goToQuestion,
    requestHint,
    submitQuiz,
    resetQuiz,
    generateQuiz,
    isGenerating,
    fetchWeakTopics,
  } = useQuiz();

  // Transition to quiz when questions load successfully
  useEffect(() => {
    if (pendingStart && quizState.questions.length > 0 && phase === 'config') {
      logger.log('✅ Questions loaded, transitioning to quiz phase');
      setPhase('quiz');
      setPendingStart(false);
      setIsRetrying(false);
    }
  }, [pendingStart, quizState.questions.length, phase]);

  // Detect failure: pendingStart is true, generation finished, but still no questions
  useEffect(() => {
    if (pendingStart && !isGenerating && quizState.questions.length === 0 && phase === 'config') {
      // Small guard: only fire once generation has had a chance to start
      const timer = setTimeout(() => {
        if (pendingStart && !isGenerating && quizState.questions.length === 0) {
          logger.warn('⚠️ Quiz generation finished with 0 questions — showing error state');
          setPendingStart(false);
          setIsRetrying(false);
          setPhase('error');
        }
      }, 500); // 500ms debounce so we don't fire before generation even starts
      return () => clearTimeout(timer);
    }
  }, [pendingStart, isGenerating, quizState.questions.length, phase]);

  const handleStartQuiz = useCallback(() => {
    logger.log('handleStartQuiz called, setting pendingStart to true');
    setPendingStart(true);
  }, []);

  const handleConfigAndStart = useCallback((config: QuizConfig) => {
    lastConfigRef.current = config;
    handleStartQuiz();
  }, [handleStartQuiz]);

  const handleRetry = useCallback(async () => {
    if (!lastConfigRef.current) {
      setPhase('config');
      return;
    }
    setIsRetrying(true);
    resetQuiz();
    setPhase('config');
    const ok = await generateQuiz(lastConfigRef.current);
    if (ok) {
      setPendingStart(true);
    } else {
      setPhase('error');
      setIsRetrying(false);
    }
  }, [generateQuiz, resetQuiz]);

  const handleChooseDifferentTopic = useCallback(() => {
    resetQuiz();
    setPhase('config');
    setPendingStart(false);
    setIsRetrying(false);
  }, [resetQuiz]);

  const handleSubmit = useCallback(async () => {
    const quizResult = await submitQuiz();
    if (quizResult) {
      setPhase('results');
      if (onComplete) {
        onComplete({
          score: quizResult.score,
          weakTopics: quizResult.weakTopics
        });
      }
    }
    return quizResult;
  }, [submitQuiz, onComplete]);

  const handleNewQuiz = useCallback(() => {
    resetQuiz();
    setPhase('config');
    setPendingStart(false);
  }, [resetQuiz]);

  const handleReviewTopic = useCallback((topic: string) => {
    logger.log('Review topic:', topic);
    onBack();
  }, [onBack]);

  const subject = quizState.questions[0]?.subject || '';

  return (
    <AnimatePresence mode="wait">
      {phase === 'config' && (
        <motion.div
          key="config"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="w-full h-full"
        >
          <QuizConfigPage
            onStartQuiz={handleStartQuiz}
            onBack={onBack}
            initialSubject={initialSubject}
            initialTopic={initialTopic}
            generateQuiz={async (config) => {
              logger.log('🚀 Initiating quiz generation with config:', config);
              lastConfigRef.current = config;
              const success = await generateQuiz(config);
              logger.log(`🏁 Quiz generation outcome: ${success ? 'SUCCESS' : 'FAILURE'}`);
              return success;
            }}
            isGenerating={isGenerating || isRetrying}
            fetchWeakTopics={fetchWeakTopics}
            user={user}
            authLoading={authLoading}
          />
        </motion.div>
      )}

      {phase === 'quiz' && (
        <motion.div
          key="quiz"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          className="flex h-full w-full overflow-hidden"
        >
          {/* Quiz Area */}
          <div className="flex-1 w-full h-full">
            <QuizInterface
              quizState={quizState}
              currentQuestion={currentQuestion}
              unansweredCount={unansweredCount}
              onSelectAnswer={selectAnswer}
              onToggleFlag={toggleFlag}
              onGoToQuestion={goToQuestion}
              onRequestHint={requestHint}
              onSubmit={handleSubmit}
              onBack={onBack}
            />
          </div>

          {/* AI Tutor Split Panel - Removed per user feedback indicating it is redundant and cluttering */}
        </motion.div>
      )}

      {phase === 'results' && result && (
        <motion.div
          key="results"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full h-full"
        >
          <QuizResults
            result={result}
            questions={quizState.questions}
            subject={subject}
            onReviewTopic={handleReviewTopic}
            onNewQuiz={handleNewQuiz}
            onBack={onBack}
          />
        </motion.div>
      )}

      {phase === 'error' && (
        <motion.div
          key="error"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="w-full h-full flex items-center justify-center p-8"
        >
          <div className="max-w-sm w-full text-center space-y-6">
            <div className="flex justify-center">
              <div className="h-14 w-14 rounded-2xl bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 flex items-center justify-center">
                <AlertTriangle className="h-7 w-7 text-orange-500" />
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-semibold">Couldn't load questions</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Couldn't load questions for this topic right now. This might be because questions haven't been added for this topic yet, or there was a connection issue. Try a different topic or come back shortly.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Button
                onClick={handleRetry}
                disabled={isRetrying}
                className="w-full gap-2"
              >
                {isRetrying
                  ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> Retrying…</>
                  : <><RefreshCw className="h-4 w-4" /> Try Again</>
                }
              </Button>
              <Button
                variant="outline"
                onClick={handleChooseDifferentTopic}
                className="w-full gap-2"
              >
                <ArrowLeft className="h-4 w-4" /> Choose Different Topic
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

