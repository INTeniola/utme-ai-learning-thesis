import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log('📖 Reading 2026 Novel questions from local JSON...');

    const rawData = fs.readFileSync(path.resolve(process.cwd(), 'lekki_headmaster_questions.json'), 'utf-8');
    const questions = JSON.parse(rawData);

    console.log(`✅ Loaded ${questions.length} questions. Inserting into Supabase...`);

    const toInsert = questions.map((q: any) => ({
        subject: 'English',
        topic: 'Novel: The Lekki Headmaster',
        subtopic: 'Literature/Reading Text',
        year: 2026,
        question_text: q.question_text,
        option_a: q.option_a,
        option_b: q.option_b,
        option_c: q.option_c,
        option_d: q.option_d,
        correct_option: q.correct_option.toUpperCase(),
        explanation: q.explanation,
        difficulty: 'medium',
        metadata: {
            source: 'AI Generated from Book Summary',
            novel: 'The Lekki Headmaster',
            author: 'Kabir Alabi Garba'
        }
    }));

    const { error } = await supabase.from('past_questions').insert(toInsert);

    if (error) {
        console.error('❌ Error inserting into Supabase:', error.message);
    } else {
        console.log(`🎉 Successfully ingested ${toInsert.length} questions for The Lekki Headmaster into the database!`);
    }
}

main().catch(console.error);
