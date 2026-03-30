import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from './useAuth';

export interface QuizQuestion {
  id: string;
  questionText: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  subject: string;
  topic: string;
  difficulty: string;
  isAIGenerated: boolean;
  correctAnswer?: string; // Only available for AI-generated questions
  explanation?: string;
  passageText?: string;
}

export interface QuizConfig {
  subject: string;
  topic?: string;
  userId?: string;
  focusWeakTopics: boolean;
  questionCount: 10 | 20;
  difficultyMode: 'easy' | 'medium' | 'hard' | 'auto-adapt';
}

export interface QuizState {
  quizId: string | null;
  questions: QuizQuestion[];
  currentIndex: number;
  answers: Record<string, string>;
  flaggedQuestions: Set<string>;
  hintsUsed: Record<string, boolean>;
  timeRemaining: number;
  startTime: number | null;
  isSubmitting: boolean;
}

export interface QuizResult {
  score: number;
  totalQuestions: number;
  percentage: number;
  timeTaken: number;
  topicBreakdown: Record<string, { correct: number; total: number; percentage: number }>;
  hintsUsed: number;
  answers: Record<string, { selected: string; correct: string; isCorrect: boolean }>;
  weakTopics?: string[];
}

export interface WeakTopic {
  subject: string;
  topic: string;
  accuracy: number;
  attempts: number;
}

/**
 * Core function: useQuiz
 *  * 
 *  * **Side Effects:** Interacts with Supabase or external APIs.
 *  * @returns {any} The expected output
 */
export function useQuiz() {
  const { user, loading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [adaptedSet, setAdaptedSet] = useState<Set<string>>(new Set());
  const [quizState, setQuizState] = useState<QuizState>({
    quizId: null,
    questions: [],
    currentIndex: 0,
    answers: {},
    flaggedQuestions: new Set(),
    hintsUsed: {},
    timeRemaining: 0,
    startTime: null,
    isSubmitting: false,
  });
  const [result, setResult] = useState<QuizResult | null>(null);
  const [weakTopics, setWeakTopics] = useState<WeakTopic[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Save quiz state to sessionStorage
  useEffect(() => {
    if (quizState.quizId && quizState.questions.length > 0) {
      const stateToSave = {
        ...quizState,
        flaggedQuestions: Array.from(quizState.flaggedQuestions),
      };
      sessionStorage.setItem('quiz-state', JSON.stringify(stateToSave));
    }
  }, [quizState]);

  // Restore quiz state from sessionStorage on mount
  useEffect(() => {
    const savedState = sessionStorage.getItem('quiz-state');
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        // Only restore if quiz was in progress (not submitted)
        if (parsed.quizId && !parsed.isSubmitting && parsed.questions.length > 0) {
          setQuizState({
            ...parsed,
            flaggedQuestions: new Set(parsed.flaggedQuestions || []),
          });
        }
      } catch (error) {
        logger.error('Failed to restore quiz state:', error);
        sessionStorage.removeItem('quiz-state');
      }
    }
  }, []);

  // Fetch weak topics for the user
  const fetchWeakTopics = useCallback(async (subject?: string) => {
    if (!user) return [];

    try {
      let query = supabase
        .from('concept_mastery')
        .select('*')
        .eq('user_id', user.id)
        .lt('accuracy', 60)
        .gt('total_attempts', 0);

      if (subject) {
        query = query.eq('subject', subject);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('Error fetching weak topics:', error);
        return [];
      }

      const topics: WeakTopic[] = (data || []).map(item => ({
        subject: item.subject,
        topic: item.topic,
        accuracy: Number(item.accuracy),
        attempts: item.total_attempts,
      }));

      setWeakTopics(topics);
      return topics;
    } catch (error) {
      logger.error('Error in fetchWeakTopics:', error);
      return [];
    }
  }, [user]);

  // Generate a new quiz
  /**
     * Hook utility or function: generateQuiz
     *  * 
     *  * **Side Effects:** Interacts with Supabase or external APIs.
     *  * @returns The expected return value based on function logic
     */
    const generateQuiz = useCallback(async (config: QuizConfig) => {
    if (!user) {
      if (authLoading) return false;
      toast.error('Please sign in to generate a quiz');
      return false;
    }

    setIsGenerating(true);

    try {
      const { data, error } = await supabase.functions.invoke('generate-quiz', {
        body: {
          subject: config.subject,
          topic: config.topic,
          userId: user.id,
          focusWeakTopics: config.focusWeakTopics,
          questionCount: config.questionCount,
          difficultyMode: config.difficultyMode,
        },
      });

      if (error) {
        throw error;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      // Validate questions array
      if (!data.questions || !Array.isArray(data.questions) || data.questions.length === 0) {
        throw new Error('No questions were generated. Please try again.');
      }

      const timeLimit = config.questionCount * 2 * 60; // 2 minutes per question

      logger.log('Quiz data received:', {
        quizId: data.quizId,
        questionsLength: data.questions?.length,
        firstQuestion: data.questions?.[0],
        questionKeys: data.questions?.[0] ? Object.keys(data.questions[0]) : [],
        fullData: data
      });

      setQuizState({
        quizId: data.quizId,
        questions: data.questions || [],
        currentIndex: 0,
        answers: {},
        flaggedQuestions: new Set(),
        hintsUsed: {},
        timeRemaining: timeLimit,
        startTime: Date.now(),
        isSubmitting: false,
      });

      setResult(null);
      setAdaptedSet(new Set());
      toast.success(`Quiz generated with ${data.questions?.length || 0} questions!`);
      return true;
    } catch (error) {
      logger.error('Error generating quiz:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate quiz');
      return false;
    } finally {
      setIsGenerating(false);
    }
  }, [user]);

  // Timer effect
  useEffect(() => {
    if (quizState.startTime && quizState.timeRemaining > 0 && !result) {
      timerRef.current = setInterval(() => {
        setQuizState(prev => {
          if (prev.timeRemaining <= 1) {
            // Auto-submit when time runs out
            return { ...prev, timeRemaining: 0 };
          }
          return { ...prev, timeRemaining: prev.timeRemaining - 1 };
        });
      }, 1000);

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };
    }
  }, [quizState.startTime, result]);

  // Auto-submit when time runs out
  useEffect(() => {
    if (quizState.timeRemaining === 0 && quizState.startTime && !result && !quizState.isSubmitting) {
      toast.warning('Time is up! Submitting your quiz...');
      submitQuiz();
    }
  }, [quizState.timeRemaining, quizState.startTime, result, quizState.isSubmitting]);

  // Auto-Adaptive Logic trap
  useEffect(() => {
    if (!quizState.quizId || quizState.isSubmitting) return;

    // Evaluate answers to find the first newly-incorrect answer
    const newlyIncorrect = quizState.questions.find(q => {
      const selectedAns = quizState.answers[q.id];
      return selectedAns && q.correctAnswer && selectedAns !== q.correctAnswer && !adaptedSet.has(q.id);
    });

    if (newlyIncorrect) {
      // Mark as adapted immediately so we don't spam triggers
      setAdaptedSet(prev => new Set(prev).add(newlyIncorrect.id));

      // Async injection payload
      const triggerAdaptation = async () => {
        try {
          const existingIds = quizState.questions.map(q => q.id);

          const { data, error } = await supabase
            .from('past_questions')
            .select('*')
            .eq('subject', newlyIncorrect.subject)
            .eq('topic', newlyIncorrect.topic)
            .not('id', 'in', `(${existingIds.join(',')})`)
            .limit(1)
            .single();

          if (data && !error) {
            const cloneQuestion: QuizQuestion = {
              id: data.id,
              questionText: data.question_text,
              options: { A: data.option_a, B: data.option_b, C: data.option_c, D: data.option_d },
              subject: data.subject,
              topic: data.topic,
              difficulty: data.difficulty || 'medium',
              isAIGenerated: false,
              correctAnswer: data.correct_option,
              explanation: data.explanation,
              passageText: (data as any).passage_text || (data as any).linked_passage || (data.metadata as any)?.passage_text || (data.metadata as any)?.linked_passage
            };

            toast.info("Adaptive Logic Triggered: Added a follow-up question to test your mastery.", { duration: 4000 });

            setQuizState(prev => {
              // Insert right after the failed question
              const insertIdx = prev.questions.findIndex(q => q.id === newlyIncorrect.id) + 1;
              const newQuestions = [...prev.questions];
              newQuestions.splice(insertIdx, 0, cloneQuestion);
              return { ...prev, questions: newQuestions };
            });
          }
        } catch (e) {
          logger.error('Error fetching adaptive question:', e);
        }
      };

      triggerAdaptation();
    }
  }, [quizState.answers, quizState.quizId, quizState.isSubmitting, adaptedSet, quizState.questions]);

  // Select an answer
  /**
     * Action handler: selectAnswer
     *  * 
     *  * **Side Effects:** Interacts with Supabase or external APIs.
     *  * @returns The expected return value based on function logic
     */
    const selectAnswer = useCallback((questionId: string, answer: string) => {
    setQuizState(prev => ({
      ...prev,
      answers: { ...prev.answers, [questionId]: answer },
    }));
  }, []);

  // Toggle flag for review
  /**
     * Action handler: toggleFlag
     *  * 
     *  * **Side Effects:** Interacts with Supabase or external APIs.
     *  * @returns The expected return value based on function logic
     */
    const toggleFlag = useCallback((questionId: string) => {
    setQuizState(prev => {
      const newFlagged = new Set(prev.flaggedQuestions);
      if (newFlagged.has(questionId)) {
        newFlagged.delete(questionId);
      } else {
        newFlagged.add(questionId);
      }
      return { ...prev, flaggedQuestions: newFlagged };
    });
  }, []);

  // Navigate to question
  /**
     * Action handler: goToQuestion
     *  * 
     *  * **Side Effects:** Interacts with Supabase or external APIs.
     *  * @returns The expected return value based on function logic
     */
    const goToQuestion = useCallback((index: number) => {
    if (index >= 0 && index < quizState.questions.length) {
      setQuizState(prev => ({ ...prev, currentIndex: index }));
    }
  }, [quizState.questions.length]);

  // Request hint
  /**
     * Action handler: requestHint
     *  * 
     *  * **Side Effects:** Interacts with Supabase or external APIs.
     *  * @returns The expected return value based on function logic
     */
    const requestHint = useCallback(async (questionId: string): Promise<string | null> => {
    if (!user) return null;

    const question = quizState.questions.find(q => q.id === questionId);
    if (!question) return null;

    // Mark hint as used
    setQuizState(prev => ({
      ...prev,
      hintsUsed: { ...prev.hintsUsed, [questionId]: true },
    }));

    try {
      const { data, error } = await supabase.functions.invoke('ai-tutor', {
        body: {
          context: {
            subject: question.subject,
            topic: question.topic,
            currentQuestion: question.questionText,
            mode: 'hint',
          },
          studentMessage: 'I need a hint for this question without revealing the answer.',
        },
      });

      if (error) throw error;
      return data.response || 'Think about the key concepts related to this topic.';
    } catch (error) {
      logger.error('Error getting hint:', error);
      toast.error('Failed to get hint');
      return null;
    }
  }, [user, quizState.questions]);

  // Submit quiz
  /**
     * Hook utility or function: submitQuiz
     *  * 
     *  * **Side Effects:** Interacts with Supabase or external APIs.
     *  * @returns The expected return value based on function logic
     */
    const submitQuiz = useCallback(async () => {
    if (!user || !quizState.quizId) return null;

    setQuizState(prev => ({ ...prev, isSubmitting: true }));

    try {
      const timeTaken = quizState.startTime
        ? Math.floor((Date.now() - quizState.startTime) / 1000)
        : 0;

      const { data, error } = await supabase.functions.invoke('verify-quiz-answers', {
        body: {
          quizId: quizState.quizId,
          answers: quizState.answers,
          timeTaken,
          hintsUsed: Object.keys(quizState.hintsUsed).length,
        },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      const quizResult: QuizResult = {
        score: data.score,
        totalQuestions: data.totalQuestions,
        percentage: data.percentage,
        timeTaken: data.timeTaken,
        topicBreakdown: data.topicBreakdown,
        hintsUsed: data.hintsUsed,
        answers: data.answers,
      };

      setResult(quizResult);

      // Log seen questions for deduplication
      const seenRecords = quizState.questions.map(q => ({
        user_id: user.id,
        session_id: quizState.quizId!,
        message_type: 'quiz_question_seen',
        content: q.questionText,
        metadata: { questionId: q.id, topic: q.topic, subject: q.subject }
      }));

      await supabase.from('ai_interactions').insert(seenRecords);

      // Clear timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      return quizResult;
    } catch (error) {
      console.error('submitQuiz error details:', error);
      logger.error('Error submitting quiz:', error);
      toast.error(error instanceof Error ? `Failed to submit quiz: ${error.message}` : 'Failed to submit quiz');
      return null;
    } finally {
      setQuizState(prev => ({ ...prev, isSubmitting: false }));
    }
  }, [user, quizState]);

  // Reset quiz
  /**
     * Action handler: resetQuiz
     *  * 
     *  * **Side Effects:** Interacts with Supabase or external APIs.
     *  * @returns The expected return value based on function logic
     */
    const resetQuiz = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setQuizState({
      quizId: null,
      questions: [],
      currentIndex: 0,
      answers: {},
      flaggedQuestions: new Set(),
      hintsUsed: {},
      timeRemaining: 0,
      startTime: null,
      isSubmitting: false,
    });
    setResult(null);
    setAdaptedSet(new Set());
    // Clear saved quiz state
    sessionStorage.removeItem('quiz-state');
  }, []);

  // Get unanswered count
  const unansweredCount = quizState.questions.length - Object.keys(quizState.answers).length;

  // Get current question
  const currentQuestion = quizState.questions[quizState.currentIndex] || null;

  return {
    // State
    isLoading,
    isGenerating,
    quizState,
    result,
    weakTopics,
    currentQuestion,
    unansweredCount,

    // Actions
    fetchWeakTopics,
    generateQuiz,
    selectAnswer,
    toggleFlag,
    goToQuestion,
    requestHint,
    submitQuiz,
    resetQuiz,
  };
}
