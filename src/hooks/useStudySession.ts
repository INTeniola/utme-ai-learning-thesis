import { supabase } from '@/integrations/supabase/client';
import {
    AdaptiveAction,
    AdaptiveState,
    calculateNewMastery,
    calculateSessionPriority,
    createInitialAdaptiveState,
    MasteryData,
    processAdaptiveResponse,
    QuestionResult,
    SessionPriority,
} from '@/lib/adaptiveEngine';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './useAuth';

export interface Question {
  id: string;
  subject: string;
  topic: string;
  subtopic: string | null;
  difficulty: 'easy' | 'medium' | 'hard';
  questionText: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  hasLatex: boolean;
}

// Sample questions for demo (in production, these would come from knowledge_graph)
const sampleQuestions: Question[] = [
  {
    id: '1',
    subject: 'Mathematics',
    topic: 'Algebra',
    subtopic: 'Algebraic Fractions',
    difficulty: 'easy',
    questionText: 'Simplify: $\\frac{2x}{4}$',
    options: ['$\\frac{x}{2}$', '$\\frac{x}{4}$', '$2x$', '$\\frac{1}{2}$'],
    correctAnswer: '$\\frac{x}{2}$',
    explanation: 'Divide both numerator and denominator by 2: $\\frac{2x}{4} = \\frac{x}{2}$',
    hasLatex: true,
  },
  {
    id: '2',
    subject: 'Mathematics',
    topic: 'Algebra',
    subtopic: 'Algebraic Fractions',
    difficulty: 'medium',
    questionText: 'Simplify: $\\frac{x^2 - 4}{x + 2}$',
    options: ['$x - 2$', '$x + 2$', '$x^2 - 2$', '$\\frac{x-2}{x+2}$'],
    correctAnswer: '$x - 2$',
    explanation: 'Factor the numerator: $x^2 - 4 = (x+2)(x-2)$, then cancel $(x+2)$',
    hasLatex: true,
  },
  {
    id: '3',
    subject: 'Mathematics',
    topic: 'Algebra',
    subtopic: 'Algebraic Fractions',
    difficulty: 'hard',
    questionText: 'Simplify: $\\frac{x^2 - 5x + 6}{x^2 - 4x + 3}$',
    options: ['$\\frac{x-2}{x-1}$', '$\\frac{x-3}{x-1}$', '$\\frac{x-2}{x-3}$', '$1$'],
    correctAnswer: '$\\frac{x-2}{x-1}$',
    explanation: 'Factor: $\\frac{(x-2)(x-3)}{(x-1)(x-3)} = \\frac{x-2}{x-1}$',
    hasLatex: true,
  },
  {
    id: '4',
    subject: 'Physics',
    topic: 'Waves',
    subtopic: 'Refraction',
    difficulty: 'easy',
    questionText: 'When light travels from air into water, it:',
    options: ['Speeds up', 'Slows down', 'Stays the same speed', 'Stops completely'],
    correctAnswer: 'Slows down',
    explanation: 'Light slows down when entering a denser medium like water.',
    hasLatex: false,
  },
  {
    id: '5',
    subject: 'Physics',
    topic: 'Waves',
    subtopic: 'Refraction',
    difficulty: 'medium',
    questionText: 'The refractive index of glass is 1.5. If light enters glass from air at $30°$, find the angle of refraction using $n = \\frac{\\sin i}{\\sin r}$',
    options: ['$19.5°$', '$45°$', '$20°$', '$15°$'],
    correctAnswer: '$19.5°$',
    explanation: '$\\sin r = \\frac{\\sin 30°}{1.5} = \\frac{0.5}{1.5} = 0.333$, so $r ≈ 19.5°$',
    hasLatex: true,
  },
  {
    id: '6',
    subject: 'Chemistry',
    topic: 'Organic Chemistry',
    subtopic: 'Alkanes',
    difficulty: 'easy',
    questionText: 'What is the general formula for alkanes?',
    options: ['$C_nH_{2n+2}$', '$C_nH_{2n}$', '$C_nH_{2n-2}$', '$C_nH_n$'],
    correctAnswer: '$C_nH_{2n+2}$',
    explanation: 'Alkanes are saturated hydrocarbons with single bonds only.',
    hasLatex: true,
  },
];

export function useStudySession() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [masteryData, setMasteryData] = useState<MasteryData[]>([]);
  const [priorities, setPriorities] = useState<SessionPriority[]>([]);
  const [adaptiveState, setAdaptiveState] = useState<AdaptiveState | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [sessionId, setSessionId] = useState<string>('');
  const [lastAction, setLastAction] = useState<AdaptiveAction | null>(null);
  const [questionStartTime, setQuestionStartTime] = useState<number>(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [showExplanation, setShowExplanation] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);

  // Fetch user mastery data
  useEffect(() => {
    if (!user) return;

    const fetchMasteryData = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('user_mastery_ledger')
          .select('subject, topic, subtopic, mastery_score, error_patterns, attempts_count')
          .eq('user_id', user.id);

        if (error) throw error;

        const mastery: MasteryData[] = (data || []).map(d => ({
          subject: d.subject,
          topic: d.topic,
          subtopic: d.subtopic,
          mastery_score: d.mastery_score || 0,
          error_patterns: (d.error_patterns as string[]) || [],
          attempts_count: d.attempts_count || 0,
        }));

        setMasteryData(mastery);
        const calculatedPriorities = calculateSessionPriority(mastery);
        setPriorities(calculatedPriorities);
      } catch (error) {
        console.error('Error fetching mastery data:', error);
        // Use default priorities if no data
        setPriorities(calculateSessionPriority([]));
      } finally {
        setLoading(false);
      }
    };

    fetchMasteryData();
  }, [user]);

  // Start a new study session
  const startSession = useCallback((priority: SessionPriority) => {
    const newSessionId = crypto.randomUUID();
    setSessionId(newSessionId);
    
    const initialState = createInitialAdaptiveState(
      priority.topic,
      priority.subtopic,
      priority.recommended_difficulty
    );
    setAdaptiveState(initialState);
    setLastAction(null);
    
    // Get first question
    selectNextQuestion(initialState, priority.subject);
  }, []);

  // Select next question based on adaptive state
  const selectNextQuestion = useCallback((state: AdaptiveState, subject?: string) => {
    const eligibleQuestions = sampleQuestions.filter(q => {
      const matchesDifficulty = q.difficulty === state.currentDifficulty;
      const matchesTopic = q.topic === state.currentTopic || 
        (q.subtopic && q.subtopic === state.currentSubtopic);
      const matchesSubject = !subject || q.subject === subject;
      return matchesDifficulty && (matchesTopic || matchesSubject);
    });

    // Fallback: any question at the right difficulty
    const fallbackQuestions = sampleQuestions.filter(q => q.difficulty === state.currentDifficulty);
    
    const pool = eligibleQuestions.length > 0 ? eligibleQuestions : fallbackQuestions;
    const randomIndex = Math.floor(Math.random() * pool.length);
    
    setCurrentQuestion(pool[randomIndex] || sampleQuestions[0]);
    setQuestionStartTime(Date.now());
    setHintsUsed(0);
    setShowExplanation(false);
    setSelectedAnswer(null);
    setIsAnswered(false);
  }, []);

  // Submit answer
  const submitAnswer = useCallback(async (answer: string) => {
    if (!currentQuestion || !adaptiveState || !user || isAnswered) return;

    setSelectedAnswer(answer);
    setIsAnswered(true);

    const timeSpent = Math.round((Date.now() - questionStartTime) / 1000);
    const isCorrect = answer === currentQuestion.correctAnswer;

    const result: QuestionResult = {
      isCorrect,
      topic: currentQuestion.topic,
      subtopic: currentQuestion.subtopic,
      difficulty: currentQuestion.difficulty,
      timeSpent,
      hintsUsed,
    };

    // Process through adaptive engine
    const { newState, action } = processAdaptiveResponse(adaptiveState, result);
    setAdaptiveState(newState);
    setLastAction(action);

    // Log to database
    try {
      await supabase.from('exam_logs').insert({
        user_id: user.id,
        exam_session_id: sessionId,
        subject: currentQuestion.subject,
        question_index: newState.questionHistory.length,
        is_correct: isCorrect,
        selected_answer: answer,
        correct_answer: currentQuestion.correctAnswer,
        time_spent_seconds: timeSpent,
        hints_used: hintsUsed,
        interaction_data: {
          topic: currentQuestion.topic,
          subtopic: currentQuestion.subtopic,
          difficulty: currentQuestion.difficulty,
          adaptive_action: action.type,
        },
      });
    } catch (error) {
      console.error('Error logging exam:', error);
    }

    // Show explanation
    setShowExplanation(true);
  }, [currentQuestion, adaptiveState, user, sessionId, questionStartTime, hintsUsed, isAnswered]);

  // Move to next question
  const nextQuestion = useCallback(() => {
    if (!adaptiveState) return;
    selectNextQuestion(adaptiveState, currentQuestion?.subject);
  }, [adaptiveState, currentQuestion, selectNextQuestion]);

  // Use hint
  const useHint = useCallback(() => {
    setHintsUsed(prev => prev + 1);
  }, []);

  // End session and update mastery
  const endSession = useCallback(async () => {
    if (!adaptiveState || !user || adaptiveState.questionHistory.length === 0) return;

    // Calculate new mastery for the topic
    const currentMastery = masteryData.find(
      m => m.topic === adaptiveState.currentTopic
    )?.mastery_score || 0;

    const newMastery = calculateNewMastery(currentMastery, adaptiveState.questionHistory);

    try {
      // Upsert mastery data
      await supabase.from('user_mastery_ledger').upsert({
        user_id: user.id,
        subject: currentQuestion?.subject || 'Mathematics',
        topic: adaptiveState.currentTopic,
        subtopic: adaptiveState.currentSubtopic,
        mastery_score: newMastery,
        attempts_count: (masteryData.find(m => m.topic === adaptiveState.currentTopic)?.attempts_count || 0) + adaptiveState.questionHistory.length,
        last_practiced_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,subject,topic,subtopic',
      });
    } catch (error) {
      console.error('Error updating mastery:', error);
    }

    // Reset state
    setAdaptiveState(null);
    setCurrentQuestion(null);
    setSessionId('');
  }, [adaptiveState, user, masteryData, currentQuestion]);

  return {
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
  };
}
