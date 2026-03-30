/**
 * ingest_english.ts
 *
 * Fetches English JAMB past questions from the Aloc API and inserts them
 * into the Supabase past_questions table.
 *
 * Improvements over original:
 * - Insert-as-collected (every INSERT_EVERY questions) so a mid-run crash
 *   doesn't lose already-collected questions.
 * - Retries each batch fetch up to 3 times on network errors.
 * - Graceful SIGINT / SIGTERM: inserts whatever was collected before exit.
 * - Skip questions with missing options or invalid answer letters.
 */
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const ALOC_KEY = 'ALOC-d60419c06bd7620a0e16';

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const TARGET = 1500;        // Desired total new questions
const BATCH_SIZE = 10;      // Parallel Aloc API requests per round
const INSERT_EVERY = 100;   // Insert accumulated questions every N collected
const MAX_ATTEMPTS = TARGET * 4; // Allow for API duplication rate

// ── Helpers ─────────────────────────────────────────────────────────────────

async function fetchOneWithRetry(retries = 3): Promise<any | null> {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const res = await fetch('https://questions.aloc.com.ng/api/v2/q?subject=english', {
                headers: { AccessToken: ALOC_KEY },
                // @ts-ignore node-fetch signal type
                signal: AbortSignal.timeout(10_000),
            });
            if (!res.ok) return null;
            const json = await res.json() as any;
            return json?.status === 200 && json.data ? json.data : null;
        } catch {
            if (attempt < retries) await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
        }
    }
    return null;
}

async function insertBatch(questions: any[]): Promise<number> {
    if (questions.length === 0) return 0;
    let inserted = 0;
    const chunkSize = 50;
    for (let i = 0; i < questions.length; i += chunkSize) {
        const chunk = questions.slice(i, i + chunkSize);
        const { error } = await supabase.from('past_questions').insert(chunk);
        if (error) {
            console.error('\nInsert error:', error.message);
        } else {
            inserted += chunk.length;
        }
    }
    return inserted;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log('Checking for existing English questions in DB...');
    const { data: existingRows } = await supabase
        .from('past_questions')
        .select('metadata')
        .eq('subject', 'English');

    const existingIds = new Set<number>();
    for (const row of existingRows ?? []) {
        if (row.metadata && typeof row.metadata === 'object' && 'aloc_id' in row.metadata) {
            existingIds.add((row.metadata as any).aloc_id);
        }
    }
    console.log(`Found ${existingIds.size} existing English questions in DB.`);

    const seenIds = new Set<number>(existingIds);
    let collected: any[] = [];
    let totalInserted = 0;
    let attempts = 0;

    async function flushBuffer() {
        if (collected.length === 0) return;
        const n = await insertBatch(collected);
        totalInserted += n;
        process.stdout.write(`\n✅ Inserted ${n} (total so far: ${totalInserted})\n`);
        collected = [];
    }

    // Graceful shutdown
    const shutdown = async () => {
        console.log('\n⚠️  Interrupted — inserting remaining collected questions...');
        await flushBuffer();
        console.log(`🏁 Finished early. Total inserted: ${totalInserted}`);
        process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    console.log(`\nTarget: ${TARGET} new questions. Fetching in batches of ${BATCH_SIZE}...\n`);

    while (totalInserted + collected.length < TARGET && attempts < MAX_ATTEMPTS) {
        const promises = Array.from({ length: BATCH_SIZE }, () => fetchOneWithRetry());
        const results = await Promise.all(promises);
        attempts += BATCH_SIZE;

        for (const q of results) {
            if (!q) continue;
            if (seenIds.has(q.id)) continue;
            if (!q.option?.a || !q.option?.b || !q.option?.c || !q.option?.d) continue;
            const answer = q.answer?.toUpperCase();
            if (!['A', 'B', 'C', 'D'].includes(answer)) continue;

            seenIds.add(q.id);
            collected.push({
                subject: 'English',
                year: parseInt(q.examyear) || 2024,
                question_text: q.question,
                option_a: q.option.a,
                option_b: q.option.b,
                option_c: q.option.c,
                option_d: q.option.d,
                correct_option: answer,
                explanation: q.solution || null,
                topic: q.section || 'General',
                metadata: {
                    aloc_id: q.id,
                    image: q.image || null,
                    hasPassage: q.hasPassage || 0,
                    external_source: 'aloc.com.ng',
                },
            });
        }

        const progress = totalInserted + collected.length;
        process.stdout.write(
            `\rCollected ${progress}/${TARGET} | API calls: ${attempts} | Buffered: ${collected.length}`
        );

        // Flush buffer every INSERT_EVERY new questions
        if (collected.length >= INSERT_EVERY) {
            await flushBuffer();
        }
    }

    // Final flush
    await flushBuffer();

    console.log(`\n\n🎉 Done. Total English questions inserted this run: ${totalInserted}`);

    // Print final DB count
    const { count } = await supabase
        .from('past_questions')
        .select('*', { count: 'exact', head: true })
        .eq('subject', 'English');
    console.log(`📊 Total English in DB now: ${count}`);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
