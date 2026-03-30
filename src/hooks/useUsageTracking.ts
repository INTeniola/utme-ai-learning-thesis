import { supabase } from '@/integrations/supabase/client';
import { useCallback } from 'react';
import { toast } from 'sonner';

interface QuotaCheck {
    allowed: boolean;
    remaining: number;
    limit: number;
}

export const useUsageTracking = () => {
    /**
     * Check if user has remaining quota for AI features
     */
    const checkQuota = useCallback(async (userId: string): Promise<QuotaCheck> => {
        try {
            // Get user's quota limit from profile
            const { data: profile } = await supabase
                .from('profiles')
                .select('daily_ai_quota, is_premium')
                .eq('id', userId)
                .single();

            const limit = profile?.is_premium ? 999999 : (profile?.daily_ai_quota || 50);

            // Get today's usage count
            const { data: usageData, error } = await supabase
                .rpc('get_daily_usage_count', { p_user_id: userId });

            if (error) {
                console.error('Error checking quota:', error);
                // Fail open - allow request if we can't check quota
                return { allowed: true, remaining: limit, limit };
            }

            const usedToday = usageData || 0;
            const remaining = Math.max(0, limit - usedToday);

            return {
                allowed: usedToday < limit,
                remaining,
                limit
            };
        } catch (error) {
            console.error('Quota check failed:', error);
            // Fail open
            return { allowed: true, remaining: 50, limit: 50 };
        }
    }, []);

    /**
     * Log AI usage to database
     */
    const logUsage = useCallback(async (
        userId: string,
        featureType: 'ai_tutor' | 'quiz_generation' | 'flashcard_creation' | 'cbt_exam' | 'concept_generator',
        tokensEstimated: number = 0
    ): Promise<void> => {
        try {
            await supabase.from('ai_usage_logs').insert({
                user_id: userId,
                feature_type: featureType,
                tokens_estimated: tokensEstimated
            });
        } catch (error) {
            console.error('Failed to log usage:', error);
            // Don't throw - logging failure shouldn't block the user
        }
    }, []);

    /**
     * Show quota warning to user
     */
    const showQuotaWarning = useCallback((remaining: number, limit: number) => {
        if (remaining <= 5 && remaining > 0) {
            toast.warning(`You have ${remaining} AI requests remaining today.`);
        } else if (remaining === 0) {
            toast.error(`Daily limit reached (${limit} requests). Upgrade to Premium for unlimited access.`);
        }
    }, []);

    return {
        checkQuota,
        logUsage,
        showQuotaWarning
    };
};
