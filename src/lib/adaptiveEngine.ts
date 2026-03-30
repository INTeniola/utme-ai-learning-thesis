/**
 * Adaptive Learning Engine - The Brain of the App
 * 
 * @note [PRE-ONBOARDING AUDIT]
 * This file contains the client-side adaptive learning logic (difficulty scaling, 
 * session prioritization, and Socratic interventions). It is actively imported 
 * and utilized by `StudyController.tsx` which in turn drives the Dashboard's 
 * integrated study sessions. Do not delete this file without refactoring the 
 * `StudyController` dependency. Future iterations may migrate this logic entirely 
 * to the Edge Functions (Supabase) for centralized execution.
 */
export interface MasteryData {
  subject: string;
  topic: string;
  subtopic: string | null;
  mastery_score: number;
  error_patterns: string[];
  attempts_count: number;
}

export interface SessionPriority {
  subject: string;
  topic: string;
  subtopic: string | null;
  priority: number;
  mastery_score: number;
  recommended_difficulty: 'easy' | 'medium' | 'hard';
}

export interface AdaptiveState {
  consecutiveMisses: number;
  currentDifficulty: 'easy' | 'medium' | 'hard';
  socraticMode: boolean;
  currentTopic: string;
  currentSubtopic: string | null;
  questionHistory: QuestionResult[];
}

export interface QuestionResult {
  isCorrect: boolean;
  topic: string;
  subtopic: string | null;
  difficulty: 'easy' | 'medium' | 'hard';
  timeSpent: number;
  hintsUsed: number;
}

// Calculate session priority based on lowest mastery scores
export function calculateSessionPriority(masteryData: MasteryData[]): SessionPriority[] {
  if (!masteryData || masteryData.length === 0) {
    return getDefaultPriorities();
  }

  // Sort by mastery score (ascending) to get weakest areas first
  const sorted = [...masteryData].sort((a, b) => a.mastery_score - b.mastery_score);
  
  // Take lowest 3 (or all if less than 3)
  const weakestAreas = sorted.slice(0, 3);
  
  return weakestAreas.map((area, index) => ({
    subject: area.subject,
    topic: area.topic,
    subtopic: area.subtopic,
    priority: 3 - index, // Highest priority (3) for weakest area
    mastery_score: area.mastery_score,
    recommended_difficulty: getDifficultyFromMastery(area.mastery_score),
  }));
}

function getDifficultyFromMastery(score: number): 'easy' | 'medium' | 'hard' {
  if (score < 40) return 'easy';
  if (score < 70) return 'medium';
  return 'hard';
}

function getDefaultPriorities(): SessionPriority[] {
  return [
    { subject: 'Mathematics', topic: 'Algebra', subtopic: 'Linear Equations', priority: 3, mastery_score: 0, recommended_difficulty: 'easy' },
    { subject: 'Physics', topic: 'Mechanics', subtopic: 'Motion', priority: 2, mastery_score: 0, recommended_difficulty: 'easy' },
    { subject: 'Chemistry', topic: 'Organic Chemistry', subtopic: 'Hydrocarbons', priority: 1, mastery_score: 0, recommended_difficulty: 'easy' },
  ];
}

// Adaptive Sequencing Algorithm
export function processAdaptiveResponse(
  state: AdaptiveState,
  result: QuestionResult
): { newState: AdaptiveState; action: AdaptiveAction } {
  const newState = { ...state };
  let action: AdaptiveAction = { type: 'continue' };

  if (!result.isCorrect) {
    newState.consecutiveMisses += 1;
    newState.questionHistory.push(result);

    // Trigger interventions based on consecutive misses
    if (newState.consecutiveMisses >= 2) {
      if (newState.currentDifficulty === 'easy' || newState.consecutiveMisses >= 3) {
        // Already at easy or 3+ misses - trigger Socratic intervention
        newState.socraticMode = true;
        action = {
          type: 'socratic_intervention',
          message: getSocraticPrompt(newState.currentTopic, newState.currentSubtopic),
        };
      } else {
        // Downgrade difficulty
        newState.currentDifficulty = downgradeDifficulty(newState.currentDifficulty);
        action = {
          type: 'difficulty_downgrade',
          newDifficulty: newState.currentDifficulty,
          message: `Let's try an easier question to build your understanding.`,
        };
      }
    }
  } else {
    // Correct answer - reset consecutive misses
    newState.consecutiveMisses = 0;
    newState.socraticMode = false;
    newState.questionHistory.push(result);

    // Consider upgrading difficulty after 3 consecutive correct answers at current level
    const recentCorrect = newState.questionHistory
      .slice(-3)
      .filter(q => q.isCorrect && q.difficulty === state.currentDifficulty);

    if (recentCorrect.length >= 3 && newState.currentDifficulty !== 'hard') {
      newState.currentDifficulty = upgradeDifficulty(newState.currentDifficulty);
      action = {
        type: 'difficulty_upgrade',
        newDifficulty: newState.currentDifficulty,
        message: `Great work! Let's challenge you with harder questions.`,
      };
    }
  }

  return { newState, action };
}

export type AdaptiveAction =
  | { type: 'continue' }
  | { type: 'difficulty_downgrade'; newDifficulty: 'easy' | 'medium' | 'hard'; message: string }
  | { type: 'difficulty_upgrade'; newDifficulty: 'easy' | 'medium' | 'hard'; message: string }
  | { type: 'socratic_intervention'; message: string };

function downgradeDifficulty(current: 'easy' | 'medium' | 'hard'): 'easy' | 'medium' | 'hard' {
  if (current === 'hard') return 'medium';
  if (current === 'medium') return 'easy';
  return 'easy';
}

function upgradeDifficulty(current: 'easy' | 'medium' | 'hard'): 'easy' | 'medium' | 'hard' {
  if (current === 'easy') return 'medium';
  if (current === 'medium') return 'hard';
  return 'hard';
}

function getSocraticPrompt(topic: string, subtopic: string | null): string {
  const prompts: Record<string, string> = {
    'Algebraic Fractions': `Let's break this down step by step. When we have an algebraic fraction like \\frac{x+2}{x-1}, what does the denominator tell us about valid values of x?`,
    'Quadratic Equations': `Before solving, let's identify: What form is this equation in? Can you spot the coefficients a, b, and c?`,
    'Refraction': `Think about what happens when light enters a denser medium. Does it speed up or slow down?`,
    'default': `Let's approach this differently. Can you identify what concept we're testing here?`,
  };

  return prompts[subtopic || topic] || prompts['default'];
}

// Calculate updated mastery score based on session performance
export function calculateNewMastery(
  currentMastery: number,
  sessionResults: QuestionResult[]
): number {
  if (sessionResults.length === 0) return currentMastery;

  const correctCount = sessionResults.filter(r => r.isCorrect).length;
  const totalCount = sessionResults.length;
  const sessionScore = (correctCount / totalCount) * 100;

  // Weighted average: 70% current mastery, 30% session performance
  // But apply a difficulty multiplier
  const avgDifficultyBonus = sessionResults.reduce((acc, r) => {
    const bonus = r.difficulty === 'hard' ? 1.2 : r.difficulty === 'medium' ? 1.0 : 0.8;
    return acc + bonus;
  }, 0) / sessionResults.length;

  const adjustedSessionScore = sessionScore * avgDifficultyBonus;
  const newMastery = Math.round(currentMastery * 0.7 + adjustedSessionScore * 0.3);

  return Math.min(100, Math.max(0, newMastery));
}

// Create initial adaptive state
export function createInitialAdaptiveState(
  topic: string,
  subtopic: string | null,
  initialDifficulty: 'easy' | 'medium' | 'hard'
): AdaptiveState {
  return {
    consecutiveMisses: 0,
    currentDifficulty: initialDifficulty,
    socraticMode: false,
    currentTopic: topic,
    currentSubtopic: subtopic,
    questionHistory: [],
  };
}
