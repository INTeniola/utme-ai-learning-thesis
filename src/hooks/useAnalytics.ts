import { supabase } from '@/integrations/supabase/client';
import { useCallback, useEffect, useState } from 'react';

export interface ScoreDataPoint {
  date: string;
  score: number;
  projected: number;
}

export interface SubjectPerformance {
  subject: string;
  userScore: number;
  averageScore: number;
  topicsCount: number;
}

export interface TopicComparison {
  topic: string;
  userScore: number;
  averageScore: number;
  attempts: number;
}

export interface StudySession {
  date: string;
  minutesSpent: number;
  questionsAnswered: number;
}

export interface AnalyticsData {
  scoreTrajectory: ScoreDataPoint[];
  subjectPerformance: SubjectPerformance[];
  topicComparisons: TopicComparison[];
  studySessions: StudySession[];
  targetScore: number;
  currentAverageScore: number;
  projectedScore: number;
  totalStudyMinutes: number;
  studyStreak: number;
  fatigueLevel: 'low' | 'moderate' | 'high' | 'critical';
}

export function useAnalytics(userId?: string) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string>('Physics');

  const fetchAnalytics = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {

      // Fetch user profile for target score and streak
      const { data: profile } = await supabase
        .from('profiles')
        .select('academic_goals, current_streak, last_activity_date')
        .eq('id', userId)
        .single();

      const targetScore = (profile?.academic_goals as any)?.target_utme_score || 300;
      const studyStreak = profile?.current_streak || 0;

      // Fetch user's mastery data
      const { data: masteryData } = await supabase
        .from('user_mastery_ledger')
        .select('*')
        .eq('user_id', userId);

      // Fetch exam sessions for score trajectory
      const { data: examSessions } = await supabase
        .from('exam_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .order('completed_at', { ascending: true });

      // Fetch all users' mastery for peer comparison (anonymized)
      const { data: allMasteryData } = await supabase
        .from('user_mastery_ledger')
        .select('subject, topic, mastery_score');

      // Calculate score trajectory
      const scoreTrajectory: ScoreDataPoint[] = [];
      let runningTotal = 0;
      let examCount = 0;

      (examSessions || []).forEach((session: any) => {
        if (session.score !== null && session.total_questions) {
          const percentage = (session.score / session.total_questions) * 100;
          runningTotal += percentage;
          examCount++;
          const avgScore = runningTotal / examCount;

          // Project future score based on trend
          const projectedImprovement = examCount * 2; // 2% improvement per exam
          const projected = Math.min(100, avgScore + projectedImprovement);

          scoreTrajectory.push({
            date: new Date(session.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            score: Math.round(avgScore),
            projected: Math.round(projected),
          });
        }
      });

      // Add projected future points
      if (scoreTrajectory.length > 0) {
        const lastScore = scoreTrajectory[scoreTrajectory.length - 1];
        const improvementRate = scoreTrajectory.length > 1
          ? (lastScore.score - scoreTrajectory[0].score) / scoreTrajectory.length
          : 2;

        for (let i = 1; i <= 4; i++) {
          const futureDate = new Date();
          futureDate.setDate(futureDate.getDate() + i * 7);
          scoreTrajectory.push({
            date: futureDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            score: lastScore.score, // Current score stays
            projected: Math.min(100, Math.round(lastScore.score + improvementRate * i)),
          });
        }
      }

      // Calculate subject performance
      const subjectStats: Record<string, { total: number; count: number }> = {};
      const userSubjectStats: Record<string, { total: number; count: number }> = {};

      (allMasteryData || []).forEach((m: any) => {
        if (!subjectStats[m.subject]) {
          subjectStats[m.subject] = { total: 0, count: 0 };
        }
        subjectStats[m.subject].total += m.mastery_score || 0;
        subjectStats[m.subject].count++;
      });

      (masteryData || []).forEach((m: any) => {
        if (!userSubjectStats[m.subject]) {
          userSubjectStats[m.subject] = { total: 0, count: 0 };
        }
        userSubjectStats[m.subject].total += m.mastery_score || 0;
        userSubjectStats[m.subject].count++;
      });

      const subjectPerformance: SubjectPerformance[] = Object.keys(subjectStats).map(subject => ({
        subject,
        userScore: userSubjectStats[subject]
          ? Math.round(userSubjectStats[subject].total / userSubjectStats[subject].count)
          : 0,
        averageScore: Math.round(subjectStats[subject].total / subjectStats[subject].count),
        topicsCount: userSubjectStats[subject]?.count || 0,
      }));

      // Calculate topic comparisons for selected subject
      const topicStats: Record<string, { userTotal: number; userCount: number; avgTotal: number; avgCount: number }> = {};

      (allMasteryData || []).filter((m: any) => m.subject === selectedSubject).forEach((m: any) => {
        if (!topicStats[m.topic]) {
          topicStats[m.topic] = { userTotal: 0, userCount: 0, avgTotal: 0, avgCount: 0 };
        }
        topicStats[m.topic].avgTotal += m.mastery_score || 0;
        topicStats[m.topic].avgCount++;
      });

      (masteryData || []).filter((m: any) => m.subject === selectedSubject).forEach((m: any) => {
        if (topicStats[m.topic]) {
          topicStats[m.topic].userTotal += m.mastery_score || 0;
          topicStats[m.topic].userCount++;
        }
      });

      const topicComparisons: TopicComparison[] = Object.entries(topicStats)
        .map(([topic, stats]) => ({
          topic: topic.length > 15 ? topic.substring(0, 15) + '...' : topic,
          userScore: stats.userCount > 0 ? Math.round(stats.userTotal / stats.userCount) : 0,
          averageScore: stats.avgCount > 0 ? Math.round(stats.avgTotal / stats.avgCount) : 0,
          attempts: stats.userCount,
        }))
        .slice(0, 6);

      // Calculate study sessions (simulated from exam data)
      const studySessions: StudySession[] = [];
      const sessionsByDay: Record<string, { minutes: number; questions: number }> = {};

      (examSessions || []).forEach((session: any) => {
        const dateKey = new Date(session.started_at).toISOString().split('T')[0];
        if (!sessionsByDay[dateKey]) {
          sessionsByDay[dateKey] = { minutes: 0, questions: 0 };
        }
        sessionsByDay[dateKey].minutes += session.time_limit_minutes || 30;
        sessionsByDay[dateKey].questions += session.total_questions || 0;
      });

      Object.entries(sessionsByDay).forEach(([date, data]) => {
        studySessions.push({
          date,
          minutesSpent: data.minutes,
          questionsAnswered: data.questions,
        });
      });

      // Calculate totals
      const totalStudyMinutes = studySessions.reduce((acc, s) => acc + s.minutesSpent, 0);
      const currentAverageScore = subjectPerformance.length > 0
        ? Math.round(subjectPerformance.reduce((acc, s) => acc + s.userScore, 0) / subjectPerformance.length)
        : 0;

      // Project UTME score (scale from percentage to 400)
      const projectedScore = Math.round((currentAverageScore / 100) * 400);

      // Calculate fatigue level based on today's study time
      const today = new Date().toISOString().split('T')[0];
      const todayStudyMinutes = sessionsByDay[today]?.minutes || 0;
      let fatigueLevel: 'low' | 'moderate' | 'high' | 'critical' = 'low';
      if (todayStudyMinutes > 180) fatigueLevel = 'critical';
      else if (todayStudyMinutes > 120) fatigueLevel = 'high';
      else if (todayStudyMinutes > 60) fatigueLevel = 'moderate';

      setData({
        scoreTrajectory,
        subjectPerformance,
        topicComparisons,
        studySessions,
        targetScore,
        currentAverageScore,
        projectedScore,
        totalStudyMinutes,
        studyStreak,
        fatigueLevel,
      });

    } catch (err: any) {
      console.error('Failed to fetch analytics:', err);
      setError(err?.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [selectedSubject, userId]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return {
    loading,
    data,
    error,
    selectedSubject,
    setSelectedSubject,
    refresh: fetchAnalytics,
  };
}
