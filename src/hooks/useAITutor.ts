import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { aiGateway } from '@/lib/aiGateway';
import { logger } from '@/lib/logger';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { queryCache } from '@/lib/queryCache';


export type StudentStage = 'new_user' | 'early_learner' | 'active_learner';

export interface StudentStyle {
  tone: 'unknown' | 'terse' | 'conversational' | 'detailed';
  avgLength: number;
  usesSlang: boolean;
  usesEmoji: boolean;
}

export interface LearningPatterns {
  strongModalities: string[];       // e.g. ['theory', 'definition']
  weakModalities: string[];         // e.g. ['calculation', 'application']
  averageSessionLength: number;     // minutes
  preferredTopicDepth: 'brief' | 'detailed';
  responseStyle: 'formal' | 'casual';
  lastPatternUpdate: string;        // ISO date string
}

export interface TutorContext {
  subject: string;
  topic: string;
  subtopic?: string;
  currentQuestion?: string;
  studentAnswer?: string;
  correctAnswer?: string;
  masteryScore?: number;
  consecutiveErrors?: number;

  // New Pedagogical Redesign fields
  firstName: string;
  weakTopics: { topic: string; accuracy: number }[];
  strongTopics: string[];
  recentQuizResults: { date: string; score: number; weakAreas?: string[] }[];
  lastStudiedDaysAgo: number | null;
  topicsNeverAttempted: string[];
  currentSyllabusObjectives: string[];
  sessionStartTime: number;
  studentStage: StudentStage;
  lastToolResult: { toolType: string; score: number; weakAreas?: string[] } | null;
  selectedSubjects: string[];
  examDate: string | null;
  daysToExam: number | null;
  studentStyle: StudentStyle;
  examType: string;
  examFullName: string;
  knowledgeChunks: Array<{ content_chunk: string, metadata: any }>;
  userUploads: Array<{ raw_text: string, file_name: string }>;

  // Part 1 — Extended context fields
  teachingQuestions: Array<{ question_text: string; topic: string; year: number; difficulty: string }>;
  studentRank: number | null;
  leaderboardContext: Array<{ display_alias: string; score: number }>;
  learningPatterns: LearningPatterns | null;
  lastSession: { subject: string; topic: string; duration_minutes: number; created_at: string } | null;
  currentStreak?: number;
}


export interface Interaction {
  id?: string;
  role: 'student' | 'tutor';
  content: string;
  timestamp: Date;
  metadata?: any;
}

export interface Conversation {
  id: string;
  subject: string;
  topic?: string;
  title: string;
  message_count: number;
  updated_at: string;
}

/**
 * Core function: analyseStudentStyle
 *  * 
 *  * **Side Effects:** Interacts with Supabase or external APIs.
 *  * @param recentMessages - The recentMessages parameter
 *  * @returns {StudentStyle} The expected output
 */
function analyseStudentStyle(recentMessages: Array<{ role: string, content: string }>): StudentStyle {
  const studentMessages = recentMessages
    .filter(m => m.role === 'student' || m.role === 'user')
    .slice(-5)
    .map(m => m.content);

  if (studentMessages.length === 0) {
    return { tone: 'unknown', avgLength: 0, usesSlang: false, usesEmoji: false };
  }

  const avgLength = studentMessages.reduce((sum, m) => sum + m.length, 0) / studentMessages.length;

  const slangTerms = ['pls', 'lol', 'tbh', 'ngl', 'idk', 'imo', 'rn', 'bc', 'cuz', 'gonna', 'wanna', 'lemme', 'kinda', 'sorta', 'sha', 'abi', 'na', 'abeg', 'wetin'];
  const usesSlang = slangTerms.some(term =>
    studentMessages.some(m => m.toLowerCase().includes(term))
  );

  const usesEmoji = studentMessages.some(m => /\p{Emoji}/u.test(m));

  const tone = avgLength < 20 ? 'terse' : avgLength < 80 ? 'conversational' : 'detailed';

  return { tone, avgLength, usesSlang, usesEmoji };
}

const defaultStudentStyle: StudentStyle = { tone: 'unknown', avgLength: 0, usesSlang: false, usesEmoji: false };

const contextCache = new Map<string, { context: TutorContext; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes cache for AI Context

function cleanAIText(text: string): string {
  const jsonBlockRegex = /```(?:json)?\s*(\{[\s\S]*?\})\s*```|(\{\s*"action"\s*:[\s\S]*?\})/gi;
  // Also remove visual focus tags [[focus:NodeID]]
  const visualFocusRegex = /\[\[focus:[\s\S]*?\]\]/gi;
  
  let cleaned = text.replace(jsonBlockRegex, '').replace(visualFocusRegex, '').trim();
  // Also strip out incomplete JSON at the very end of the stream if it looks like an action
  cleaned = cleaned.replace(/\{\s*"action"\s*:[^}]*$/, '').trim();
  return cleaned;
}

/**
 * Part 2 — Pattern Analyser
 * Runs on session end (component unmount). Analyses the conversation and writes
 * inferred LearningPatterns back to profiles.academic_goals.
 * @param interactions — full interaction list from the session
 * @param userId — authenticated user ID
 * @param existingPatterns — previously stored patterns to merge with
 */
async function analyseAndUpdatePatterns(
  interactions: Array<{ role: string; content: string }>,
  userId: string,
  existingPatterns: LearningPatterns | null
): Promise<void> {
  const studentMessages = interactions.filter(m => m.role === 'student');
  if (studentMessages.length < 3) return; // not enough data

  const avgLength = studentMessages.reduce((sum, m) => sum + m.content.length, 0)
    / studentMessages.length;

  // Detect response style
  const slangTerms = ['pls', 'lol', 'idk', 'ngl', 'tbh', 'rn', 'bc', 'sha', 'abi', 'abeg', 'na'];
  const usesSlang = studentMessages.some(m =>
    slangTerms.some(t => m.content.toLowerCase().includes(t))
  );

  // Detect preferred depth
  const asksForMore = studentMessages.some(m =>
    m.content.toLowerCase().includes('explain more') ||
    m.content.toLowerCase().includes('elaborate') ||
    m.content.toLowerCase().includes('go deeper')
  );
  const asksForBrief = studentMessages.some(m =>
    m.content.toLowerCase().includes('just tell me') ||
    m.content.toLowerCase().includes('short answer') ||
    m.content.toLowerCase().includes('summary')
  );

  const updatedPatterns: LearningPatterns = {
    strongModalities: existingPatterns?.strongModalities || [],
    weakModalities: existingPatterns?.weakModalities || [],
    averageSessionLength: avgLength > 0
      ? Math.round((existingPatterns?.averageSessionLength || 0) * 0.8 + (avgLength / 100) * 0.2)
      : existingPatterns?.averageSessionLength || 0,
    preferredTopicDepth: asksForMore ? 'detailed' : asksForBrief ? 'brief'
      : existingPatterns?.preferredTopicDepth || 'detailed',
    responseStyle: usesSlang ? 'casual' : 'formal',
    lastPatternUpdate: new Date().toISOString()
  };

  try {
    // Update without overwriting other academic_goals fields
    const { data: current } = await supabase
      .from('profiles')
      .select('academic_goals')
      .eq('id', userId)
      .single();

    await supabase
      .from('profiles')
      .update({
        // Cast required: Supabase Json type is narrower than our interface
        academic_goals: {
          ...(current?.academic_goals as object || {}),
          learningPatterns: updatedPatterns as unknown as Record<string, unknown>
        } as any
      })
      .eq('id', userId);
  } catch (err) {
    // Non-fatal — pattern update is best-effort
    console.warn('[analyseAndUpdatePatterns] Failed to write patterns:', err);
  }
}

/**
 * Core function: useAITutor
 *  * 
 *  * **Side Effects:** Interacts with Supabase or external APIs.
 *  * @returns {any} The expected output
 */
export function useAITutor() {
  const [loading, setLoading] = useState(false);
  const [lastFeedback, setLastFeedback] = useState<'positive' | 'negative' | null>(null);
  const { user } = useAuth();
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [context, setContext] = useState<TutorContext | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [orchestratorAction, setOrchestratorAction] = useState<{ action: string, topic?: string } | null>(null);
  const [visualSignal, setVisualSignal] = useState<string | null>(null);
  const [quotaInfo, setQuotaInfo] = useState<{ used: number; limit: number; remaining: number } | null>(null);
  const [cachedStage, setCachedStage] = useState<StudentStage | null>(null);
  const [isAwaitingFirstToken, setIsAwaitingFirstToken] = useState(false);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const lastFailedMessage = useRef<string | null>(null);
  const interactionsRef = useRef<Interaction[]>(interactions);
  const contextRef = useRef<TutorContext | null>(context);

  // Keep refs in sync so the cleanup effect can read the latest values without
  // needing them as dependencies (avoids re-registering on every message)
  useEffect(() => { interactionsRef.current = interactions; }, [interactions]);
  useEffect(() => { contextRef.current = context; }, [context]);

  // Part 2 — Pattern analyser: runs on unmount after a meaningful session
  useEffect(() => {
    return () => {
      const msgs = interactionsRef.current;
      const ctx = contextRef.current;
      const uid = userId;
      if (msgs.length >= 3 && uid) {
        analyseAndUpdatePatterns(msgs, uid, ctx?.learningPatterns || null);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetTutor = useCallback(() => {
    setActiveConversationId(null);
    setInteractions([]);
    setContext(null);
    setCachedStage(null);
  }, []);

  // Get current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id ?? null);
    });
  }, []);

  const loadConversations = useCallback(async (subject: string) => {
    // Resolve userId from state or directly from auth (fixes race on mount)
    let uid = userId;
    if (!uid) {
      const { data } = await supabase.auth.getUser();
      uid = data.user?.id ?? null;
      if (uid) setUserId(uid);
    }
    if (!uid) return;
    setIsHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('id, title, subject, updated_at, message_count')
        .eq('user_id', uid)
        .eq('subject', subject)
        .order('updated_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setConversations(data.map(d => ({
        id: d.id,
        subject: d.subject,
        title: d.title || 'New Conversation',
        message_count: d.message_count || 0,
        updated_at: d.updated_at || new Date().toISOString()
      })));
    } catch (err) {
      logger.error('Failed to load conversations:', err);
    } finally {
      setIsHistoryLoading(false);
    }
  }, [userId]);

  const loadConversation = useCallback(async (conversationId: string) => {
    setActiveConversationId(conversationId);
    try {
      const { data, error } = await supabase
        .from('ai_interactions')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        setInteractions(data.map(item => ({
          id: item.id, // Ensure id is present
          role: (item.message_type === 'user' || item.message_type === 'student') ? 'student' : 'tutor',
          content: item.content,
          timestamp: item.created_at ? new Date(item.created_at) : new Date(),
          metadata: item.metadata || {} // Ensure metadata is present
        })));

        // Recover context from the first message if possible
        const ctx = data[0].context as unknown as TutorContext;
        if (ctx && ctx.subject) {
          // Ensure we don't assign a partial to a required full type
          setContext(prev => ({
            ...prev,
            ...ctx,
            weakTopics: ctx.weakTopics || [],
            strongTopics: ctx.strongTopics || [],
            recentQuizResults: ctx.recentQuizResults || [],
            lastStudiedDaysAgo: ctx.lastStudiedDaysAgo ?? null,
            topicsNeverAttempted: ctx.topicsNeverAttempted || [],
            currentSyllabusObjectives: ctx.currentSyllabusObjectives || [],
            sessionStartTime: ctx.sessionStartTime || Date.now(),
            studentStage: ctx.studentStage || 'early_learner',
            selectedSubjects: ctx.selectedSubjects || [],
            examDate: ctx.examDate || null,
            daysToExam: ctx.daysToExam ?? null,
            studentStyle: ctx.studentStyle || defaultStudentStyle,
            knowledgeChunks: ctx.knowledgeChunks || [],
            userUploads: ctx.userUploads || [],
            teachingQuestions: ctx.teachingQuestions || [],
            studentRank: ctx.studentRank ?? null,
            leaderboardContext: ctx.leaderboardContext || [],
            learningPatterns: ctx.learningPatterns ?? null,
            lastSession: ctx.lastSession ?? null
          }));
        }
      } else {
        setInteractions([]);
        // Initialize with default style if new
        setContext(prev => prev ? { ...prev, studentStyle: defaultStudentStyle } : null);
      }
    } catch (err) {
      logger.error('Failed to load interaction history:', err);
      setInteractions([]);
    }
  }, [userId]);


  const classifyStudentStage = (
    masteryRows: any[],
    examSessions: any[],
    studySessions: any[]
  ): StudentStage => {
    // If we have ANY global history, they aren't a "new user" in the scary sense
    if (masteryRows.length === 0 && examSessions.length === 0 && studySessions.length === 0) {
      return 'new_user';
    }

    // Count unique topics attempted in this subject
    const attemptedInSubject = masteryRows.length;
    if (attemptedInSubject < 1) {
      return 'early_learner';
    }

    return 'active_learner';
  };

  /**
     * Hook utility or function: buildRichStudentContext
     *  * 
     *  * **Side Effects:** Interacts with Supabase or external APIs.
     *  * @returns The expected return value based on function logic
     */
    const buildRichStudentContext = useCallback(async (subject: string, topic: string) => {
    if (!userId) {
      // Fallback if userId not yet loaded
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
    }

    const uid = userId || (await supabase.auth.getUser()).data.user?.id;
    if (!uid) return;

    const cacheKey = `${uid}_${subject}_${topic}`;
    const cached = contextCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
      setContext(cached.context);
      return;
    }

    try {
      const [
        masteryRes,
        examRes,
        studyRes,
        syllabusRes,
        profileRes,
        userUploadsRes,
        teachingQuestionsRes,
        lastSessionRes,
        leaderboardRes
      ] = await Promise.all([
        supabase.from('concept_mastery').select('topic, accuracy').eq('user_id', uid).eq('subject', subject),
        supabase.from('exam_sessions').select('score, total_questions, created_at, diagnostic_data').eq('user_id', uid).eq('status', 'completed').contains('subjects', [subject]).order('created_at', { ascending: false }).limit(3),
        supabase.from('study_sessions').select('created_at').eq('user_id', uid).eq('subject', subject).order('created_at', { ascending: false }).limit(1),
        supabase.from('jamb_syllabus').select('topic, objectives, subtopics').eq('subject', subject),
        supabase.from('profiles').select('full_name, subjects_meta, utme_exam_date, academic_goals, current_streak').eq('id', uid).single(),
        // Query — User uploaded documents
        supabase
          .from('uploaded_content')
          .select('raw_text, file_name, detected_subject, file_type, file_url')
          .eq('user_id', uid)
          .ilike('detected_subject', `%${subject}%`)
          .limit(2),
        // Query A — Teaching questions (question text ONLY).
        // SECURITY: correct_option and explanation are intentionally excluded from this query.
        // Answers are managed exclusively by the generate-quiz edge function.
        supabase
          .from('past_questions')
          .select('question_text, topic, subject, year, difficulty')
          .eq('subject', subject)
          .eq('topic', topic)
          .order('year', { ascending: false })
          .limit(5),
        // Query D — Last study session for context
        supabase
          .from('study_sessions')
          .select('subject, duration_minutes, started_at')
          .eq('user_id', uid)
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        // Query B — Top 3 on leaderboard for context (display_alias only)
        // TODO QUIZ-RANK-001: Replace with get_student_rank RPC when available.
        // Currently approximated from exam_sessions data.
        supabase
          .from('exam_sessions')
          .select('score, total_questions, user_id')
          .eq('status', 'completed')
          .contains('subjects', [subject])
          .order('score', { ascending: false })
          .limit(10)
      ]);

      const masteryData = masteryRes.data || [];
      const examData = examRes.data || [];
      const studyData = studyRes.data || [];
      const syllabusData = syllabusRes.data || [];
      const profileData = profileRes.data;
      const userUploadsRaw = userUploadsRes.data || [];

      // Part 1 — New query results
      const teachingQuestionsRaw = teachingQuestionsRes.data || [];
      const lastSessionRaw = lastSessionRes.data || null;
      const leaderboardRaw = leaderboardRes.data || [];

      // Extract learningPatterns from profile academic_goals
      const learningPatterns: LearningPatterns | null =
        (profileRes.data?.academic_goals as any)?.learningPatterns || null;

      // Build teaching questions array (answer-free)
      const teachingQuestions = teachingQuestionsRaw.map((q: any) => ({
        question_text: q.question_text || '',
        topic: q.topic || topic,
        year: q.year || 0,
        difficulty: q.difficulty || 'Medium'
      }));

      // Approximate student rank from leaderboard data
      // TODO QUIZ-RANK-001: Replace with get_student_rank RPC when available.
      const sortedByScore = leaderboardRaw
        .filter((e: any) => e.total_questions > 0)
        .map((e: any) => ({
          userId: e.user_id,
          pct: Math.round((e.score / e.total_questions) * 100)
        }))
        .sort((a: any, b: any) => b.pct - a.pct);
      const rankIdx = sortedByScore.findIndex((e: any) => e.userId === uid);
      const studentRank: number | null = rankIdx >= 0 ? rankIdx + 1 : null;
      // Build anonymised leaderboard (top 3, no real names)
      const leaderboardContext = sortedByScore.slice(0, 3).map((e: any, i: number) => ({
        display_alias: `Student ${i + 1}`,
        score: e.pct
      }));

      // Last session shape — topic column does not exist in study_sessions
      const lastSession = lastSessionRaw ? {
        subject: lastSessionRaw.subject || subject,
        topic: topic, // use current topic since study_sessions has no topic column
        duration_minutes: lastSessionRaw.duration_minutes || 0,
        created_at: lastSessionRaw.started_at || new Date().toISOString()
      } : null;

      // RAG: Client-side RAG is now handled by the Librarian Subagent on the Edge.
      // We pass zeroed-out chunks here to keep the context object valid.
      const knowledgeChunks: any[] = [];

      // Step 5 — PDF/image uploads: keep file_type so prompt builder can route to multimodal path
      const userUploads = userUploadsRaw.map((u: any) => ({
        file_name: u.file_name,
        raw_text: u.raw_text?.slice(0, 800) || '',
        file_type: (u.file_type as string | undefined)?.toLowerCase() || 'text',
        file_url: (u.file_url as string | undefined) || null,
      }));

      // Process context parts
      const weakTopics = masteryData.filter(m => m.accuracy < 60).sort((a, b) => a.accuracy - b.accuracy).slice(0, 5);
      const strongTopics = masteryData.filter(m => m.accuracy > 75).map(m => m.topic);

      const recentQuizResults = examData.map(e => ({
        date: new Date(e.created_at).toLocaleDateString(),
        score: e.total_questions > 0 ? Math.round((e.score / e.total_questions) * 100) : 0,
        weakAreas: (e.diagnostic_data as any)?.weakTopics || []
      }));

      const lastStudiedDaysAgo = studyData.length > 0
        ? Math.floor((Date.now() - new Date(studyData[0].created_at).getTime()) / (1000 * 60 * 60 * 24))
        : null;

      const currentTopicSyllabus = syllabusData.find(s => s.topic === topic);
      const currentSyllabusObjectives = currentTopicSyllabus?.objectives || [];

      const attemptedTopics = new Set(masteryData.map(m => m.topic));
      const topicsNeverAttempted = syllabusData.filter(s => !attemptedTopics.has(s.topic)).map(s => s.topic);

      let studentStage = cachedStage;
      if (!studentStage) {
        studentStage = classifyStudentStage(masteryData, examData, studyData);
        setCachedStage(studentStage);
      }
      const firstName = profileData?.full_name?.split(' ')[0] || 'Student';

      // Fix 1: Extract profile data for AI context
      const subjectsMeta = profileData?.subjects_meta as any;
      const selectedSubjects = subjectsMeta?.selectedSubjects || [];
      const profileExamDate = profileData?.utme_exam_date;
      const academicGoals = profileData?.academic_goals as any;
      const goalsExamDate = academicGoals?.examDate;
      const examDateStr = profileExamDate || goalsExamDate || null;

      const examType = academicGoals?.examType || 'JAMB';
      const examFullName = academicGoals?.examFullName || 'JAMB UTME';

      let daysToExam: number | null = null;
      if (examDateStr) {
        const examDate = new Date(examDateStr);
        const now = new Date();
        // Reset hours for clean day calculation
        examDate.setHours(0, 0, 0, 0);
        now.setHours(0, 0, 0, 0);
        daysToExam = Math.ceil((examDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      }

      const studentStyle = analyseStudentStyle(interactions);

      const newContext: TutorContext = {
        subject,
        topic,
        firstName,
        weakTopics,
        strongTopics,
        recentQuizResults,
        lastStudiedDaysAgo,
        topicsNeverAttempted,
        currentSyllabusObjectives,
        sessionStartTime: Date.now(),
        studentStage,
        lastToolResult: context?.lastToolResult || null,
        selectedSubjects,
        examDate: profileExamDate || goalsExamDate || null,
        daysToExam,
        studentStyle,
        examType,
        examFullName,
        knowledgeChunks,
        userUploads,
        // Part 1 — new fields
        teachingQuestions,
        studentRank,
        leaderboardContext,
        learningPatterns,
        lastSession,
        currentStreak: profileData?.current_streak || 0
      };

      contextCache.set(cacheKey, { context: newContext, timestamp: Date.now() });
      setContext(newContext);
    } catch (err) {
      logger.error('Failed to build rich student context:', err);
      // Fallback
      setContext({
        subject,
        topic,
        firstName: 'Student',
        weakTopics: [],
        strongTopics: [],
        recentQuizResults: [],
        lastStudiedDaysAgo: null,
        topicsNeverAttempted: [],
        currentSyllabusObjectives: [],
        sessionStartTime: Date.now(),
        studentStage: 'new_user',
        lastToolResult: null,
        selectedSubjects: [],
        examDate: null,
        daysToExam: null,
        studentStyle: defaultStudentStyle,
        examType: 'JAMB',
        examFullName: 'JAMB UTME',
        knowledgeChunks: [],
        userUploads: [],
        teachingQuestions: [],
        studentRank: null,
        leaderboardContext: [],
        learningPatterns: null,
        lastSession: null
      });
    }
  }, [userId, classifyStudentStage, interactions, context?.lastToolResult]);

  /**
     * Hook utility or function: ingestToolResult
     *  * 
     *  * **Side Effects:** Interacts with Supabase or external APIs.
     *  * @returns The expected return value based on function logic
     */
    const ingestToolResult = useCallback((toolType: 'quiz' | 'flashcards' | 'cbt', result: any) => {
    setContext(prev => {
      if (!prev) return null;

      const lastToolResult = {
        toolType,
        score: toolType === 'quiz' ? result.score : (toolType === 'flashcards' ? result.accuracy : result.overallScore),
        weakAreas: toolType === 'quiz' ? result.weakTopics : (toolType === 'cbt' ? [] : [])
      };

      return {
        ...prev,

        lastToolResult
      };
    });

    // Force a re-fetch of fresh data
    const currentSubject = context?.subject || 'General';
    const currentTopic = context?.topic || 'General';
    buildRichStudentContext(currentSubject, currentTopic);

    // Phase 14: Invalidate dashboard caches for live updates
    if (userId) {
      queryCache.invalidate(`home:subjects:${userId}`);
    }
    queryCache.invalidate(`readiness:${userId}`);
  }, [buildRichStudentContext, context, userId]);

  const initializeContext = useCallback((initialContext: Partial<TutorContext>) => {
    setContext(prev => ({
      ...prev,
      ...initialContext,
      firstName: initialContext.firstName || prev?.firstName || 'Student',
      weakTopics: initialContext.weakTopics || prev?.weakTopics || [],
      strongTopics: initialContext.strongTopics || prev?.strongTopics || [],
      recentQuizResults: initialContext.recentQuizResults || prev?.recentQuizResults || [],
      lastStudiedDaysAgo: initialContext.lastStudiedDaysAgo ?? prev?.lastStudiedDaysAgo ?? null,
      topicsNeverAttempted: initialContext.topicsNeverAttempted || prev?.topicsNeverAttempted || [],
      currentSyllabusObjectives: initialContext.currentSyllabusObjectives || prev?.currentSyllabusObjectives || [],
      sessionStartTime: initialContext.sessionStartTime || prev?.sessionStartTime || Date.now(),
      studentStage: initialContext.studentStage || prev?.studentStage || 'early_learner',
      selectedSubjects: initialContext.selectedSubjects || prev?.selectedSubjects || [],
      examDate: initialContext.examDate || prev?.examDate || null,
      daysToExam: initialContext.daysToExam ?? prev?.daysToExam ?? null,
      studentStyle: initialContext.studentStyle || prev?.studentStyle || defaultStudentStyle,
      examType: initialContext.examType || prev?.examType || 'JAMB',
      examFullName: initialContext.examFullName || prev?.examFullName || 'JAMB UTME',
      knowledgeChunks: initialContext.knowledgeChunks || prev?.knowledgeChunks || [],
      userUploads: initialContext.userUploads || prev?.userUploads || [],
      teachingQuestions: initialContext.teachingQuestions || prev?.teachingQuestions || [],
      studentRank: initialContext.studentRank ?? prev?.studentRank ?? null,
      leaderboardContext: initialContext.leaderboardContext || prev?.leaderboardContext || [],
      learningPatterns: initialContext.learningPatterns ?? prev?.learningPatterns ?? null,
      lastSession: initialContext.lastSession ?? prev?.lastSession ?? null
    } as TutorContext));

    if (initialContext.subject && initialContext.topic) {
      buildRichStudentContext(initialContext.subject, initialContext.topic);
    }
  }, [buildRichStudentContext]);

  const createNewConversation = useCallback(async (newContext: TutorContext) => {
    if (!newContext || !newContext.subject) {
      console.error('Cannot create conversation: Invalid context provided.', newContext);
      return null;
    }

    let currentUserId = userId;
    if (!currentUserId) {
      const { data } = await supabase.auth.getUser();
      currentUserId = data.user?.id || null;
      if (currentUserId) setUserId(currentUserId);
    }

    if (!currentUserId) {
      console.warn('Cannot create conversation: No user is logged in.');
      return null;
    }

    setContext(newContext);
    setInteractions([]);
    setActiveConversationId(null);

    try {
      // Dedup: reuse an existing empty conversation for this user+subject
      const { data: existing } = await supabase
        .from('conversations')
        .select('id')
        .eq('user_id', currentUserId)
        .eq('subject', newContext.subject)
        .eq('message_count', 0)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        logger.log('Reusing existing empty conversation:', existing.id);
        setActiveConversationId(existing.id);
        return existing.id;
      }
      const { data, error } = await supabase
        .from('conversations')
        .insert({
          user_id: currentUserId,
          subject: newContext.subject,
          title: 'New Conversation',
          message_count: 0
        })
        .select()
        .single();

      if (error) {
        console.error('Supabase Error creating conversation:', JSON.stringify(error, null, 2));
        throw error;
      }

      const newConv = {
        id: data.id,
        subject: data.subject,
        title: data.title || 'New Conversation',
        message_count: data.message_count || 0,
        updated_at: data.updated_at || new Date().toISOString()
      };

      setConversations(prev => [newConv, ...prev]);
      setActiveConversationId(data.id);
      setInteractions([]); // Clear chat UI for new conversation
      return data.id;
    } catch (err) {
      console.error('CRITICAL: Failed to create new conversation:', err);
      return null;
    }
  }, [userId]);

  const updateContext = useCallback((updates: Partial<TutorContext>) => {
    setContext(prev => prev ? { ...prev, ...updates } : null);
  }, []);

  const clearOrchestratorAction = useCallback(() => {
    setOrchestratorAction(null);
  }, []);

  const generateTitle = async (message: string) => {
    try {
      const prompt = `Generate a concise, 3 to 4 word title for a study conversation that starts with this message:\n"${message}"\n\nTitle only, no quotes, no extra text.`;
      const title = await aiGateway.generateSafe(prompt, {
        subject: 'General',
        featureType: 'ai_tutor',
        userId: userId!
      });
      return title.trim().replace(/^"|"$/g, '');
    } catch (e) {
      return "Study Session";
    }
  };

  /**
   * Addition 2 — Single CTA priority logic
   * Priority: 
   * 1. Explanation/Process -> Quick Quiz
   * 2. Definitions/Terms -> Smart Cards
   * 3. Spatial/Relational -> Concept Map
   * 4. Study Plan/Review -> Mock Exam
   * 5. Default -> Quick Quiz
   */
  const getBestCTA = useCallback((text: string): { label: string; action: string } => {
    const lower = text.toLowerCase();
    
    // 1. Explanation: how, why, explain, process, because, therefore, means
    if (lower.includes('explain') || lower.includes('how') || lower.includes('why') || 
        lower.includes('process') || lower.includes('because') || lower.includes('therefore')) {
      return { label: 'Quick Quiz', action: 'trigger_quiz' };
    }
    
    // 2. Definitions: defined as, refers to, known as, called, vocabulary, term
    if (lower.includes('defined as') || lower.includes('refers to') || lower.includes('known as') || 
        lower.includes('vocabulary') || lower.includes('term') || lower.includes('meaning')) {
      return { label: 'Smart Cards', action: 'trigger_flashcards' };
    }
    
    // 3. Spatial: map, diagram, structure, relationship, connection, history, timeline
    if (lower.includes('map') || lower.includes('diagram') || lower.includes('structure') || 
        lower.includes('relationship') || lower.includes('connection') || lower.includes('timeline')) {
      return { label: 'Concept Map', action: 'trigger_visualizer' };
    }
    
    // 4. Review: performance, summary, plan, readiness, progress
    if (lower.includes('performance') || lower.includes('summary') || lower.includes('plan') || 
        lower.includes('readiness') || lower.includes('progress')) {
      return { label: 'Mock Exam', action: 'trigger_cbt' };
    }
    
    return { label: 'Quick Quiz', action: 'trigger_quiz' };
  }, []);

  /**
     * Hook utility or function: sendMessage
     *  * 
     *  * **Side Effects:** Interacts with Supabase or external APIs.
     *  * @returns The expected return value based on function logic
     */
    const sendMessage = useCallback(async (studentMessage: string, image?: string) => {
    let currentUserId = userId;
    if (!currentUserId) {
      const { data } = await supabase.auth.getUser();
      currentUserId = data.user?.id || null;
      if (currentUserId) setUserId(currentUserId);
    }

    // Use the newly created context if the state hasn't updated immediately
    let effectiveContext = context;

    if (!effectiveContext) {
      console.warn('Fallback context initialization triggered because context was null during sendMessage.');
      effectiveContext = {
        subject: 'General',
        topic: 'Introduction',
        firstName: 'Student',
        weakTopics: [],
        strongTopics: [],
        recentQuizResults: [],
        lastStudiedDaysAgo: null,
        topicsNeverAttempted: [],
        currentSyllabusObjectives: [],
        sessionStartTime: Date.now(),
        studentStage: 'new_user',
        lastToolResult: null,
        selectedSubjects: [],
        examDate: null,
        daysToExam: null,
        studentStyle: defaultStudentStyle,
        examType: 'General',
        examFullName: 'General Examination',
        knowledgeChunks: [],
        userUploads: [],
        teachingQuestions: [],
        studentRank: null,
        leaderboardContext: [],
        learningPatterns: null,
        lastSession: null
      };
      setContext(effectiveContext);
    }

    const activeContext = effectiveContext as TutorContext;

    let currentConvId = activeConversationId;
    if (!currentConvId) {
      // First message ever for this context, create the conversation silently
      currentConvId = await createNewConversation(activeContext);
      if (!currentConvId) {
        toast.error('Could not initialize chat session. Please refresh.');
        return null;
      }
    }

    setLoading(true);
    setIsAwaitingFirstToken(true);

    // Update quota info in background
    if (user?.id) {
      aiGateway.checkUserQuota(user.id).then(setQuotaInfo).catch(console.error);
    }

    // Sanitize user input (removed client-side moderation)
    const sanitizedStudentMessage = studentMessage;

    const studentInteraction: Interaction = {
      id: crypto.randomUUID(), // Assign ID here
      role: 'student',
      content: sanitizedStudentMessage,
      timestamp: new Date(),
    };

    const newInteractions = [...interactions, studentInteraction];
    setInteractions(newInteractions);

    // 1. Fire and forget: Persist student message in background
    const persistStudentData = async () => {
      try {
        if (currentUserId) {
          await supabase.from('ai_interactions').insert({
            id: studentInteraction.id,
            user_id: currentUserId,
            conversation_id: currentConvId!,
            session_id: currentConvId!,
            message_type: 'student',
            content: sanitizedStudentMessage,
            context: activeContext as any,
            metadata: {}
          });

          await supabase.from('conversations').update({
            message_count: newInteractions.length,
            updated_at: new Date().toISOString()
          }).eq('id', currentConvId!);
        }
      } catch (err) {
        console.warn("Background persistence partially failed:", err);
      }
    };
    persistStudentData();

    // Helper to save interactions to DB
    const saveInteraction = async (convId: string, role: 'user' | 'tutor', content: string, id?: string) => {
      if (!currentUserId) return;
      await supabase.from('ai_interactions').insert({
        id: id || crypto.randomUUID(),
        user_id: currentUserId,
        conversation_id: convId,
        session_id: convId,
        message_type: role,
        content: content,
        context: activeContext as any,
        metadata: {}
      });
    };

    // Helper to save to knowledge base (if needed)
    const saveToKnowledgeBase = async (content: string, source: string, subject: string, tags: string[]) => {
      // This is a placeholder. Actual implementation would involve your knowledge base logic.
    };

    // Helper to trigger orchestrator actions
    const triggerAction = (actionData: { action: string; topic?: string }) => {
      setOrchestratorAction(actionData);
      if (actionData.action === 'change_topic' && actionData.topic) {
        setContext(prev => prev ? { ...prev, topic: actionData.topic } : null);
      }
      if (actionData.action === 'trigger_quiz' || actionData.action === 'trigger_flashcards') {
        // intentionally no-op: recall counter removed
      }
    };

    try {
      const tutorMessageId = crypto.randomUUID();

      // Placeholder for tutor message that gets updated as we stream
      setInteractions(prev => [...prev, { id: tutorMessageId, role: 'tutor', content: '', timestamp: new Date() }]);

      // Get session for Auth
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mentat-swarm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          message: sanitizedStudentMessage,
          activeContext: {
            ...activeContext,
            newInteractions
          }
        })
      });

      if (!response.ok || !response.body) {
        let errorMessage = response.statusText;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || response.statusText;
          console.error("Edge Function Error Detail:", errorData);
        } catch (e) {
          // Body might not be JSON
        }
        throw new Error(`Edge Function error: ${errorMessage}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullTutorResponse = "";
      
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.substring(6).trim();
            if (dataStr === '[DONE]') break;
            if (!dataStr) continue;

            try {
              const payload = JSON.parse(dataStr);

              // Handle streaming Teacher text
              if (payload.type === 'text') {
                if (isAwaitingFirstToken) setIsAwaitingFirstToken(false);
                fullTutorResponse += payload.content;
                // Clean the text for UI display even during streaming
                const displayContent = cleanAIText(fullTutorResponse);
                setInteractions(prev => prev.map(msg =>
                  msg.id === tutorMessageId ? { ...msg, content: displayContent } : msg
                ));
              }

              // Handle JSON Tool Trigger from Orchestrator
              if (payload.type === 'action') {
                try {
                  const cmd = JSON.parse(payload.content);
                  if (cmd.action) {
                    triggerAction({ action: cmd.action, topic: cmd.topic || 'General' });
                  }
                } catch(e) { /* ignore invalid JSON triggers */ }
              }

              // Handle Visual Focus Signal [[focus:NodeID]]
              const focusMatch = payload.content?.match(/\[\[focus:([\s\S]*?)\]\]/);
              if (focusMatch && focusMatch[1]) {
                setVisualSignal(focusMatch[1].trim());
              }

            } catch (err) {
              console.warn("Error parsing Edge SSE chunk:", err);
            }
          }
        }
      }

      // 1. Extract all JSON matches
      const jsonBlockRegex = /```json\s*(\{[\s\S]*?\})\s*```|(\{"action"\s*:[\s\S]*?\})/g;
      
      let match;
      while ((match = jsonBlockRegex.exec(fullTutorResponse)) !== null) {
        // 2. Parse each — if it contains an "action" field, call the appropriate handler
        try {
          const jsonStr = match[1] || match[2];
          if (jsonStr) {
            const cmd = JSON.parse(jsonStr);
            if (cmd.action) {
              triggerAction({ action: cmd.action, topic: cmd.topic || context?.topic || 'General' });
            }
          }
        } catch (e) {
          // ignore parsing errors
        }
      }

      // 3. Replace the ENTIRE match (including surrounding whitespace and newlines) with an empty string
      // 4. Trim the result
      // 5. Set the cleaned string as the displayed message content
      const finalDisplayContent = cleanAIText(fullTutorResponse);
      setInteractions(prev => prev.map(msg =>
        msg.id === tutorMessageId ? { ...msg, content: finalDisplayContent } : msg
      ));

      // Check if comprehension check was passed
      const isRecallReset = fullTutorResponse.includes("Correct") || fullTutorResponse.includes("Exactly");
      // recall counter removed

      // Reset lastToolResult after use
      setContext(prev => prev ? { ...prev, lastToolResult: null } : null);

      await saveInteraction(currentConvId!, 'tutor', fullTutorResponse, tutorMessageId);
      
      // Auto-name: if this is the first exchange (1 student msg already stored)
      if (newInteractions.length === 1) {
        try {
          const titlePrompt = `Generate a concise, 3 to 4 word title for a study conversation that starts with this message:\n"${sanitizedStudentMessage}"\n\nTitle only, no quotes, no extra text.`;
          const title = await aiGateway.generateSafe(titlePrompt, {
            subject: 'General',
            featureType: 'ai_tutor',
            userId: currentUserId!
          });
          const cleanTitle = title.trim().replace(/^"|"$/g, '') || 'Study Session';
          await supabase.from('conversations').update({ title: cleanTitle, message_count: 2, updated_at: new Date().toISOString() }).eq('id', currentConvId!);
          setConversations(prev => prev.map(c => c.id === currentConvId ? { ...c, title: cleanTitle, message_count: 2 } : c));
        } catch {
          // Failure sets it to new conversation
        }
      }

      return fullTutorResponse;
    } catch (error: any) {
      console.error("AI Tutor sendMessage exception:", error);

      const isNetworkError =
        error.message?.includes('ERR_NAME_NOT_RESOLVED') ||
        error.message?.includes('ERR_NETWORK_CHANGED') ||
        error.message?.includes('Failed to fetch') ||
        error.message?.includes('NetworkError');

      if (isNetworkError) {
        lastFailedMessage.current = studentMessage;
        toast.error('Connection lost — your message was not sent.');
      } else {
        toast.error(error.message || 'Mentat Tutor is momentarily unavailable.');
      }

      setInteractions(prev => {
        if (prev.length > 0 && (prev[prev.length - 1].content === "..." || prev[prev.length - 1].content === "")) {
          return prev.slice(0, -1);
        }
        return prev;
      });

      if (!isNetworkError) {
        const errorMessage: Interaction = {
          id: crypto.randomUUID(),
          role: 'tutor',
          content: "I ran into a problem — please try sending that again.",
          timestamp: new Date()
        };
        setInteractions(prev => [...prev, errorMessage]);
      }

      return null;
    } finally {
      setLoading(false);
      setIsAwaitingFirstToken(false);
    }

  }, [context, interactions, activeConversationId, userId, lastFeedback]);

  const speakText = useCallback((text: string) => {
    if (isSpeaking) return;
    // Strip JSON and formatting before speaking
    const cleanText = cleanAIText(text).replace(/[*#]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, [isSpeaking]);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  const submitFeedback = async (messageId: string, rating: 'positive' | 'negative') => {
    try {
      const msg = interactions.find(i => i.id === messageId);
      const existingMetadata = msg?.metadata || {};

      await supabase
        .from('ai_interactions')
        .update({
          metadata: {
            ...existingMetadata,
            feedback: rating,
            feedbackAt: new Date().toISOString()
          }
        })
        .eq('id', messageId);

      setLastFeedback(rating);

      if (rating === 'positive') {
        toast.success("Thanks for the feedback!");
      } else {
        toast.info("Message noted. I'll adjust my next response.");
      }
    } catch (err) {
      console.error("Failed to submit feedback:", err);
    }
  };

  const deleteConversation = useCallback(async (conversationId: string) => {
    try {
      // 1. Delete all messages for this conversation
      await supabase.from('ai_interactions').delete().eq('conversation_id', conversationId);
      // 2. Delete the conversation row
      await supabase.from('conversations').delete().eq('id', conversationId);
      
      // 3. Update local state ONLY AFTER db finishes
      setConversations(prev => {
        const remaining = prev.filter(c => c.id !== conversationId);
        // If deleted conversation was active, activate next
        if (activeConversationId === conversationId) {
          if (remaining.length > 0) {
            setActiveConversationId(remaining[0].id);
            // Fire and forget load, we know it's safe now
            loadConversation(remaining[0].id).catch(console.error);
          } else {
            // No conversations left — clear state; initializeTutor will create a blank one
            setActiveConversationId(null);
            setInteractions([]);
          }
        }
        return remaining;
      });
    } catch (err) {
      console.error('Failed to delete conversation:', err);
      toast.error('Could not delete conversation. Please try again.');
    }
  }, [activeConversationId, loadConversation]);

  return {
    loading,
    interactions,
    context,
    isSpeaking,
    conversations,
    activeConversationId,
    loadConversations,
    loadConversation,
    createNewConversation,
    deleteConversation,
    updateContext,
    sendMessage,
    speakText,
    stopSpeaking,
    orchestratorAction,
    triggerAction: setOrchestratorAction,
    clearOrchestratorAction,
    ingestToolResult,
    initializeContext,
    buildRichStudentContext,
    lastFailedMessage: lastFailedMessage.current,
    clearFailedMessage: () => { lastFailedMessage.current = null; },
    submitFeedback,
    quotaInfo,
    refreshQuota: () => user?.id && aiGateway.checkUserQuota(user.id).then(setQuotaInfo),
    getBestCTA,
    isAwaitingFirstToken,
    isHistoryLoading,
    visualSignal,
    clearVisualSignal: () => setVisualSignal(null),
    resetTutor
  };
}
