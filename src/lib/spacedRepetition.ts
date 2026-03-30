/**
 * Simplified SM-2 Spaced Repetition Algorithm
 * 
 * Rating scale:
 * 0 - Again (didn't know): Reset to 1 day
 * 1 - Hard (struggled): Multiply by 1.2, min 3 days
 * 2 - Good (got it): Multiply by 2.5, min 7 days  
 * 3 - Good+ (solid recall): Multiply by 2.5, min 7 days
 * 4 - Easy (instant recall): Multiply by 3.0, min 14 days
 */

export interface SM2Result {
  easinessFactor: number;
  intervalDays: number;
  repetitions: number;
  nextReviewDate: Date;
}

export interface SM2Input {
  easinessFactor: number;
  intervalDays: number;
  repetitions: number;
  rating: number; // 0-4
}

export const RATING_LABELS = {
  0: { label: 'Hard', color: 'text-red-600 bg-red-50', description: "Didn't know" },
  2: { label: 'Good', color: 'text-green-600 bg-green-50', description: 'Got it' },
  4: { label: 'Easy', color: 'text-blue-600 bg-blue-50', description: 'Instant recall' },
} as const;

/**
 * Calculate next review parameters using SM-2 algorithm
 */
export function calculateSM2(input: SM2Input): SM2Result {
  const { rating } = input;
  let { easinessFactor, intervalDays, repetitions } = input;

  // Calculate new easiness factor
  // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  // where q is the quality of response (0-4)
  const newEF = Math.max(
    1.3,
    easinessFactor + (0.1 - (4 - rating) * (0.08 + (4 - rating) * 0.02))
  );

  let newInterval: number;
  let newRepetitions: number;

  if (rating < 2) {
    // Failed response - reset
    newRepetitions = 0;
    if (rating === 0) {
      // Again - reset to 1 day
      newInterval = 1;
    } else {
      // Hard - minimum 3 days or slight increase
      newInterval = Math.max(3, Math.ceil(intervalDays * 1.2));
    }
  } else {
    // Successful response
    newRepetitions = repetitions + 1;

    if (newRepetitions === 1) {
      newInterval = 1;
    } else if (newRepetitions === 2) {
      newInterval = 6;
    } else {
      // Calculate interval based on rating
      let multiplier: number;
      if (rating === 4) {
        multiplier = 3.0;
        newInterval = Math.max(14, Math.ceil(intervalDays * multiplier * newEF));
      } else {
        multiplier = 2.5;
        newInterval = Math.max(7, Math.ceil(intervalDays * multiplier * newEF));
      }
    }
  }

  // Calculate next review date
  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + newInterval);

  return {
    easinessFactor: Math.round(newEF * 100) / 100,
    intervalDays: newInterval,
    repetitions: newRepetitions,
    nextReviewDate,
  };
}

/**
 * Get simplified interval preview for a rating
 */
export function getIntervalPreview(rating: number, currentInterval: number): string {
  switch (rating) {
    case 0:
      return '1d';
    case 1:
      return `${Math.max(3, Math.ceil(currentInterval * 1.2))}d`;
    case 2:
    case 3:
      return `${Math.max(7, Math.ceil(currentInterval * 2.5))}d`;
    case 4:
      return `${Math.max(14, Math.ceil(currentInterval * 3.0))}d`;
    default:
      return '?d';
  }
}

/**
 * Check if a card is due for review
 */
export function isCardDue(nextReviewDate: Date | string): boolean {
  const reviewDate = new Date(nextReviewDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  reviewDate.setHours(0, 0, 0, 0);
  return reviewDate <= today;
}

/**
 * Get days until next review
 */
export function getDaysUntilReview(nextReviewDate: Date | string): number {
  const reviewDate = new Date(nextReviewDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  reviewDate.setHours(0, 0, 0, 0);
  const diffTime = reviewDate.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Calculate mastery percentage based on easiness factor and repetitions
 */
export function calculateMastery(easinessFactor: number, repetitions: number): number {
  // Mastery increases with repetitions and easiness factor
  // Max mastery at ~8 repetitions with high EF
  const repScore = Math.min(repetitions / 8, 1) * 60;
  const efScore = ((easinessFactor - 1.3) / (3.0 - 1.3)) * 40;
  return Math.min(100, Math.round(repScore + efScore));
}
