import { supabase } from '@/integrations/supabase/client';
import { gemini } from '@/lib/gemini';
import { logger } from '@/lib/logger';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { queryCache } from '@/lib/queryCache';

// Questions without answers (fetched from secure view)
export interface ExamQuestion {
  id: string;
  subject: string;
  topic: string;
  subtopic: string | null;
  year: number;
  questionText: string;
  options: { A: string; B: string; C: string; D: string };
  difficulty: string;
}

// Full question with answers (only available after verification)
export interface VerifiedQuestion extends ExamQuestion {
  correctOption: 'A' | 'B' | 'C' | 'D';
  explanation: string | null;
}

export interface ExamSession {
  id: string;
  subjects: string[];
  totalQuestions: number;
  timeLimitMinutes: number;
  status: 'in_progress' | 'completed' | 'abandoned';
  startedAt: string;
  currentQuestionIndex: number;
  answers: Record<string, string>;
  timeSpentPerQuestion: Record<string, number>;
  questionsPerSubject: Record<string, number>;
}

export interface DiagnosticData {
  score: number;
  totalQuestions: number;
  percentage: number;
  subjectBreakdown: Record<string, {
    correct: number;
    total: number;
    percentage: number;
  }>;
  topicBreakdown: Record<string, {
    correct: number;
    total: number;
    percentage: number;
    avgTimeSeconds: number;
  }>;
  timeAnalysis: {
    totalTimeSeconds: number;
    avgTimePerQuestion: number;
    fastestQuestion: { index: number; time: number } | null;
    slowestQuestion: { index: number; time: number } | null;
    questionsOverThreshold: number[];
  };
  performanceInsights: string[];
  // Results from server verification
  verifiedResults?: Array<{
    questionId: string;
    userAnswer: string;
    correctOption: string;
    isCorrect: boolean;
    explanation: string | null;
  }>;
  // JAMB scaling — each subject scored to 100, total out of 400
  scaledScore: number;
  subjectScaledScores: Record<string, { rawScore: number; rawMax: number; scaledScore: number }>;
}

const AUTO_SAVE_INTERVAL = 30000; // 30 seconds
const LOCAL_STORAGE_KEY = 'cbt_exam_progress';

export function useCBTExam() {
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [session, setSession] = useState<ExamSession | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeSpent, setTimeSpent] = useState<Record<string, number>>({});
  const [remainingTime, setRemainingTime] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [diagnosticData, setDiagnosticData] = useState<DiagnosticData | null>(null);
  const [examTerminated, setExamTerminated] = useState(false);

  const questionStartTime = useRef<number>(Date.now());
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);
  const countdownTimer = useRef<NodeJS.Timeout | null>(null);
  // Stable ref so visibilitychange handler sees current session without re-binding
  const sessionRef = useRef<ExamSession | null>(null);

  // Load saved progress on mount
  useEffect(() => {
    const savedProgress = sessionStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedProgress) {
      try {
        const parsed = JSON.parse(savedProgress);
        // Check if session is still valid (not expired)
        const sessionAge = Date.now() - new Date(parsed.savedAt).getTime();
        const maxAge = parsed.timeLimitMinutes * 60 * 1000;
        if (sessionAge < maxAge) {
          setSession(parsed.session);
          setQuestions(parsed.questions);
          setCurrentIndex(parsed.currentIndex);
          setAnswers(parsed.answers);
          setTimeSpent(parsed.timeSpent);
          const elapsed = Math.floor(sessionAge / 1000);
          setRemainingTime(Math.max(0, parsed.timeLimitMinutes * 60 - elapsed));
          toast.info('Restored your previous exam progress');
        } else {
          sessionStorage.removeItem(LOCAL_STORAGE_KEY);
        }
      } catch (e) {
        sessionStorage.removeItem(LOCAL_STORAGE_KEY);
      }
    }
  }, []);

  // Keep sessionRef in sync
  useEffect(() => { sessionRef.current = session; }, [session]);

  // Anti-cheat: switching tabs/apps immediately terminates the exam
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && sessionRef.current?.status === 'in_progress') {
        if (countdownTimer.current) clearInterval(countdownTimer.current);
        if (autoSaveTimer.current) clearInterval(autoSaveTimer.current);
        sessionStorage.removeItem(LOCAL_STORAGE_KEY);
        setSession(null);
        setQuestions([]);
        setAnswers({});
        setTimeSpent({});
        setDiagnosticData(null);
        setExamTerminated(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Countdown timer
  useEffect(() => {
    if (session && session.status === 'in_progress' && remainingTime > 0) {
      countdownTimer.current = setInterval(() => {
        setRemainingTime((prev) => {
          if (prev <= 1) {
            // Time's up - auto-submit
            submitExam();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (countdownTimer.current) clearInterval(countdownTimer.current);
    };
  }, [session?.id, session?.status]);

  // Auto-save every 30 seconds
  useEffect(() => {
    if (session && session.status === 'in_progress') {
      autoSaveTimer.current = setInterval(() => {
        saveProgress();
      }, AUTO_SAVE_INTERVAL);
    }

    return () => {
      if (autoSaveTimer.current) clearInterval(autoSaveTimer.current);
    };
  }, [session?.id, session?.status, answers, timeSpent, currentIndex]);

  // Track time spent on current question
  useEffect(() => {
    questionStartTime.current = Date.now();

    return () => {
      if (questions[currentIndex]) {
        const elapsed = Math.floor((Date.now() - questionStartTime.current) / 1000);
        setTimeSpent((prev) => ({
          ...prev,
          [questions[currentIndex].id]: (prev[questions[currentIndex].id] || 0) + elapsed,
        }));
      }
    };
  }, [currentIndex, questions]);

  const saveProgress = useCallback(async () => {
    if (!session || !questions.length) return;

    // Save to sessionStorage
    const progress = {
      session,
      questions,
      currentIndex,
      answers,
      timeSpent,
      timeLimitMinutes: session.timeLimitMinutes,
      savedAt: new Date().toISOString(),
    };
    sessionStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(progress));

    // Save to Supabase
    try {
      const { error } = await supabase
        .from('exam_sessions')
        .update({
          current_question_index: currentIndex,
          answers: answers,
          time_spent_per_question: timeSpent,
        })
        .eq('id', session.id);

      if (error) throw error;
      logger.log('Progress auto-saved');
    } catch (err) {
      logger.error('Failed to save to Supabase:', err);
      // Local storage backup is still there
    }
  }, [session, questions, currentIndex, answers, timeSpent]);

  const startExam = useCallback(async (subjects: string[], timeLimitMinutes: number = 120, year?: number | 'random') => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Fetch questions for each subject
      const allQuestions: ExamQuestion[] = [];

      // Fetch questions from the SECURE VIEW (no answers exposed)
      for (const subject of subjects) {
        // JAMB: English = 60 questions, every other subject = 40
        const jambLimit = subject.toLowerCase() === 'english' ? 60 : 40;
        let query = supabase
          .from('past_questions_public' as any)
          .select('*')
          .eq('subject', subject);

        if (year && typeof year === 'number') {
          query = query.eq('year', year);
        }

        const { data, error } = await query.limit(jambLimit);

        if (error) throw error;

        // Map from secure view - NO correctOption or explanation
        const mapped = (data || []).map((q: any) => ({
          id: q.id,
          subject: q.subject,
          topic: q.topic,
          subtopic: q.subtopic,
          year: q.year,
          questionText: q.question_text,
          options: {
            A: q.option_a,
            B: q.option_b,
            C: q.option_c,
            D: q.option_d,
          },
          difficulty: q.difficulty,
        }));

        allQuestions.push(...mapped);
      }

      // Keep subjects grouped (JAMB format) — shuffle within each subject only
      const bySubject: Record<string, ExamQuestion[]> = {};
      subjects.forEach(s => { bySubject[s] = []; });
      allQuestions.forEach(q => (bySubject[q.subject] ??= []).push(q));
      subjects.forEach(s => bySubject[s].sort(() => Math.random() - 0.5));
      // English first, then others in selection order
      const shuffled = subjects.flatMap(s => bySubject[s] ?? []);
      const totalQuestions = shuffled.length;
      if (totalQuestions === 0) {
        throw new Error('No questions found for the selected subjects. Please try different subjects or contact support.');
      }
      
      const finalTimeLimit = timeLimitMinutes;
      const questionsPerSubjectMap = subjects.reduce<Record<string, number>>((acc, s) => {
        acc[s] = (bySubject[s] ?? []).length;
        return acc;
      }, {});

      // Create session in Supabase
      const { data: sessionData, error: sessionError } = await supabase
        .from('exam_sessions')
        .insert({
          user_id: user.id,
          subjects,
          total_questions: totalQuestions,
          time_limit_minutes: finalTimeLimit,
          question_order: shuffled.map((q) => q.id),
        })
        .select('id')
        .single();

      if (sessionError) throw sessionError;

      const newSession: ExamSession = {
        id: sessionData.id,
        subjects,
        totalQuestions,
        timeLimitMinutes: finalTimeLimit,
        status: 'in_progress',
        startedAt: new Date().toISOString(),
        currentQuestionIndex: 0,
        answers: {},
        timeSpentPerQuestion: {},
        questionsPerSubject: questionsPerSubjectMap,
      };

      setSession(newSession);
      setQuestions(shuffled);
      setCurrentIndex(0);
      setAnswers({});
      setTimeSpent({});
      setRemainingTime(finalTimeLimit * 60);
      setDiagnosticData(null);

      toast.success('Exam started! Good luck!');
    } catch (err) {
      logger.error('Failed to start exam:', err);
      toast.error('Failed to start exam');
    } finally {
      setLoading(false);
    }
  }, []);

  // Helpers for AI Exam
  const [isAIExam, setIsAIExam] = useState(false);
  const [aiFullQuestions, setAiFullQuestions] = useState<VerifiedQuestion[]>([]);

  const startAIExam = useCallback(async (subjects: string[], topicConstraint?: string) => {
    setLoading(true);
    try {
      const subjectList = subjects.join(", ");
      const prompt = `Generate a rigorous academic exam for these subjects: ${subjectList}.
      ${topicConstraint ? `Focus specifically on this topic/area: "${topicConstraint}".` : ''}
      
      Generate ${subjects.length * 5} questions (approx 5 per subject).
      For each question, provide:
      - Rigorous, standardized exam quality question text (use LaTeX for math).
      - 4 options (A, B, C, D).
      - The correct option.
      - A detailed explanation.
      - Difficulty level (Hard/Medium).
      
      Return ONLY a raw JSON array of objects with this structure:
      {
        "subject": "Phy",
        "topic": "Kinematics",
        "questionText": "...",
        "options": {"A":".", "B":".", "C":".", "D":"."},
        "correctOption": "A",
        "explanation": "...",
        "difficulty": "Hard"
      }
      `;

      const responseText = await gemini.generateContent(prompt);
      const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      const generatedData = JSON.parse(cleanJson);

      const mappedQuestions: VerifiedQuestion[] = generatedData.map((q: any, i: number) => ({
        id: `ai_${Date.now()}_${i}`,
        subject: q.subject,
        topic: q.topic || 'General',
        subtopic: null,
        year: 2026,
        questionText: q.questionText,
        options: q.options,
        difficulty: q.difficulty,
        correctOption: q.correctOption,
        explanation: q.explanation
      }));

      // Create a local session (mock ID)
      const mockSession: ExamSession = {
        id: `ai_session_${Date.now()}`,
        subjects,
        totalQuestions: mappedQuestions.length,
        timeLimitMinutes: Math.ceil(mappedQuestions.length * 1.5),
        status: 'in_progress',
        startedAt: new Date().toISOString(),
        currentQuestionIndex: 0,
        answers: {},
        timeSpentPerQuestion: {},
        questionsPerSubject: subjects.reduce<Record<string, number>>((acc, s) => {
          acc[s] = mappedQuestions.filter(q => q.subject === s).length;
          return acc;
        }, {}),
      };


      setIsAIExam(true);
      setAiFullQuestions(mappedQuestions);

      // For the visible state, we use the same object but TS is happy because Verified extends ExamQuestion
      setQuestions(mappedQuestions);
      setSession(mockSession);
      setAnswers({});
      setTimeSpent({});
      setRemainingTime(mockSession.timeLimitMinutes * 60);
      setDiagnosticData(null);

      toast.success('AI Exam Generated Successfully!');

    } catch (error) {
      logger.error("AI Exam Generation Error:", error);
      toast.error("Failed to generate exam. Gemini might be busy.");
    } finally {
      setLoading(false);
    }
  }, []);

  const selectAnswer = useCallback((questionId: string, option: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: option,
    }));
  }, []);

  const goToQuestion = useCallback((index: number) => {
    if (index >= 0 && index < questions.length) {
      // Save time for current question first
      if (questions[currentIndex]) {
        const elapsed = Math.floor((Date.now() - questionStartTime.current) / 1000);
        setTimeSpent((prev) => ({
          ...prev,
          [questions[currentIndex].id]: (prev[questions[currentIndex].id] || 0) + elapsed,
        }));
      }
      setCurrentIndex(index);
    }
  }, [questions, currentIndex]);

  const submitExam = useCallback(async () => {
    if (!session || !questions.length || isSubmitting) return;

    setIsSubmitting(true);

    if (countdownTimer.current) clearInterval(countdownTimer.current);
    if (autoSaveTimer.current) clearInterval(autoSaveTimer.current);

    const finalTimeSpent = { ...timeSpent };
    if (questions[currentIndex]) {
      const elapsed = Math.floor((Date.now() - questionStartTime.current) / 1000);
      finalTimeSpent[questions[currentIndex].id] = (finalTimeSpent[questions[currentIndex].id] || 0) + elapsed;
    }

    let results = [];
    let score = 0;

    if (isAIExam) {
      // Client-side Grading for AI Exam
      results = questions.map(q => {
        const fullQ = aiFullQuestions.find(aiQ => aiQ.id === q.id);
        const userAnswer = answers[q.id];
        const isCorrect = userAnswer === fullQ?.correctOption;
        if (isCorrect) score++;

        return {
          questionId: q.id,
          userAnswer: userAnswer || null,
          correctOption: fullQ?.correctOption || '',
          isCorrect,
          explanation: fullQ?.explanation || null
        };
      });
    } else {
      // Server-side grading for Standard Exam
      try {
        const { data, error } = await supabase.functions.invoke('verify-exam-answers', {
          body: { sessionId: session.id, answers },
        });
        if (error) throw error;
        results = data.results;
        score = data.score;
      } catch (err) {
        toast.error('Failed to verify answers.');
        setIsSubmitting(false);
        return;
      }
    }

    // Common Diagnostic Logic
    const subjectBreakdown: Record<string, any> = {};
    const topicBreakdown: Record<string, any> = {};

    results.forEach((result: any) => {
      const q = questions.find(q => q.id === result.questionId);
      if (!q) return;

      // Breakdown logic (simplified for brevity, identical to previous)
      if (!subjectBreakdown[q.subject]) subjectBreakdown[q.subject] = { correct: 0, total: 0 };
      subjectBreakdown[q.subject].total++;
      if (result.isCorrect) subjectBreakdown[q.subject].correct++;

      const topicKey = `${q.subject} - ${q.topic}`;
      if (!topicBreakdown[topicKey]) topicBreakdown[topicKey] = { correct: 0, total: 0, totalTime: 0 };
      topicBreakdown[topicKey].total++;
      if (result.isCorrect) topicBreakdown[topicKey].correct++;
      topicBreakdown[topicKey].totalTime += finalTimeSpent[q.id] || 0;
    });

    // Generate Diagnostic Data Object
    // JAMB scaling: English raw/60 × 100, others raw/40 × 100, sum → out of 400
    const subjectScaledScores: Record<string, { rawScore: number; rawMax: number; scaledScore: number }> = {};
    let scaledScore = 0;
    for (const subj of session.subjects) {
      const bd: { correct: number; total: number } = (subjectBreakdown as any)[subj] ?? { correct: 0, total: 0 };
      const rawMax = subj.toLowerCase() === 'english' ? 60 : 40;
      const scaled = Math.round((bd.correct / rawMax) * 100);
      scaledScore += scaled;
      subjectScaledScores[subj] = { rawScore: bd.correct, rawMax, scaledScore: scaled };
    }

    const percentage = Math.round((score / questions.length) * 100);
    const totalTimeSeconds = (Object.values(finalTimeSpent) as number[]).reduce((a, b) => a + b, 0);
    const avgTimePerQuestion = questions.length > 0 ? Math.round(totalTimeSeconds / questions.length) : 0;
    const timeEntries = Object.entries(finalTimeSpent) as [string, number][];
    const fastestEntry = timeEntries.length > 0 ? timeEntries.reduce((a, b) => a[1] < b[1] ? a : b) : null;
    const slowestEntry = timeEntries.length > 0 ? timeEntries.reduce((a, b) => a[1] > b[1] ? a : b) : null;
    const fastestIdx = fastestEntry ? questions.findIndex(q => q.id === fastestEntry[0]) : -1;
    const slowestIdx = slowestEntry ? questions.findIndex(q => q.id === slowestEntry[0]) : -1;

    const performanceInsights: string[] = [];
    if (scaledScore >= 300) performanceInsights.push('Excellent! You are well-prepared for JAMB.');
    else if (scaledScore >= 200) performanceInsights.push('Good effort — keep practicing to reach 300+.');
    else performanceInsights.push('Keep working hard — focus on your weak subjects.');

    const diagnostic: DiagnosticData = {
      score,
      totalQuestions: questions.length,
      percentage,
      scaledScore,
      subjectScaledScores,
      subjectBreakdown: Object.fromEntries(Object.entries(subjectBreakdown).map(([k, v]: any) => [k, { ...v, percentage: Math.round(v.correct / v.total * 100) }])),
      topicBreakdown: Object.fromEntries(Object.entries(topicBreakdown).map(([k, v]: any) => [k, {
        correct: v.correct, total: v.total,
        percentage: Math.round(v.correct / v.total * 100),
        avgTimeSeconds: Math.round(v.totalTime / v.total)
      }])),
      timeAnalysis: {
        totalTimeSeconds,
        avgTimePerQuestion,
        fastestQuestion: fastestIdx >= 0 ? { index: fastestIdx + 1, time: fastestEntry![1] } : null,
        slowestQuestion: slowestIdx >= 0 ? { index: slowestIdx + 1, time: slowestEntry![1] } : null,
        questionsOverThreshold: timeEntries.filter(([, t]) => t > 180).map(([id]) => questions.findIndex(q => q.id === id) + 1).filter(i => i > 0),
      },
      performanceInsights,
      verifiedResults: results
    };

    setSession(prev => prev ? { ...prev, status: 'completed' } : null);
    setDiagnosticData(diagnostic);

    // Phase 13: Performance Bounty
    if (diagnostic.scaledScore >= 300 && !isAIExam) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Add a negative usage log entry to "reward" credits
          await supabase.from('ai_usage_logs').insert({
            user_id: user.id,
            feature_type: 'performance_bounty',
            credits_cost: -20, // Negative cost = Reward
            tokens_estimated: 0
          });
          toast.success('🏆 BOUNTY CLAIMED! +20 AI Credits awarded for your 300+ score!');
        }
      } catch (e) {
        console.error('Failed to award bounty:', e);
      }
    }

    // Phase 14: Invalidate dashboard caches for live updates
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        queryCache.invalidate(`home:subjects:${user.id}`);
        queryCache.invalidate(`readiness:${user.id}`);
      }
    } catch (e) {
      console.error('Failed to invalidate caches:', e);
    }

    setIsSubmitting(false);
    toast.success('Exam submitted!');

  }, [session, questions, answers, timeSpent, currentIndex, isSubmitting, isAIExam, aiFullQuestions]);

  const abandonExam = useCallback(async () => {
    if (!session) return;
    if (countdownTimer.current) clearInterval(countdownTimer.current);
    if (!isAIExam) {
      // Only update backend if it's a real session
      try { await supabase.from('exam_sessions').update({ status: 'abandoned' }).eq('id', session.id); } catch (e) { }
    }
    setSession(null);
    setQuestions([]);
    setAnswers({});
    setTimeSpent({});
    setDiagnosticData(null);
    setIsAIExam(false);
  }, [session, isAIExam]);

  return {
    loading,
    session,
    questions,
    currentQuestion: questions[currentIndex] || null,
    currentIndex,
    answers,
    timeSpent,
    remainingTime,
    answeredCount: Object.keys(answers).length,
    isSubmitting,
    diagnosticData,
    examTerminated,
    resetExamTerminated: () => setExamTerminated(false),
    startExam,
    selectAnswer,
    goToQuestion,
    submitExam,
    abandonExam,
  };
}
