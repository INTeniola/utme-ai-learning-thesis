import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

export type TimerMode = 'idle' | 'studying' | 'paused' | 'break' | 'completed';

export interface TimerPreset {
  label: string;
  minutes: number;
}

export const TIMER_PRESETS: TimerPreset[] = [
  { label: '25 min', minutes: 25 },
  { label: '45 min', minutes: 45 },
  { label: '60 min', minutes: 60 },
];

export const MOTIVATIONAL_QUOTES = [
  "You're doing great! Keep pushing!",
  "Every minute of study is progress!",
  "JAMB success is built one session at a time!",
  "Stay focused! You've got this!",
  "Your future self will thank you!",
  "Consistency beats intensity. Keep going!",
  "You're one step closer to your goal!",
  "Great minds are built through dedication!",
];

interface StudyTimerState {
  mode: TimerMode;
  subject: string | null;
  targetDuration: number; // in seconds
  elapsed: number; // elapsed seconds
  isFullscreen: boolean;
  sessionStartedAt: Date | null;
  currentQuoteIndex: number;
}

export function useStudyTimer() {
  const [state, setState] = useState<StudyTimerState>({
    mode: 'idle',
    subject: null,
    targetDuration: 25 * 60,
    elapsed: 0,
    isFullscreen: false,
    sessionStartedAt: null,
    currentQuoteIndex: 0,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [earnedXP, setEarnedXP] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const quoteIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate remaining time
  const remainingSeconds = Math.max(0, state.targetDuration - state.elapsed);
  const progress = state.targetDuration > 0
    ? (state.elapsed / state.targetDuration) * 100
    : 0;

  // Timer tick
  useEffect(() => {
    if (state.mode === 'studying') {
      intervalRef.current = setInterval(() => {
        setState(prev => {
          const newElapsed = prev.elapsed + 1;
          if (newElapsed >= prev.targetDuration) {
            return { ...prev, elapsed: prev.targetDuration, mode: 'completed' };
          }
          return { ...prev, elapsed: newElapsed };
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [state.mode]);

  // Quote rotation every 10 minutes
  useEffect(() => {
    if (state.mode === 'studying') {
      quoteIntervalRef.current = setInterval(() => {
        setState(prev => ({
          ...prev,
          currentQuoteIndex: (prev.currentQuoteIndex + 1) % MOTIVATIONAL_QUOTES.length,
        }));
      }, 10 * 60 * 1000); // 10 minutes
    } else {
      if (quoteIntervalRef.current) {
        clearInterval(quoteIntervalRef.current);
        quoteIntervalRef.current = null;
      }
    }

    return () => {
      if (quoteIntervalRef.current) clearInterval(quoteIntervalRef.current);
    };
  }, [state.mode]);

  // Save session to database
  const saveSession = useCallback(async (duration: number, subject: string | null) => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be logged in to save sessions');
        return false;
      }

      const durationMinutes = Math.floor(duration / 60);
      const xpEarned = durationMinutes; // 1 XP per minute

      // Save study session
      const { error: sessionError } = await supabase.from('study_sessions').insert({
        user_id: user.id,
        subject: subject || null,
        duration_minutes: durationMinutes,
        session_type: 'pomodoro',
        started_at: state.sessionStartedAt?.toISOString() || new Date().toISOString(),
        ended_at: new Date().toISOString(),
        metadata: {
          target_duration: state.targetDuration / 60,
          completed: duration >= state.targetDuration,
        },
      });

      if (sessionError) throw sessionError;

      // Update profile stats directly
      const { data: profile } = await supabase
        .from('profiles')
        .select('total_study_minutes, xp_points')
        .eq('id', user.id)
        .single();

      if (profile) {
        await supabase.from('profiles').update({
          total_study_minutes: ((profile.total_study_minutes as number) || 0) + durationMinutes,
          xp_points: ((profile.xp_points as number) || 0) + xpEarned,
        }).eq('id', user.id);
      }

      // Check for achievements
      await checkAchievements(user.id, durationMinutes);

      setEarnedXP(xpEarned);
      toast.success(`Session saved! + ${xpEarned} XP earned`);
      return true;
    } catch (error) {
      logger.error('Failed to save session:', error);
      toast.error('Failed to save session');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [state.sessionStartedAt, state.targetDuration]);

  // Check and award achievements
  const checkAchievements = async (userId: string, duration: number) => {
    const now = new Date();
    const hour = now.getHours();

    const achievementsToCheck = [];

    // Night Owl: Studied after 10pm
    if (hour >= 22 || hour < 4) {
      achievementsToCheck.push('night_owl');
    }

    // Early Bird: Studied before 7am
    if (hour >= 5 && hour < 7) {
      achievementsToCheck.push('early_bird');
    }

    // Marathon: Studied 2+ hours
    if (duration >= 120) {
      achievementsToCheck.push('marathon_runner');
    }

    // Focus Master: Completed session
    if (duration >= state.targetDuration / 60) {
      achievementsToCheck.push('focus_master');
    }

    for (const achievementId of achievementsToCheck) {
      const { data: existing } = await supabase
        .from('user_achievements')
        .select('id')
        .eq('user_id', userId)
        .eq('achievement_id', achievementId)
        .maybeSingle();

      if (!existing) {
        await supabase.from('user_achievements').insert({
          user_id: userId,
          achievement_id: achievementId,
          metadata: { duration, hour },
        });
      }
    }
  };

  // Timer controls
  const startTimer = useCallback((subject: string, durationMinutes: number) => {
    setState({
      mode: 'studying',
      subject,
      targetDuration: durationMinutes * 60,
      elapsed: 0,
      isFullscreen: false,
      sessionStartedAt: new Date(),
      currentQuoteIndex: Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length),
    });
  }, []);

  const pauseTimer = useCallback(() => {
    setState(prev => ({ ...prev, mode: 'paused' }));
  }, []);

  const resumeTimer = useCallback(() => {
    setState(prev => ({ ...prev, mode: 'studying' }));
  }, []);

  const stopTimer = useCallback(async () => {
    if (state.elapsed > 60) {
      await saveSession(state.elapsed, state.subject);
    }
    setState(prev => ({
      ...prev,
      mode: 'idle',
      elapsed: 0,
      sessionStartedAt: null,
    }));
  }, [state.elapsed, state.subject, saveSession]);

  const completeSession = useCallback(async () => {
    await saveSession(state.elapsed, state.subject);
    setState(prev => ({ ...prev, mode: 'completed' }));
  }, [state.elapsed, state.subject, saveSession]);

  const toggleFullscreen = useCallback(() => {
    setState(prev => ({ ...prev, isFullscreen: !prev.isFullscreen }));

    if (!state.isFullscreen) {
      document.documentElement.requestFullscreen?.().catch(() => { });
    } else {
      document.exitFullscreen?.().catch(() => { });
    }
  }, [state.isFullscreen]);

  const resetTimer = useCallback(() => {
    setEarnedXP(0);
    setState({
      mode: 'idle',
      subject: null,
      targetDuration: 25 * 60,
      elapsed: 0,
      isFullscreen: false,
      sessionStartedAt: null,
      currentQuoteIndex: 0,
    });
  }, []);

  const startBreak = useCallback((minutes: number = 10) => {
    setState(prev => ({
      ...prev,
      mode: 'break',
      targetDuration: minutes * 60,
      elapsed: 0,
    }));
  }, []);

  // Format time helper
  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')} `;
  };

  return {
    ...state,
    remainingSeconds,
    progress,
    isSaving,
    earnedXP,
    currentQuote: MOTIVATIONAL_QUOTES[state.currentQuoteIndex],
    formatTime,
    startTimer,
    pauseTimer,
    resumeTimer,
    stopTimer,
    completeSession,
    toggleFullscreen,
    resetTimer,
    startBreak,
  };
}
