/**
 * useSubjectReadiness
 * Calculates a 0-100 readiness score for a given subject from four data sources:
 *   • Quiz performance (up to 50 pts) — exponentially weighted rolling average
 *   • Topic coverage breadth (up to 25 pts) — % of attempted topics in syllabus
 *   • Consistency (up to 15 pts) — recency of last study session, -pts for long gaps
 *   • Flashcard retention (up to 10 pts) — % of mastered cards for this subject
 *
 * Sources that have no data yet are excluded and the remaining points are scaled
 * proportionally so the bar always shows something meaningful.
 */
import { supabase } from "@/integrations/supabase/client";
import { calculateMastery } from "@/lib/spacedRepetition";
import { differenceInDays } from "date-fns";
import { useEffect, useState } from "react";

// UTME syllabus topic counts per subject (approximate; used for coverage breadth)
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

export interface ReadinessResult {
    score: number;          // 0–100
    explanation: string;   // primary factor description
    colorClass: string;    // Tailwind text-colour for the score
    barColorClass: string; // Tailwind bg-colour for the progress bar fill
    loading: boolean;
}

export function useSubjectReadiness(
    userId: string | null | undefined,
    subjectId: string
): ReadinessResult {
    const [result, setResult] = useState<ReadinessResult>({
        score: 0,
        explanation: "Calculating…",
        colorClass: "text-muted-foreground",
        barColorClass: "bg-muted",
        loading: true,
    });

    useEffect(() => {
        if (!userId || !subjectId) return;

        let cancelled = false;

        async function calculate() {
            try {
                // ─── 1  Quiz performance (up to 50 pts) ────────────────────────────
                const { data: examRows } = await supabase
                    .from("exam_logs")
                    .select("is_correct, created_at")
                    .eq("user_id", userId as string)
                    .eq("subject", subjectId)
                    .order("created_at", { ascending: false })
                    .limit(20);

                let quizPoints: number | null = null;
                let quizExplanation = "";

                if (examRows && examRows.length > 0) {
                    // Exponential weighting — most recent attempt has weight 1, each older
                    // step halves the weight. We use at most the last 10 attempts.
                    const recent = examRows.slice(0, 10);
                    let weightedSum = 0;
                    let totalWeight = 0;
                    recent.forEach((row, idx) => {
                        const w = Math.pow(0.75, idx); // decay factor
                        weightedSum += w * (row.is_correct ? 1 : 0);
                        totalWeight += w;
                    });
                    const weightedAvg = totalWeight > 0 ? weightedSum / totalWeight : 0;
                    quizPoints = Math.round(weightedAvg * 50);

                    const pct = Math.round(weightedAvg * 100);
                    if (pct >= 80) quizExplanation = "Strong recent performance";
                    else if (pct >= 60) quizExplanation = "Solid quiz scores";
                    else if (pct >= 40) quizExplanation = "Quiz scores need improvement";
                    else quizExplanation = "Low quiz performance — needs practice";
                }

                // ─── 2  Topic coverage breadth (up to 25 pts) ─────────────────────
                const { data: masteryRows } = await supabase
                    .from("concept_mastery")
                    .select("topic")
                    .eq("user_id", userId as string)
                    .eq("subject", subjectId);

                let coveragePoints: number | null = null;
                let coverageExplanation = "";

                if (masteryRows !== null) {
                    const uniqueTopics = new Set(masteryRows.map((r) => r.topic)).size;
                    const syllabusTopics = SYLLABUS_TOPIC_COUNTS[subjectId] ?? 15;
                    const coveragePct = Math.min(1, uniqueTopics / syllabusTopics);
                    coveragePoints = Math.round(coveragePct * 25);

                    if (coveragePct >= 0.9) coverageExplanation = "Excellent topic coverage";
                    else if (coveragePct >= 0.6) coverageExplanation = `${uniqueTopics} of ~${syllabusTopics} topics attempted`;
                    else if (coveragePct > 0) coverageExplanation = `Only ${uniqueTopics} of ~${syllabusTopics} topics attempted`;
                    else coverageExplanation = "No topics attempted yet";
                }

                // ─── 3  Consistency (up to 15 pts) ────────────────────────────────
                const { data: sessions } = await supabase
                    .from("study_sessions")
                    .select("started_at")
                    .eq("user_id", userId as string)
                    .order("started_at", { ascending: false })
                    .limit(1);

                // Also check exam_logs for any recent activity on this specific subject
                const { data: recentExamActivity } = await supabase
                    .from("exam_logs")
                    .select("created_at")
                    .eq("user_id", userId as string)
                    .eq("subject", subjectId)
                    .order("created_at", { ascending: false })
                    .limit(1);

                let consistencyPoints: number | null = null;
                let consistencyExplanation = "";

                const lastSessionDate = sessions?.[0]?.started_at
                    ? new Date(sessions[0].started_at)
                    : null;
                const lastSubjectDate = recentExamActivity?.[0]?.created_at
                    ? new Date(recentExamActivity[0].created_at)
                    : null;

                // Use whichever is more recent
                const lastActive =
                    lastSessionDate && lastSubjectDate
                        ? lastSessionDate > lastSubjectDate ? lastSessionDate : lastSubjectDate
                        : lastSessionDate ?? lastSubjectDate;

                if (lastActive) {
                    const daysSince = differenceInDays(new Date(), lastActive);
                    if (daysSince === 0) {
                        consistencyPoints = 15;
                        consistencyExplanation = "Practiced today";
                    } else if (daysSince <= 3) {
                        consistencyPoints = 15;
                        consistencyExplanation = `Practiced ${daysSince} day${daysSince > 1 ? "s" : ""} ago`;
                    } else if (daysSince <= 7) {
                        const decay = 1 - (daysSince - 3) / 4; // fades from 1 → 0 over 3–7 days
                        consistencyPoints = Math.round(decay * 15);
                        consistencyExplanation = `No practice in ${daysSince} days`;
                    } else {
                        consistencyPoints = 0;
                        consistencyExplanation = `No practice in ${daysSince} days`;
                    }
                }

                // ─── 4  Flashcard retention (up to 10 pts) ────────────────────────
                const { data: flashcardRows } = await supabase
                    .from("flashcards")
                    .select("easiness_factor, repetitions")
                    .eq("user_id", userId as string)
                    .eq("subject", subjectId);

                let flashcardPoints: number | null = null;
                let flashcardExplanation = "";

                if (flashcardRows && flashcardRows.length > 0) {
                    const mastered = flashcardRows.filter(
                        (c) => calculateMastery(Number(c.easiness_factor), c.repetitions) >= 80
                    ).length;
                    const masteryPct = mastered / flashcardRows.length;
                    flashcardPoints = Math.round(masteryPct * 10);

                    if (masteryPct >= 0.8) flashcardExplanation = "High flashcard retention";
                    else if (masteryPct > 0) flashcardExplanation = `${mastered}/${flashcardRows.length} cards mastered`;
                    else flashcardExplanation = "No flashcards mastered yet";
                }

                if (cancelled) return;

                // ─── Proportional scaling for missing data sources ─────────────────
                const sources: { pts: number | null; maxPts: number; explanation: string }[] = [
                    { pts: quizPoints, maxPts: 50, explanation: quizExplanation },
                    { pts: coveragePoints, maxPts: 25, explanation: coverageExplanation },
                    { pts: consistencyPoints, maxPts: 15, explanation: consistencyExplanation },
                    { pts: flashcardPoints, maxPts: 10, explanation: flashcardExplanation },
                ];

                const available = sources.filter((s) => s.pts !== null);
                const totalMaxAvailable = available.reduce((s, x) => s + x.maxPts, 0);
                const rawScore = available.reduce((s, x) => s + (x.pts ?? 0), 0);

                // Scale so missing sources don't artificially cap the score at < 100
                const scaledScore = totalMaxAvailable > 0
                    ? Math.round((rawScore / totalMaxAvailable) * 100)
                    : 0;

                const finalScore = Math.max(0, Math.min(100, scaledScore));

                // Pick primary explanation: the source with the lowest contribution relative to its max
                // (i.e., the weakest link), unless consistency is severely off.
                const consistencySrc = sources[2];
                let primaryExplanation = "Building readiness";

                if (
                    consistencySrc.pts !== null &&
                    consistencySrc.pts === 0 &&
                    consistencySrc.explanation.startsWith("No practice")
                ) {
                    primaryExplanation = consistencySrc.explanation;
                } else if (available.length > 0) {
                    // Pick the source with the worst ratio vs its max
                    const worst = [...available].sort(
                        (a, b) => (a.pts ?? 0) / a.maxPts - (b.pts ?? 0) / b.maxPts
                    )[0];
                    primaryExplanation = worst.explanation || "Keep practicing";
                    // If score is high, lead with the best
                    if (finalScore >= 70) {
                        const best = [...available].sort(
                            (a, b) => (b.pts ?? 0) / b.maxPts - (a.pts ?? 0) / a.maxPts
                        )[0];
                        primaryExplanation = best.explanation || "Strong performance";
                    }
                }

                // Colour
                const colorClass =
                    finalScore >= 70
                        ? "text-green-500"
                        : finalScore >= 40
                            ? "text-amber-500"
                            : "text-red-500";

                const barColorClass =
                    finalScore >= 70
                        ? "bg-green-500"
                        : finalScore >= 40
                            ? "bg-amber-500"
                            : "bg-red-500";

                setResult({
                    score: finalScore,
                    explanation: primaryExplanation,
                    colorClass,
                    barColorClass,
                    loading: false,
                });
            } catch (err) {
                console.error("[useSubjectReadiness]", err);
                if (!cancelled) {
                    setResult((prev) => ({ ...prev, loading: false, explanation: "Unable to load readiness" }));
                }
            }
        }

        setResult((prev) => ({ ...prev, loading: true }));
        calculate();

        return () => {
            cancelled = true;
        };
    }, [userId, subjectId]);

    return result;
}
