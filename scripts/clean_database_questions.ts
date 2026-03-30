import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials. Make sure VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// The core cleaner regex function (mirrors the frontend textUtils.ts)
const cleanQuestionText = (text: string) => {
    return text
        // Remove "Question 81-85" type artifacts
        .replace(/Questions?\s+\d+[-–]\d+[^.]*\./gi, '')
        // Remove "In each of the following questions..." artifacts
        .replace(/In each of the (following )?questions?[^,]*/gi, '')
        // Remove dangling commas or periods left behind at the start
        .replace(/^[\s,.]+/, '')
        .trim();
};

async function cleanDatabaseQuestions() {
    console.log('Starting JAMB Questions Database Cleanup...');

    let hasMore = true;
    let page = 0;
    const pageSize = 500;
    let totalProcessed = 0;
    let totalUpdated = 0;

    while (hasMore) {
        console.log(`Fetching batch ${page + 1}...`);

        // Fetch a batch of questions
        const { data: questions, error } = await supabase
            .from('past_questions')
            .select('id, question_text')
            .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
            console.error('Error fetching questions:', error);
            break;
        }

        if (!questions || questions.length === 0) {
            hasMore = false;
            break;
        }

        const updates: { id: string, question_text: string }[] = [];

        // Analyze each question in the batch
        for (const q of questions) {
            const originalText = q.question_text || '';
            const cleanedText = cleanQuestionText(originalText);

            // If the scrubber actually changed the text, stage it for update
            if (cleanedText !== originalText && cleanedText.length > 0) {
                updates.push({
                    id: q.id,
                    question_text: cleanedText
                });
            }
        }

        // Perform batch update if we found dirty data
        if (updates.length > 0) {
            console.log(`Found ${updates.length} dirty records in batch. Cleaning...`);

            const updatePromises = updates.map(u =>
                supabase.from('past_questions').update({ question_text: u.question_text }).eq('id', u.id)
            );

            const results = await Promise.all(updatePromises);
            const errors = results.filter(r => r.error).map(r => r.error);

            if (errors.length > 0) {
                console.error(`Encountered ${errors.length} errors during update. Example:`, errors[0]);
            }

            totalUpdated += (updates.length - errors.length);
        }

        totalProcessed += questions.length;
        page++;

        // Small delay to prevent API rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n=====================================');
    console.log('CLEANUP COMPLETE');
    console.log(`Total Records Scanned: ${totalProcessed}`);
    console.log(`Total Records Cleaned: ${totalUpdated}`);
    console.log('=====================================');
}

cleanDatabaseQuestions().catch(console.error);
