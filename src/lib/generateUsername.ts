/**
 * Generates a Fremen-inspired username for new users.
 * Format: word_word_NNN  e.g. "stilgar_wind_429", "naib_storm_071"
 * Checks for collisions against existing usernames in Supabase before returning.
 */
import { supabase } from "@/integrations/supabase/client";

const FREMEN_WORDS = [
    // Titles & names
    "naib", "stilgar", "chani", "usul", "muad", "fedaykin", "zensunni",
    "shadout", "sayan", "liet", "jamis", "otheym", "harah",
    // Desert concepts & objects
    "sietch", "thumper", "maker", "worm", "sand", "dune", "spice",
    "crysknife", "fremkit", "stillsuit", "windtrap", "qanat", "bled",
    "naibs", "shai", "hulud", "tau", "gom", "jabbar",
];

function pickRandom(arr: string[]): string {
    return arr[Math.floor(Math.random() * arr.length)];
}

function buildCandidate(): string {
    const a = pickRandom(FREMEN_WORDS);
    let b = pickRandom(FREMEN_WORDS);
    // Prevent the same word twice
    while (b === a) b = pickRandom(FREMEN_WORDS);
    const num = String(Math.floor(Math.random() * 900) + 100); // 100-999
    return `${a}_${b}_${num}`;
}

export async function generateUniqueUsername(maxAttempts = 10): Promise<string> {
    for (let i = 0; i < maxAttempts; i++) {
        const candidate = buildCandidate();

        // Check uniqueness against profiles.username column
        // `as unknown as ...` breaks TS2589 (excessively deep type instantiation in Supabase generics)
        type QueryResult = { data: { id: string } | null; error: { message: string } | null };
        const { data, error } = await (supabase
            .from("profiles")
            .select("id")
            .eq("username", candidate)
            .maybeSingle() as unknown as Promise<QueryResult>);

        if (error) {
            // If the column doesn't exist yet or query fails, just return the candidate
            console.warn("Username uniqueness check failed:", error.message);
            return candidate;
        }

        if (!data) {
            // No collision — this username is free
            return candidate;
        }
        // Collision — try again
    }
    // Fallback: append a timestamp suffix to guarantee uniqueness
    return `${buildCandidate()}_${Date.now().toString(36)}`;
}
