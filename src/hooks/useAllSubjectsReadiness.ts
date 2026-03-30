/**
 * useAllSubjectsReadiness
 *
 * Replaces N×5 individual useSubjectReadiness calls with 2 parallel queries
 * that fetch data for ALL subjects at once, then compute readiness scores
 * client-side.
 *
 * Query count comparison:
 *   Before: 5 queries × N subjects = 20 queries for 4 subjects
 *   After:  4 parallel queries total, regardless of subject count
 *
 * Results are cached for 60s so Back navigation is instant.
 */
import { supabase } from "@/integrations/supabase/client";
import { queryCache } from "@/lib/queryCache";
import { calculateMastery } from "@/lib/spacedRepetition";
import { differenceInDays } from "date-fns";
import { useEffect, useState } from "react";

const SYLLABUS_TOPIC_COUNTS: Record<string, number> = {
    english: 12,
    mathematics: 18,
    physics: 16,
    chemistry: 15,
    biology: 18,
    geography: 14,
    government: 16,
    economics: 15,
    literature: 10,
};

export interface ReadinessScore {
    score: number;
    explanation: string;
    colorClass: string;
    barColorClass: string;
}

export type ReadinessMap = Record<string, ReadinessScore>;

interface UseAllSubjectsReadinessResult {
    readinessMap: ReadinessMap;
    loading: boolean;
}

export function useAllSubjectsReadiness(
    userId: string | null | undefined,
    subjectIds: string[]
): UseAllSubjectsReadinessResult {
    const [readinessMap, setReadinessMap] = useState<ReadinessMap>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userId || subjectIds.length === 0) {
            setLoading(false);
            return;
        }

        let cancelled = false;

        async function calculate() {
            const cacheKey = `readiness:${userId}:${subjectIds.sort().join(",")}`;

            // Return cached result instantly
            const cached = queryCache.get<ReadinessMap>(cacheKey, 60_000);
            if (cached) {
                if (!cancelled) {
                    setReadinessMap(cached);
                    setLoading(false);
                }
                return;
            }

            try {
                // ── Single batch fetch for all subjects in parallel ────────────────
                const [examRes, masteryRes, sessionRes, flashRes] = await Promise.all([
                    // All exam logs across all subjects at once
                    supabase
                        .from("exam_logs")
                        .select("subject, is_correct, created_at")
                        .eq("user_id", userId as string)
                        .in("subject", subjectIds)
                        .order("created_at", { ascending: false })
                        .limit(200),

                    // All concept mastery rows across all subjects
                    supabase
                        .from("concept_mastery")
                        .select("subject, topic")
                        .eq("user_id", userId as string)
                        .in("subject", subjectIds),

                    // Most recent study session (any subject — for consistency check)
                    supabase
                        .from("study_sessions")
                        .select("started_at")
                        .eq("user_id", userId as string)
                        .order("started_at", { ascending: false })
                        .limit(1),

                    // All flashcards across all subjects
                    supabase
                        .from("flashcards")
                        .select("subject, easiness_factor, repetitions")
                        .eq("user_id", userId as string)
                        .in("subject", subjectIds),
                ]);

                if (cancelled) return;

                // ── Index raw data by subject ─────────────────────────────────────
                const examBySubject: Record<string, { is_correct: boolean; created_at: string }[]> = {};
                for (const row of examRes.data ?? []) {
                    if (!examBySubject[row.subject]) examBySubject[row.subject] = [];
                    examBySubject[row.subject].push(row);
                }

                const topicsBySubject: Record<string, Set<string>> = {};
                for (const row of masteryRes.data ?? []) {
                    if (!topicsBySubject[row.subject]) topicsBySubject[row.subject] = new Set();
                    topicsBySubject[row.subject].add(row.topic);
                }

                const lastSessionDate = sessionRes.data?.[0]?.started_at
                    ? new Date(sessionRes.data[0].started_at)
                    : null;

                const flashBySubject: Record<string, { easiness_factor: number; repetitions: number }[]> = {};
                for (const row of flashRes.data ?? []) {
                    if (!flashBySubject[row.subject]) flashBySubject[row.subject] = [];
                    flashBySubject[row.subject].push(row);
                }

                // ── Compute a score for each subject ───────────────────────────────
                const result: ReadinessMap = {};

                for (const subjectId of subjectIds) {
                    const rows = examBySubject[subjectId] ?? [];
                    const topics = topicsBySubject[subjectId] ?? new Set();
                    const flashcards = flashBySubject[subjectId] ?? [];

                    // 1. Quiz performance (up to 50 pts)
                    let quizPoints: number | null = null;
                    let quizExpl = "";
                    if (rows.length > 0) {
                        const recent = rows.slice(0, 10);
                        let wSum = 0, wTotal = 0;
                        recent.forEach((r, i) => {
                            const w = Math.pow(0.75, i);
                            wSum += w * (r.is_correct ? 1 : 0);
                            wTotal += w;
                        });
                        const avg = wTotal > 0 ? wSum / wTotal : 0;
                        quizPoints = Math.round(avg * 50);
                        const pct = Math.round(avg * 100);
                        if (pct >= 80) quizExpl = "Strong recent performance";
                        else if (pct >= 60) quizExpl = "Solid quiz scores";
                        else if (pct >= 40) quizExpl = "Quiz scores need improvement";
                        else quizExpl = "Low quiz performance";
                    }

                    // 2. Topic coverage (up to 25 pts)
                    let coveragePoints: number | null = null;
                    let coverageExpl = "";
                    const syllabusTopics = SYLLABUS_TOPIC_COUNTS[subjectId] ?? 15;
                    const uniqueTopics = topics.size;
                    // Always calculate — even 0 is valid data
                    const coveragePct = Math.min(1, uniqueTopics / syllabusTopics);
                    coveragePoints = Math.round(coveragePct * 25);
                    if (coveragePct >= 0.9) coverageExpl = "Excellent topic coverage";
                    else if (coveragePct >= 0.6) coverageExpl = `${uniqueTopics} of ~${syllabusTopics} topics attempted`;
                    else if (coveragePct > 0) coverageExpl = `Only ${uniqueTopics} of ~${syllabusTopics} topics`;
                    else coverageExpl = "No topics attempted yet";

                    // 3. Consistency (up to 15 pts) — use most recent exam activity for this subject
                    let consistencyPoints: number | null = null;
                    let consistencyExpl = "";
                    const lastExamForSubject = rows[0]?.created_at ? new Date(rows[0].created_at) : null;
                    const lastActive =
                        lastExamForSubject && lastSessionDate
                            ? lastExamForSubject > lastSessionDate ? lastExamForSubject : lastSessionDate
                            : lastExamForSubject ?? lastSessionDate;
                    if (lastActive) {
                        const days = differenceInDays(new Date(), lastActive);
                        if (days <= 3) {
                            consistencyPoints = 15;
                            consistencyExpl = days === 0 ? "Practiced today" : `Practiced ${days} day${days > 1 ? "s" : ""} ago`;
                        } else if (days <= 7) {
                            consistencyPoints = Math.round((1 - (days - 3) / 4) * 15);
                            consistencyExpl = `No practice in ${days} days`;
                        } else {
                            consistencyPoints = 0;
                            consistencyExpl = `No practice in ${days} days`;
                        }
                    }

                    // 4. Flashcard retention (up to 10 pts)
                    let flashPoints: number | null = null;
                    let flashExpl = "";
                    if (flashcards.length > 0) {
                        const mastered = flashcards.filter(
                            c => calculateMastery(Number(c.easiness_factor), c.repetitions) >= 80
                        ).length;
                        const pct = mastered / flashcards.length;
                        flashPoints = Math.round(pct * 10);
                        if (pct >= 0.8) flashExpl = "High flashcard retention";
                        else if (pct > 0) flashExpl = `${mastered}/${flashcards.length} cards mastered`;
                        else flashExpl = "No flashcards mastered yet";
                    }

                    // Proportional scaling
                    const sources = [
                        { pts: quizPoints, max: 50, expl: quizExpl },
                        { pts: coveragePoints, max: 25, expl: coverageExpl },
                        { pts: consistencyPoints, max: 15, expl: consistencyExpl },
                        { pts: flashPoints, max: 10, expl: flashExpl },
                    ];
                    const available = sources.filter(s => s.pts !== null);
                    const totalMax = available.reduce((s, x) => s + x.max, 0);
                    const raw = available.reduce((s, x) => s + (x.pts ?? 0), 0);
                    const score = totalMax > 0 ? Math.round(Math.min(100, Math.max(0, (raw / totalMax) * 100))) : 0;

                    // Primary explanation
                    let explanation = "Building readiness";
                    if (consistencyPoints === 0 && consistencyExpl.startsWith("No practice")) {
                        explanation = consistencyExpl;
                    } else if (available.length > 0) {
                        const worst = [...available].sort((a, b) => (a.pts ?? 0) / a.max - (b.pts ?? 0) / b.max)[0];
                        explanation = worst.expl || "Keep practicing";
                        if (score >= 70) {
                            const best = [...available].sort((a, b) => (b.pts ?? 0) / b.max - (a.pts ?? 0) / a.max)[0];
                            explanation = best.expl || "Strong performance";
                        }
                    }

                    const colorClass = score >= 70 ? "text-green-500" : score >= 40 ? "text-amber-500" : "text-red-500";
                    const barColorClass = score >= 70 ? "bg-green-500" : score >= 40 ? "bg-amber-500" : "bg-red-500";

                    result[subjectId] = { score, explanation, colorClass, barColorClass };
                }

                queryCache.set(cacheKey, result);

                if (!cancelled) {
                    setReadinessMap(result);
                    setLoading(false);
                }
            } catch (err) {
                console.error("[useAllSubjectsReadiness]", err);
                if (!cancelled) setLoading(false);
            }
        }

        setLoading(true);
        calculate();
        return () => { cancelled = true; };
    }, [userId, subjectIds.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

    return { readinessMap, loading };
}
