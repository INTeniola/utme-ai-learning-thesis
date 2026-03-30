/**
 * useLeaderboard
 *
 * Data hook for the leaderboard. Computes rankings from real exam_sessions data.
 *
 * Score formula: best single mock exam score per user (out of 400).
 * Rationale: peak UTME readiness, not rewarding time-online.
 *
 * Architecture:
 *  1. Fetch all valid exam_sessions in one query (no per-user pagination issues)
 *  2. Group by user_id client-side to find each user's best score
 *  3. Sort descending → assigns rank
 *  4. Fetch usernames for the top-20 users in a second parallel query
 *  5. Cache for 5 minutes (leaderboard doesn't need real-time precision)
 */
import { supabase } from '@/integrations/supabase/client';
import { queryCache } from '@/lib/queryCache';
import { useCallback, useEffect, useState } from 'react';

export interface LeaderboardEntry {
    rank: number;
    userId: string;
    username: string;
    score: number;
    totalQuestions: number;
    isCurrentUser: boolean;
}

export interface CurrentUserRank {
    rank: number;
    score: number;
    totalQuestions: number;
    percentile: number; // 0–100, higher is better
}

export interface LeaderboardData {
    top20: LeaderboardEntry[];
    currentUserRank: CurrentUserRank | null;
    /** True when current user is already within the top 20 */
    currentUserInTop20: boolean;
    totalUsers: number;
}

const LEADERBOARD_TTL = 5 * 60 * 1000; // 5 minutes

export function useLeaderboard(userId?: string) {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<LeaderboardData | null>(null);
    const [error, setError] = useState<string | null>(null);

    const fetchLeaderboard = useCallback(async () => {
        if (!userId) {
            setLoading(false);
            return;
        }

        const cacheKey = `leaderboard:${userId}`;
        const cached = queryCache.get<LeaderboardData>(cacheKey, LEADERBOARD_TTL);
        if (cached) {
            setData(cached);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // ── Step 1: Fetch all valid exam sessions ──────────────────────────────
            // We fetch all sessions and group client-side so we get one row per user
            // with their best score, regardless of how many sessions they've done.
            const { data: sessions, error: sessErr } = await supabase
                .from('exam_sessions')
                .select('user_id, score, total_questions')
                .gt('total_questions', 0)
                .order('score', { ascending: false });

            if (sessErr) throw sessErr;

            if (!sessions || sessions.length === 0) {
                const emptyResult: LeaderboardData = {
                    top20: [],
                    currentUserRank: null,
                    currentUserInTop20: false,
                    totalUsers: 0,
                };
                queryCache.set(cacheKey, emptyResult);
                setData(emptyResult);
                setLoading(false);
                return;
            }

            // ── Step 2: Compute best score per user ────────────────────────────────
            const bestByUser = new Map<string, { score: number; totalQuestions: number }>();
            for (const row of sessions) {
                const existing = bestByUser.get(row.user_id);
                if (!existing || row.score > existing.score) {
                    bestByUser.set(row.user_id, {
                        score: row.score,
                        totalQuestions: row.total_questions,
                    });
                }
            }

            // ── Step 3: Sort and rank ──────────────────────────────────────────────
            const ranked = [...bestByUser.entries()]
                .sort((a, b) => b[1].score - a[1].score)
                .map(([uid, { score, totalQuestions }], idx) => ({
                    userId: uid,
                    score,
                    totalQuestions,
                    rank: idx + 1,
                }));

            const totalUsers = ranked.length;

            // ── Step 4: Top 20 user IDs → fetch usernames ─────────────────────────
            const top20Ranked = ranked.slice(0, 20);
            const top20UserIds = top20Ranked.map(e => e.userId);

            const { data: profiles, error: profErr } = await supabase
                .from('profiles')
                .select('id, full_name')
                .in('id', top20UserIds);

            if (profErr) throw profErr;

            const usernameMap = new Map((profiles ?? []).map(p => [p.id, p.full_name as string | null]));

            // ── Step 5: Build top20 entries ────────────────────────────────────────
            const top20: LeaderboardEntry[] = top20Ranked.map(entry => ({
                rank: entry.rank,
                userId: entry.userId,
                username: usernameMap.get(entry.userId) || `user_${entry.userId.slice(0, 6)}`,
                score: entry.score,
                totalQuestions: entry.totalQuestions,
                isCurrentUser: entry.userId === userId,
            }));

            // ── Step 6: Current user rank (may be inside or outside top 20) ────────
            const currentUserRanked = ranked.find(e => e.userId === userId);
            const currentUserInTop20 = top20.some(e => e.isCurrentUser);

            let currentUserRank: CurrentUserRank | null = null;
            if (currentUserRanked) {
                // Percentile: what % of users they score above (higher = better)
                const percentile = totalUsers > 1
                    ? Math.round((1 - (currentUserRanked.rank - 1) / totalUsers) * 100)
                    : 100;
                currentUserRank = {
                    rank: currentUserRanked.rank,
                    score: currentUserRanked.score,
                    totalQuestions: currentUserRanked.totalQuestions,
                    percentile,
                };
            }

            const result: LeaderboardData = {
                top20,
                currentUserRank,
                currentUserInTop20,
                totalUsers,
            };

            queryCache.set(cacheKey, result);
            setData(result);
        } catch (err: unknown) {
            console.error('[useLeaderboard]', err);
            setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        fetchLeaderboard();
    }, [fetchLeaderboard]);

    return { loading, data, error, refresh: fetchLeaderboard };
}
