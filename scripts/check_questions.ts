import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'path';

config({ path: path.resolve('/Users/pc/Projects/adaptive-learning-core', '.env') });
config({ path: path.resolve('/Users/pc/Projects/adaptive-learning-core', '.env.local') });

const url = process.env.VITE_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(url, key);

async function main() {
    const { count: total } = await supabase
        .from('past_questions')
        .select('*', { count: 'exact', head: true });
    console.log('Total questions:', total);

    const subjects = ['Biology', 'Chemistry', 'Physics', 'Mathematics', 'Government', 'English', 'Literature', 'Economics'];
    for (const s of subjects) {
        const { count } = await supabase
            .from('past_questions')
            .select('*', { count: 'exact', head: true })
            .ilike('subject', `%${s}%`);
        console.log(`  ${s}: ${count}`);
    }
}

main().catch(console.error);
