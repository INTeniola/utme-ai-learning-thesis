import { supabase } from '@/integrations/supabase/client';
import { calculateMastery, calculateSM2 } from '@/lib/spacedRepetition';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { queryCache } from '@/lib/queryCache';

export interface Flashcard {
  id: string;
  user_id: string;
  front_text: string;
  back_text: string;
  subject: string;
  topic: string;
  source: string;
  source_reference: string | null;
  source_question_id: string | null;
  easiness_factor: number;
  interval_days: number;
  repetitions: number;
  next_review_date: string;
  last_reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FlashcardStats {
  totalCards: number;
  dueToday: number;
  masteredCards: number;
  masteryPercentage: number;
  reviewStreak: number;
  subjectBreakdown: Record<string, { total: number; due: number; mastered: number }>;
}

export interface CreateFlashcardInput {
  front_text: string;
  back_text: string;
  subject: string;
  topic: string;
  source?: string;
  source_reference?: string;
  source_question_id?: string;
}

/**
 * Core function: useFlashcards
 *  * 
 *  * **Side Effects:** Interacts with Supabase or external APIs.
 *  * @returns {any} The expected output
 */
export function useFlashcards() {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [dueCards, setDueCards] = useState<Flashcard[]>([]);
  const [stats, setStats] = useState<FlashcardStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Get user ID on mount
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUserId(session?.user?.id || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch all cards
  /**
     * Action handler: fetchCards
     *  * 
     *  * **Side Effects:** Interacts with Supabase or external APIs.
     *  * @returns The expected return value based on function logic
     */
    const fetchCards = useCallback(async (filters?: { subject?: string; topic?: string }) => {
    if (!userId) return;
    
    setLoading(true);
    try {
      let query = supabase
        .from('flashcards')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (filters?.subject) {
        query = query.eq('subject', filters.subject);
      }
      if (filters?.topic) {
        query = query.eq('topic', filters.topic);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      setCards(data || []);
    } catch (error) {
      console.error('Error fetching flashcards:', error);
      toast.error('Failed to load flashcards');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Fetch due cards
  /**
     * Action handler: fetchDueCards
     *  * 
     *  * **Side Effects:** Interacts with Supabase or external APIs.
     *  * @returns The expected return value based on function logic
     */
    const fetchDueCards = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('flashcards')
        .select('*')
        .eq('user_id', userId)
        .lte('next_review_date', today)
        .order('next_review_date', { ascending: true });

      if (error) throw error;
      setDueCards(data || []);
    } catch (error) {
      console.error('Error fetching due cards:', error);
      toast.error('Failed to load due cards');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Fetch stats
  /**
     * Action handler: fetchStats
     *  * 
     *  * **Side Effects:** Interacts with Supabase or external APIs.
     *  * @returns The expected return value based on function logic
     */
    const fetchStats = useCallback(async () => {
    if (!userId) return;

    try {
      const { data: allCards, error } = await supabase
        .from('flashcards')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;

      const today = new Date().toISOString().split('T')[0];
      const dueToday = (allCards || []).filter(c => c.next_review_date <= today).length;
      const masteredCards = (allCards || []).filter(c => 
        calculateMastery(Number(c.easiness_factor), c.repetitions) >= 80
      ).length;

      // Calculate subject breakdown
      const subjectBreakdown: Record<string, { total: number; due: number; mastered: number }> = {};
      (allCards || []).forEach(card => {
        if (!subjectBreakdown[card.subject]) {
          subjectBreakdown[card.subject] = { total: 0, due: 0, mastered: 0 };
        }
        subjectBreakdown[card.subject].total++;
        if (card.next_review_date <= today) {
          subjectBreakdown[card.subject].due++;
        }
        if (calculateMastery(Number(card.easiness_factor), card.repetitions) >= 80) {
          subjectBreakdown[card.subject].mastered++;
        }
      });

      // Get review streak from profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('current_streak')
        .eq('id', userId)
        .single();

      setStats({
        totalCards: allCards?.length || 0,
        dueToday,
        masteredCards,
        masteryPercentage: allCards?.length ? Math.round((masteredCards / allCards.length) * 100) : 0,
        reviewStreak: profile?.current_streak || 0,
        subjectBreakdown,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, [userId]);

  // Create a new flashcard
  /**
     * Action handler: createCard
     *  * 
     *  * **Side Effects:** Interacts with Supabase or external APIs.
     *  * @returns The expected return value based on function logic
     */
    const createCard = useCallback(async (input: CreateFlashcardInput): Promise<Flashcard | null> => {
    if (!userId) {
      toast.error('Please sign in to create flashcards');
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('flashcards')
        .insert({
          user_id: userId,
          front_text: input.front_text,
          back_text: input.back_text,
          subject: input.subject,
          topic: input.topic,
          source: input.source || 'manual',
          source_reference: input.source_reference,
          source_question_id: input.source_question_id,
        })
        .select()
        .single();

      if (error) throw error;
      
      toast.success('Flashcard created!');
      await fetchCards();
      await fetchStats();

      // Phase 14: Invalidate dashboard for live updates
      if (userId) {
        queryCache.invalidate(`home:subjects:${userId}`);
        queryCache.invalidate(`readiness:${userId}`);
      }
      return data;
    } catch (error) {
      console.error('Error creating flashcard:', error);
      toast.error('Failed to create flashcard');
      return null;
    }
  }, [userId, fetchCards, fetchStats]);

  // Create flashcards from quiz mistakes
  /**
     * Action handler: createFromQuizMistakes
     *  * 
     *  * **Side Effects:** Interacts with Supabase or external APIs.
     *  * @returns The expected return value based on function logic
     */
    const createFromQuizMistakes = useCallback(async (quizResultId: string): Promise<number> => {
    if (!userId) {
      toast.error('Please sign in to create flashcards');
      return 0;
    }

    try {
      // Fetch the quiz result
      const { data: quizResult, error: quizError } = await supabase
        .from('quiz_results')
        .select('*, quizzes(subject)')
        .eq('id', quizResultId)
        .single();

      if (quizError) throw quizError;

      // Get wrong answers from the answers JSON
      const answers = quizResult.answers as Record<string, { selected: string; correct: string; question: string; explanation?: string; topic?: string }>;
      const wrongAnswers = Object.entries(answers || {}).filter(
        ([_, answer]) => answer.selected !== answer.correct
      );

      if (wrongAnswers.length === 0) {
        toast.info('No wrong answers to create flashcards from');
        return 0;
      }

      // Create flashcards for each wrong answer
      const flashcards = wrongAnswers.map(([questionId, answer]) => ({
        user_id: userId,
        front_text: answer.question || 'Question not available',
        back_text: `Correct answer: ${answer.correct}\n\n${answer.explanation || 'Review this concept for better understanding.'}`,
        subject: quizResult.quizzes?.subject || 'General',
        topic: answer.topic || 'General',
        source: 'quiz_mistake',
        source_reference: `Quiz mistake from ${new Date(quizResult.completed_at).toLocaleDateString()}`,
        source_question_id: questionId,
      }));

      const { error: insertError } = await supabase
        .from('flashcards')
        .insert(flashcards);

      if (insertError) throw insertError;

      toast.success(`Created ${flashcards.length} flashcards from quiz mistakes!`);
      await fetchCards();
      await fetchStats();
      return flashcards.length;
    } catch (error) {
      console.error('Error creating flashcards from mistakes:', error);
      toast.error('Failed to create flashcards from quiz');
      return 0;
    }
  }, [userId, fetchCards, fetchStats]);

  // Review a card (apply SM-2 algorithm)
  /**
     * Action handler: reviewCard
     *  * 
     *  * **Side Effects:** Interacts with Supabase or external APIs.
     *  * @returns The expected return value based on function logic
     */
    const reviewCard = useCallback(async (
    cardId: string,
    rating: number,
    timeToRecallMs?: number
  ): Promise<boolean> => {
    if (!userId) return false;

    try {
      // Get the current card
      const { data: card, error: fetchError } = await supabase
        .from('flashcards')
        .select('*')
        .eq('id', cardId)
        .single();

      if (fetchError) throw fetchError;

      // Calculate new SM-2 values
      const result = calculateSM2({
        easinessFactor: Number(card.easiness_factor),
        intervalDays: card.interval_days,
        repetitions: card.repetitions,
        rating,
      });

      // Update the flashcard
      const { error: updateError } = await supabase
        .from('flashcards')
        .update({
          easiness_factor: result.easinessFactor,
          interval_days: result.intervalDays,
          repetitions: result.repetitions,
          next_review_date: result.nextReviewDate.toISOString().split('T')[0],
          last_reviewed_at: new Date().toISOString(),
        })
        .eq('id', cardId);

      if (updateError) throw updateError;

      // Save the review record
      const { error: reviewError } = await supabase
        .from('flashcard_reviews')
        .insert({
          flashcard_id: cardId,
          user_id: userId,
          rating,
          time_to_recall_ms: timeToRecallMs,
        });

      if (reviewError) throw reviewError;

      // Update due cards list
      setDueCards(prev => prev.filter(c => c.id !== cardId));
      
      // Phase 14: Invalidate dashboard for live updates
      queryCache.invalidate(`home:subjects:${userId}`);
      queryCache.invalidate(`readiness:${userId}`);

      return true;
    } catch (error) {
      console.error('Error reviewing card:', error);
      toast.error('Failed to save review');
      return false;
    }
  }, [userId]);

  // Delete a flashcard
  /**
     * Action handler: deleteCard
     *  * 
     *  * **Side Effects:** Interacts with Supabase or external APIs.
     *  * @returns The expected return value based on function logic
     */
    const deleteCard = useCallback(async (cardId: string): Promise<boolean> => {
    if (!userId) return false;

    try {
      const { error } = await supabase
        .from('flashcards')
        .delete()
        .eq('id', cardId)
        .eq('user_id', userId);

      if (error) throw error;

      toast.success('Flashcard deleted');
      setCards(prev => prev.filter(c => c.id !== cardId));
      setDueCards(prev => prev.filter(c => c.id !== cardId));
      await fetchStats();

      // Phase 14: Invalidate dashboard for live updates
      queryCache.invalidate(`home:subjects:${userId}`);
      queryCache.invalidate(`readiness:${userId}`);
      return true;
    } catch (error) {
      console.error('Error deleting flashcard:', error);
      toast.error('Failed to delete flashcard');
      return false;
    }
  }, [userId, fetchStats]);

  // Initial fetch
  useEffect(() => {
    if (userId) {
      fetchCards();
      fetchDueCards();
      fetchStats();
    }
  }, [userId, fetchCards, fetchDueCards, fetchStats]);

  return {
    cards,
    dueCards,
    stats,
    loading,
    fetchCards,
    fetchDueCards,
    fetchStats,
    createCard,
    createFromQuizMistakes,
    reviewCard,
    deleteCard,
  };
}
