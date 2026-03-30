
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
    const { data, error } = await supabase
        .from('past_questions')
        .select('subject', { count: 'exact', head: true });

    // Group by subject manually since we can't easily do GROUP BY with simple select in client
    // Actually we can just fetch all subjects and count locally if not too many, 
    // but better to use a rpc or just count iterating.
    // For now, let's just fetch count of all rows.

    const { count } = await supabase.from('past_questions').select('*', { count: 'exact', head: true });
    console.log(`Total questions in DB: ${count}`);

    const subjects = ['Biology', 'Chemistry', 'Physics', 'Mathematics', 'Government', 'Crs', 'Literature-in-English', 'English'];
    for (const subject of subjects) {
        const { count } = await supabase
            .from('past_questions')
            .select('*', { count: 'exact', head: true })
            .ilike('subject', subject);
        console.log(`${subject}: ${count}`);
    }
}

verify();
