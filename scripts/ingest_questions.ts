import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Hard requirement: service role key is required for data ingestion (INSERT on past_questions)
if (!supabaseUrl) {
    console.error('❌ Missing SUPABASE_URL or VITE_SUPABASE_URL in .env');
    process.exit(1);
}
if (!supabaseKey) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY is required for data ingestion.');
    console.error('   The anon/publishable key does NOT have INSERT permissions on past_questions.');
    console.error('   Get the service role key from Supabase > Project Settings > API.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const SUBJECTS = ['biology', 'chemistry', 'physics', 'mathematics', 'government', 'crs', 'literature-in-english'];
const BASE_URL = 'https://raw.githubusercontent.com/wisdom209/jamb_questions/main';

interface JambQuestion {
    question: string;
    a: string;
    b: string;
    c: string;
    d: string;
    e?: string;
    answer: string;
    image?: string;
}

interface JambYearData {
    [questionNumber: string]: JambQuestion;
}

interface JambRoot {
    questions: {
        [year: string]: JambYearData;
    };
}

/**
 * Validates that a question has all required fields and is not malformed.
 */
function isValidQuestion(qData: JambQuestion): boolean {
    if (!qData.question || qData.question.trim().length < 10) return false;
    if (!qData.a || !qData.b || !qData.c || !qData.d) return false;
    if (!qData.answer) return false;
    const validAnswers = ['a', 'b', 'c', 'd', 'e'];
    if (!validAnswers.includes(qData.answer.toLowerCase())) return false;
    return true;
}

async function ingestSubject(subject: string) {
    console.log(`\nStarting ingestion for ${subject}...`);
    const url = `${BASE_URL}/${subject}/jambquestions.json`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            if (response.status === 404) {
                console.log(`No data found for ${subject} (404)`);
                return;
            }
            throw new Error(`Failed to fetch ${subject}: ${response.statusText}`);
        }

        const data = await response.json() as JambRoot;
        let totalInserted = 0;
        let totalSkipped = 0;

        // Iterate over years
        for (const [year, questions] of Object.entries(data.questions)) {
            const yearNum = parseInt(year);
            if (isNaN(yearNum)) continue;

            const questionsToInsert = [];

            // Iterate over questions
            for (const [qNum, qData] of Object.entries(questions)) {
                // Validate question before processing
                if (!isValidQuestion(qData)) {
                    console.warn(`⚠️  Skipping ${subject} ${year} Q${qNum}: invalid/incomplete data`);
                    totalSkipped++;
                    continue;
                }

                const answerLetter = qData.answer.toUpperCase();

                // Handle 5-option questions (answer 'E')
                // NOTE: Requires option_e column — run 20260222000000_add_option_e.sql migration first
                if (answerLetter === 'E' && !qData.e) {
                    console.warn(`⚠️  Skipping ${subject} ${year} Q${qNum}: answer is E but no option_e text provided`);
                    totalSkipped++;
                    continue;
                }

                const correctOption = answerLetter; // 'A', 'B', 'C', 'D', or 'E'

                questionsToInsert.push({
                    subject: subject.charAt(0).toUpperCase() + subject.slice(1),
                    year: yearNum,
                    question_text: qData.question,
                    option_a: qData.a,
                    option_b: qData.b,
                    option_c: qData.c,
                    option_d: qData.d,
                    ...(qData.e ? { option_e: qData.e } : {}),
                    correct_option: correctOption, // 'A', 'B', 'C', 'D', or 'E'
                    topic: 'General', // Will be reclassified by scripts/classify_topics.ts after ingestion
                    metadata: qData.image
                        ? { imageUrl: "https://github.com/wisdom209/jamb_questions/raw/main/" + subject + "/" + qData.image }
                        : null
                });
            }

            if (questionsToInsert.length > 0) {
                // Insert in batches of 50 to avoid timeout/payload limits
                const batchSize = 50;
                for (let i = 0; i < questionsToInsert.length; i += batchSize) {
                    const batch = questionsToInsert.slice(i, i + batchSize);
                    const { error } = await supabase.from('past_questions').insert(batch);

                    if (error) {
                        console.error(`Error inserting batch ${Math.floor(i / batchSize)} for ${subject} ${year}:`, error.message);
                    } else {
                        process.stdout.write('.');
                    }
                }
                totalInserted += questionsToInsert.length;
            }
        }

        console.log(`\nFinished ${subject}: ${totalInserted} inserted, ${totalSkipped} skipped.`);
        console.log(`\n✅ NEXT STEP: Run 'npx tsx scripts/classify_topics.ts' to assign correct topics.`);

    } catch (error) {
        console.error(`Error processing ${subject}:`, error);
    }
}

async function classifyAfterIngestion() {
    if (!process.env.GEMINI_API_KEY) {
        console.log('\n⚠️  GEMINI_API_KEY not set — skipping auto-classification.');
        console.log('   Run manually: GEMINI_API_KEY=... npx tsx scripts/classify_topics.ts');
        return;
    }
    console.log('\n🏷️  Auto-classifying topics (this replaces all "General" topics)...');
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    try {
        const { stdout, stderr } = await execAsync(
            'npx tsx scripts/classify_topics.ts',
            { env: process.env, maxBuffer: 10 * 1024 * 1024 }
        );
        if (stdout) console.log(stdout);
        if (stderr && !stderr.includes('ExperimentalWarning')) console.error(stderr);
    } catch (err) {
        console.error('❌ Auto-classification failed:', err);
        console.log('   Run manually: npx tsx scripts/classify_topics.ts');
    }
}

async function main() {
    console.log('🚀 Starting JAMB question ingestion...');
    console.log('   Topics will be auto-classified by Gemini after ingestion.\n');
    for (const subject of SUBJECTS) {
        await ingestSubject(subject);
    }
    console.log('\n✅ Ingestion complete!');
    await classifyAfterIngestion();
    console.log('\n🎉 All done — questions ingested and topics classified.');
}

main();

