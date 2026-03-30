import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('/Users/pc/Projects/adaptive-learning-core', '.env.local') });
dotenv.config({ path: path.resolve('/Users/pc/Projects/adaptive-learning-core', '.env') });

const url = process.env.VITE_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(url, key);

async function main() {
    const { data, error } = await supabase
        .from('past_questions')
        .select('year')
        .gte('year', 1980)
        .lte('year', 2026);

    if (error) {
        console.error(error);
        return;
    }

    const counts: Record<number, number> = {};
    for (const row of data) {
        counts[row.year] = (counts[row.year] || 0) + 1;
    }

    const years = Object.keys(counts).map(Number).sort((a, b) => b - a);
    let total2017Plus = 0;
    for (const year of years) {
        console.log(`${year}: ${counts[year]}`);
        if (year >= 2017) {
            total2017Plus += counts[year];
        }
    }

    console.log(`\nTotal questions 2017 and newer: ${total2017Plus}`);
}

main().catch(console.error);
