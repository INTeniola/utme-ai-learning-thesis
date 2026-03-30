import {
    Achievement,
    DEFAULT_ACHIEVEMENTS
} from '@/components/dashboard/AchievementsBadges';
import { DailyActivity } from '@/components/dashboard/StudyActivityCalendar';
import {
    SubjectWithTopics,
    TopicDetail
} from '@/components/dashboard/SubjectProgressExpanded';
import { supabase } from '@/integrations/supabase/client';
import { differenceInDays, format, subDays } from 'date-fns';
import { useCallback, useEffect, useState } from 'react';

export interface Recommendation {
  id: string;
  type: 'weak' | 'stale' | 'strong';
  title: string;
  description: string;
  subject: string;
  topic?: string;
  accuracy?: number;
  daysSincePractice?: number;
}

export interface ProgressDashboardData {
  // Summary cards
  daysToUTME: number | null;
  studyStreak: number;
  quizAverage: number;
  totalStudyHours: number;
  syllabusExposure: number; // % of total topics practiced

  // Subject progress
  subjects: SubjectWithTopics[];

  // Study activity calendar
  dailyActivities: DailyActivity[];

  // Achievements
  achievements: Achievement[];

  // AI Recommendations
  recommendations: Recommendation[];

  // Peer comparison
  percentileRank: number;
  peerInsight: string;
  // Real weekly score trajectory from exam_sessions
  scoreTrajectory: { date: string; score: number }[];
}

// ── Helper: compute study streak from session history ────────────────────────
function calculateStreakFromSessions(sessions: { started_at: string }[]): number {
  if (!sessions.length) return 0;
  const sessionDates = new Set(
    sessions.map(s => format(new Date(s.started_at), 'yyyy-MM-dd'))
  );
  const today = format(new Date(), 'yyyy-MM-dd');
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
  // Streak is alive if studied today or yesterday
  if (!sessionDates.has(today) && !sessionDates.has(yesterday)) return 0;
  let streak = 0;
  let check = new Date();
  while (sessionDates.has(format(check, 'yyyy-MM-dd'))) {
    streak++;
    check = subDays(check, 1);
  }
  return streak;
}

// ── Helper: bucket exam_sessions into weekly score averages ───────────────────
function computeWeeklyScoreTrajectory(
  sessions: { score: number; total_questions: number; completed_at: string }[]
): { date: string; score: number }[] {
  const valid = sessions.filter(s => (s.total_questions ?? 0) > 0);
  if (!valid.length) return [];

  const results: { date: string; score: number }[] = [];
  for (let weeksAgo = 5; weeksAgo >= 0; weeksAgo--) {
    const weekEnd = subDays(new Date(), weeksAgo * 7);
    const weekStart = subDays(weekEnd, 6);
    const week = valid.filter(s => {
      const d = new Date(s.completed_at);
      return d >= weekStart && d <= weekEnd;
    });
    if (week.length > 0) {
      const avg = Math.round(
        week.reduce((sum, s) => sum + (s.score / s.total_questions) * 100, 0) / week.length
      );
      const label = weeksAgo === 0 ? 'This week' : weeksAgo === 1 ? 'Last week' : `${weeksAgo}w ago`;
      results.push({ date: label, score: avg });
    }
  }
  return results;
}

/**
 * Core function: useProgressDashboard
 *  * 
 *  * **Side Effects:** Interacts with Supabase or external APIs.
 *  * @param userId - The userId parameter
 *  * @returns {any} The expected output
 */
export function useProgressDashboard(userId?: string) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ProgressDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (!userId) {
        setLoading(false);
        return;
      }

      // Run all queries in parallel — avoids the missing get_dashboard_data RPC
      const [
        profileRes,
        masteryRes,
        examRes,
        quizRes,
        sessionsRes,
        achievementsRes,
      ] = await Promise.all([
        supabase
          .from('profiles')
          .select('utme_exam_date, current_streak, academic_goals, subjects_meta')
          .eq('id', userId)
          .single(),
        supabase
          .from('concept_mastery')
          .select('subject, topic, accuracy, last_quiz_at, total_attempts')
          .eq('user_id', userId),
        supabase
          .from('exam_sessions')
          .select('score, total_questions, completed_at')
          .eq('user_id', userId)
          .order('completed_at', { ascending: false })
          .limit(50),
        supabase
          .from('quiz_results')
          .select('score, total_questions, completed_at')
          .eq('user_id', userId)
          .order('completed_at', { ascending: false })
          .limit(50),
        supabase
          .from('study_sessions')
          .select('started_at, duration_minutes, session_type, flashcards_reviewed')
          .eq('user_id', userId)
          .order('started_at', { ascending: false })
          .limit(90),
        supabase
          .from('user_achievements')
          .select('achievement_id, earned_at')
          .eq('user_id', userId),
      ]);

      if (profileRes.error) console.warn('Profile fetch:', profileRes.error.message);
      if (masteryRes.error) console.warn('Mastery fetch:', masteryRes.error.message);
      if (examRes.error) console.warn('Exam fetch:', examRes.error.message);
      if (quizRes.error) console.warn('Quiz fetch:', quizRes.error.message);
      if (sessionsRes.error) console.warn('Sessions fetch:', sessionsRes.error.message);
      if (achievementsRes.error) console.warn('Achievements fetch:', achievementsRes.error.message);

      const profile = profileRes.data ?? null;
      const masteryData = masteryRes.data ?? [];
      const examResults = examRes.data ?? [];
      const regularQuizResults = quizRes.data ?? [];
      const studySessions = sessionsRes.data ?? [];
      const userAchievements = achievementsRes.data ?? [];
      
      const quizResults = [
        ...examResults.map(e => ({ score: e.score, total_questions: e.total_questions, completed_at: e.completed_at })),
        ...regularQuizResults.map(q => ({ score: q.score, total_questions: q.total_questions, completed_at: q.completed_at }))
      ].sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime());
      const allMasteryAvg = 50; // Used for peer percentile baseline

      // Calculate days to UTME
      let daysToUTME: number | null = null;
      if (profile?.utme_exam_date) {
        daysToUTME = differenceInDays(new Date(profile.utme_exam_date), new Date());
        if (daysToUTME < 0) daysToUTME = null;
      }

      // Study streak — computed from actual session dates (DB column is never auto-incremented)
      const studyStreak = calculateStreakFromSessions(studySessions);

      // Quiz average — guard against division by zero (was producing NaN)
      const validQuizzes = quizResults.filter(q => (q.total_questions ?? 0) > 0);
      const quizAverage = validQuizzes.length > 0
        ? Math.round(
          validQuizzes.reduce((sum, q) => sum + (q.score / q.total_questions) * 100, 0) /
          validQuizzes.length
        )
        : 0;

      // Total study hours (from study_sessions)
      const totalStudyMinutes = studySessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
      const totalStudyHours = Math.round(totalStudyMinutes / 60);

      // Process subject progress with topics
      const subjectMap = new Map<string, {
        topics: Map<string, { total: number; count: number; lastPracticed: string | null }>;
        total: number;
        count: number;
      }>();
      // UTME syllabus topic counts per subject (approximate)
      const SYLLABUS_TOPIC_COUNTS: Record<string, number> = {
        English: 12,
        Mathematics: 18,
        Physics: 16,
        Chemistry: 15,
        Biology: 18,
        Geography: 14,
        Government: 16,
        Economics: 15,
        Literature: 10,
      };

      let practicedTopicsCount = 0;
      let totalSyllabusTopics = 0;

      // Identify which subjects we should count for the syllabus
      // Use subjects_meta if available, otherwise fallback to mastery data
      const userSubjects = profile?.subjects_meta && typeof profile.subjects_meta === 'object' 
        ? Object.keys(profile.subjects_meta as object)
        : Array.from(subjectMap.keys());

      userSubjects.forEach(s => {
        const normalisedS = s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
        totalSyllabusTopics += SYLLABUS_TOPIC_COUNTS[normalisedS] || 15;
      });

      masteryData.forEach((m: any) => {
        if (!subjectMap.has(m.subject)) {
          subjectMap.set(m.subject, { topics: new Map(), total: 0, count: 0 });
        }
        const subject = subjectMap.get(m.subject)!;
        subject.total += m.accuracy || 0;
        subject.count++;

        if (!subject.topics.has(m.topic)) {
          subject.topics.set(m.topic, { total: 0, count: 0, lastPracticed: null });
        }
        const topic = subject.topics.get(m.topic)!;
        topic.total += m.accuracy || 0;
        topic.count++;
        
        if (m.total_attempts > 0) practicedTopicsCount++;
        if (m.last_quiz_at && (!topic.lastPracticed || m.last_quiz_at > topic.lastPracticed)) {
          topic.lastPracticed = m.last_quiz_at;
        }
      });

      // Subject colors
      const subjectColors: Record<string, string> = {
        Mathematics: 'bg-[var(--subject-maths)]',
        English: 'bg-[var(--subject-english)]',
        Physics: 'bg-[var(--subject-physics)]',
        Chemistry: 'bg-[var(--subject-chemistry)]',
        Biology: 'bg-[var(--subject-biology,theme(colors.pink.500))]',
        Economics: 'bg-[var(--subject-economics,theme(colors.teal.500))]',
        Government: 'bg-[var(--subject-government,theme(colors.indigo.500))]',
        Literature: 'bg-[var(--subject-literature,theme(colors.rose.500))]',
      };

      const subjects: SubjectWithTopics[] = Array.from(subjectMap.entries()).map(([name, data]) => {
        const mastery = data.count > 0 ? Math.round(data.total / data.count) : 0;

        // Calculate weekly change (simplified - would need historical data for accuracy)
        const weeklyChange = 0; // Historical comparison not available yet

        const topics: TopicDetail[] = Array.from(data.topics.entries()).map(([topic, topicData]) => ({
          topic,
          accuracy: topicData.count > 0 ? Math.round(topicData.total / topicData.count) : 0,
          attempts: topicData.count,
          trend: 'stable' as const, // Would need historical comparison
          lastPracticed: topicData.lastPracticed,
        }));

        return {
          name,
          mastery,
          weeklyChange,
          color: subjectColors[name] || 'bg-gray-500',
          topics,
        };
      });

      // Daily activities for calendar
      const activityMap = new Map<string, DailyActivity>();

      studySessions.forEach((session: any) => {
        const dateStr = format(new Date(session.started_at), 'yyyy-MM-dd');
        if (!activityMap.has(dateStr)) {
          activityMap.set(dateStr, { date: dateStr, minutes: 0, quizzes: 0, flashcards: 0 });
        }
        const activity = activityMap.get(dateStr)!;
        activity.minutes += session.duration_minutes || 0;

        if (session.session_type === 'quiz') {
          activity.quizzes += 1;
        } else if (session.session_type === 'flashcard') {
          activity.flashcards += session.flashcards_reviewed || 0;
        }
      });

      const dailyActivities = Array.from(activityMap.values());

      // Real weekly score trajectory (replaces the fake quizAvg-15/quizAvg-8/quizAvg chart)
      const scoreTrajectory = computeWeeklyScoreTrajectory(quizResults);

      // Process achievements
      const earnedSet = new Set(userAchievements.map((a: any) => a.achievement_id));
      const earnedMap = new Map(userAchievements.map((a: any) => [a.achievement_id, a.earned_at]));

      // Calculate progress for each achievement
      const achievements: Achievement[] = DEFAULT_ACHIEVEMENTS.map((def) => {
        let progress: number | undefined;

        switch (def.id) {
          case 'week_warrior':
          case 'month_champion':
            progress = studyStreak;
            break;
          case 'early_bird':
            progress = studySessions.filter((s: any) => {
              const hour = new Date(s.started_at).getHours();
              return hour < 8;
            }).length;
            break;
          case 'night_owl':
            progress = studySessions.filter((s: any) => {
              const hour = new Date(s.started_at).getHours();
              return hour >= 22;
            }).length;
            break;
          case 'quiz_master':
          case 'quiz_legend':
            progress = quizResults.length;
            break;
          case 'perfect_score':
            progress = quizResults.filter((q: any) => 
              q.total_questions > 0 && q.score === q.total_questions
            ).length;
            break;
          case 'comeback_kid':
            // Proxy: topics where accuracy > 70 and attempts > 5
            progress = masteryData.filter((m: any) => 
               m.accuracy > 70 && m.total_attempts > 5
            ).length >= 1 ? 1 : 0;
            break;
          case 'speed_demon':
            // Proxy: quiz completed with < 45s per question on avg
            progress = quizResults.filter((q: any) => {
               if (!q.total_questions || !q.completed_at || !studySessions.length) return false;
               // This is a rough estimation as time_spent isn't directly in exam_sessions
               return false; // Default to 0 for now until we have better time tracking
            }).length >= 1 ? 1 : 0;
            break;
          case 'flashcard_pro':
            progress = studySessions
              .filter((s: any) => s.session_type === 'flashcard')
              .reduce((sum: number, s: any) => sum + (s.flashcards_reviewed || 0), 0);
            break;
          case 'bookworm':
            progress = totalStudyMinutes;
            break;
          case 'subject_expert':
            progress = Math.max(...subjects.map(s => s.mastery), 0);
            break;
          default:
            progress = undefined;
        }

        return {
          ...def,
          earned: earnedSet.has(def.id),
          earnedAt: earnedMap.get(def.id),
          progress,
        };
      });

      // Achievement auto-unlock logic (placeholder - actual implementation would involve DB updates)
      // This would typically be handled server-side or with a separate mutation.
      // For demonstration, we're just calculating progress here.

      // Generate recommendations
      const recommendations: Recommendation[] = [];

      // Weak topics (accuracy < 60%)
      subjects.forEach((subject) => {
        subject.topics
          .filter(t => t.accuracy < 60 && t.attempts > 0)
          .slice(0, 2)
          .forEach((topic) => {
            recommendations.push({
              id: `weak-${subject.name}-${topic.topic}`,
              type: 'weak',
              title: topic.topic,
              description: `Only ${topic.accuracy}% mastery`,
              subject: subject.name,
              topic: topic.topic,
              accuracy: topic.accuracy,
            });
          });
      });

      // Stale topics (not practiced in 7+ days)
      const sevenDaysAgo = subDays(new Date(), 7);
      subjects.forEach((subject) => {
        subject.topics
          .filter(t => t.lastPracticed && new Date(t.lastPracticed) < sevenDaysAgo)
          .slice(0, 1)
          .forEach((topic) => {
            const daysSince = differenceInDays(new Date(), new Date(topic.lastPracticed!));
            recommendations.push({
              id: `stale-${subject.name}-${topic.topic}`,
              type: 'stale',
              title: topic.topic,
              description: `Not practiced in ${daysSince} days`,
              subject: subject.name,
              topic: topic.topic,
              daysSincePractice: daysSince,
            });
          });
      });

      // Strong subjects (suggest harder content)
      subjects
        .filter(s => s.mastery >= 80)
        .slice(0, 1)
        .forEach((subject) => {
          recommendations.push({
            id: `strong-${subject.name}`,
            type: 'strong',
            title: subject.name,
            description: `${subject.mastery}% mastery - try advanced!`,
            subject: subject.name,
          });
        });

      // Peer comparison — only show when user has meaningful activity
      // (was fabricating Top 99% for brand new users with 0 data)
      const hasEnoughDataForPeer = validQuizzes.length >= 5;
      const userAvgMastery = subjects.length > 0
        ? subjects.reduce((sum, s) => sum + s.mastery, 0) / subjects.length
        : 0;

      const percentileRank = hasEnoughDataForPeer
        ? Math.min(99, Math.max(1, 50 + Math.round((userAvgMastery - allMasteryAvg) * 2)))
        : 0; // 0 = not enough data to show

      const peerInsight = !hasEnoughDataForPeer
        ? 'Complete at least 5 quizzes to unlock peer comparison.'
        : percentileRank >= 75
          ? "You're ahead of most students! Keep up the great work."
          : percentileRank >= 50
            ? "You're performing above average. Stay consistent!"
            : "Students who practice 3x/week see 25% faster improvement.";

      setData({
        daysToUTME,
        studyStreak,
        quizAverage,
        totalStudyHours,
        subjects,
        dailyActivities,
        achievements,
        recommendations,
        percentileRank,
        peerInsight,
        scoreTrajectory,
        syllabusExposure: totalSyllabusTopics > 0 ? Math.round((practicedTopicsCount / totalSyllabusTopics) * 100) : 0,
      });

    } catch (err: any) {
      console.error('Failed to fetch dashboard data:', err);
      setError(err?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  return {
    loading,
    data,
    error,
    refresh: fetchDashboardData,
  };
}
