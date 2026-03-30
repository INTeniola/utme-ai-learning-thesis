/**
 * Topic Classification Script
 *
 * Reads all past_questions where topic = 'General' (misclassified during ingestion)
 * and uses the Gemini API to classify each question's topic based on the JAMB syllabus.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... GEMINI_API_KEY=... npx tsx scripts/classify_topics.ts
 *
 * Options (env vars):
 *   BATCH_SIZE=20       - Number of questions to classify per AI call (default: 20)
 *   DRY_RUN=true        - Print classifications without writing to DB (default: false)
 *   SUBJECT_FILTER=Physics - Only classify questions for a specific subject (optional)
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// ─── Configuration ──────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '5', 10);
const DRY_RUN = process.env.DRY_RUN === 'true';
const SUBJECT_FILTER = process.env.SUBJECT_FILTER || null;
const DELAY_MS = 1500; // Delay between batches to respect rate limits

// JAMB syllabus topic map — used to guide classification
const JAMB_TOPICS: Record<string, Record<string, string[]>> = {
    Biology: {
        'Ecology': ['Aquatic and Terrestrial Habitat', 'Basic Ecological Concepts', 'Ecological Management', 'Ecology of Population', 'Functioning Ecosystem'],
        'Evolution': ['Variations / Adaptation for Survival / Evolution'],
        'Form and Functions': ['Cell: Living Unit - Structure', 'Cell: Properties and Functions', 'Excretory Systems and Mechanisms', 'Feeding Mechanism / Digestive System', 'Gaseous Exchange / Respiratory System', 'Nervous Coordination', 'Nutrition / Photosynthesis / Food substances', 'Regulation of the Internal Environment', 'Sensory Receptors and Organs', 'Supporting systems and Mechanisms', 'Transport System and Mechanism'],
        'Heredity and Variations': ['Development of New Organisms / Fruits', 'Genetics: The Science of Heredity', 'Sexual Reproduction: System / Behaviours'],
        'Variety of Organisms': ['Classification or Organisation of Life', 'Micro-Organisms and Health']
    },
    Mathematics: {
        'Number and Numeration': ['Financial Arithmetic', 'Fractions, Decimals, Percentages and Approximation', 'Indices', 'Logarithms', 'Matrices and Determinants', 'Modular Arithmetic', 'Number Bases', 'Positive and Negative Integers', 'Ratios, Proportions and Rates', 'Sets', 'Surds', 'Variations'],
        'Algebra': ['Algebraic Fractions', 'Binary Operations', 'Change Of Subject Of Formula', 'Functions and Relations', 'Graph Of Linear and Quadratic Functions', 'Linear Inequalities', 'Polynomials', 'Progressions', 'Quadratic Equations', 'Simple Operations On Algebraic Expression', 'Solution Of Linear Equations'],
        'Calculus': ['Application of differentiation', 'Application of Integration', 'Differentiation', 'Integration'],
        'Geometry and Trigonometry': ['Angles and Intercepts on Parallel Lines', 'Angles of Elevation and Depression', 'Bearings and Distances', 'Circles', 'Construction', 'Coordinate Geometry of Straight Lines', 'Triangles and Polygons', 'Trigonometric Ratios'],
        'Mensuration': ['Areas', 'Lengths and Perimeters', 'Volumes'],
        'Statistics': ['Measures of Dispersion', 'Measures of Location', 'Permutation and Combination', 'Probability', 'Representation of data']
    },
    Physics: {
        'Electricity and Magnetism': ['A.C. circuits', 'Capacitors', 'Current electricity', 'Electric cells', 'Electromagnetic induction', 'Electrostatics', 'Magnets and magnetic fields'],
        'Mechanics': ['Equilibrium of Forces', 'Friction', 'Gravitational Field', 'Measurements and Units', 'Motion', 'Scalars and Vectors', 'Simple Machines', 'Work, Energy, and Power'],
        'Modern Physics': ['Atomic structure', 'Nuclear energy', 'Photoelectric effect', 'Radioactivity', 'X-rays'],
        'Properties of Matter': ['Elasticity', 'Liquids at Rest', 'Pressure'],
        'Thermal Physics': ['Heat Transfer', 'Temperature and Heat', 'Vapours and Kinetic Theory'],
        'Waves and Optics': ['Echo and reverberation', 'Electromagnetic spectrum', 'Mirrors and lenses', 'Reflection and refraction of light', 'Sound waves', 'Wave motion and properties']
    },
    Chemistry: {
        'Analytical and Environmental Chemistry': ['Chemistry and industry', 'Environmental pollution', 'Oxidation and reduction', 'Separation of mixture and purification of chemical substances'],
        'Inorganic Chemistry': ['Acids Bases and Salts', 'Air', 'Metals and their compound', 'Non-metals and their compounds', 'Water'],
        'Organic Chemistry': ['Organic compound'],
        'Physical Chemistry': ['Atomic structure and bonding', 'Chemical combination', 'Chemical equilibrium', 'Electrolysis', 'Energy changes', 'Kinetic theory of matter and gas law', 'Rates of a chemical reaction', 'Solubility']
    },
    Economics: {
        'Basic Concepts': ['Economics as a science', 'Economic problems'],
        'Theory of Production': ['Factors of Production and their Theories', 'Meaning and types of production', 'Division of labour and specialization', 'Factors affecting productivity', 'Producers equilibrium', 'Production functions and returns to scale', 'Scale of Production'],
        'Theory of Demand': ['Meaning and determinants of demand', 'Types of demand', 'Types, nature and determinants of elasticity and their measurement', 'Importance of elasticity of demand to consumers, producers and government'],
        'Theory of Supply': ['Meaning and determinants of supply', 'Types of Supply', 'Elasticity of Supply'],
        'Theory of Price Determination': ['Equilibrium price and quantity in product and factor markets', 'Functions of the price system', 'Price legislation and its effects', 'The concepts of market and price', 'The effects of changes in supply and demand on equilibrium price and quantity'],
        'Financial Institutions': ['Challenges facing financial institutions in Nigeria', 'Deposit money banks and the creation of money', 'Financial sector regulations', 'Monetary policy and its instruments', 'Money and capital markets', 'The role of financial institutions in economic development', 'Types and functions of financial institutions'],
        'Public Finance': ['Fiscal policy and its instruments', 'Government budget and public debts', 'Meaning and objectives of Public Finance', 'Principles of taxation', 'Revenue allocation and resource control in Nigeria', 'Sources of government revenue', 'Tax incidence and its effects', 'The effects of public expenditure'],
        'International Trade': ['Balance of trade and balance of payments', 'Composition and direction of Nigeria\'s foreign trade', 'Exchange rate', 'Meaning and basis for international trade']
    },
    Government: {
        'Basic Elements in Government': ['Basic Principles of Government', 'Constitution', 'Forms of Government', 'Introduction to Government - Basic Concepts', 'Political Ideologies', 'Principles of a Democratic Government', 'Processes of Legislation', 'The Workings of Government I - Organs & Systems', 'The Workings of Government II - Unitary, Federal & Confederal Structures'],
        'Politics in Nigeria': ['Colonial Administration I - British Colonial Administration', 'Colonial Administration II - French Colonial Administration', 'Constitutional Development in Nigeria I - Pre-Independence', 'Constitutional Development in Nigeria II - Independence & Post-Independence', 'Institutions of Government in Post-Independence Nigeria', 'Local Government Administration in Nigeria', 'Military Rule in Nigeria', 'Nigerian Federalism', 'Political Crises in Nigeria', 'Political Parties in Nigeria', 'Pre-Colonial Administration in Nigeria', 'The Process of Decolonization - Nationalism'],
        'International Relations': ['Foreign Policy and Nigeria\'s Relationship with the International Community', 'International Organizations I - OAU, AU, ECOWAS, APPO', 'International Organizations II - League of Nations, UNO/UN, OPEC, The Commonwealth of Nations', 'Nigeria\'s Foreign Policy']
    }
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function callGemini(prompt: string, attempt = 1): Promise<string> {
    const MAX_RETRIES = 5;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 2000 },
            safetySettings: [
                { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
            ]
        }),
    });

    if (res.status === 429) {
        if (attempt > MAX_RETRIES) throw new Error(`Gemini rate limit: exceeded ${MAX_RETRIES} retries`);
        const body = await res.json().catch(() => ({}));
        const retryDelayStr: string = body?.error?.details?.find((d: { retryDelay?: string }) => d.retryDelay)?.retryDelay ?? '30s';
        const retryMs = (parseInt(retryDelayStr) || 30) * 1000 + 2000;
        console.log(`\n   ⏳ Rate limited. Waiting ${Math.round(retryMs / 1000)}s before retry ${attempt}/${MAX_RETRIES}...`);
        await sleep(retryMs);
        return callGemini(prompt, attempt + 1);
    }

    if (!res.ok) {
        const errText = await res.text();
        console.error(`\n   ❌ Gemini API Error ${res.status}: ${errText}`);
        throw new Error(`Gemini error ${res.status}`);
    }
    const data = await res.json();
    
    // Log full response if it seems truncated or suspicious
    if (!data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        fs.writeFileSync('gemini_api_debug.json', JSON.stringify(data, null, 2));
    }
    
    return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

async function classifyBatch(
    questions: Array<{ id: string; subject: string; question_text: string }>
): Promise<Map<string, { topic: string; subtopic: string }>> {
    const subject = questions[0].subject;
    const allowedMap = JAMB_TOPICS[subject] || {};

    const structurePrompt = Object.entries(allowedMap)
        .map(([topic, subtopics]) => `- ${topic}: [${subtopics.join(', ')}]`)
        .join('\n');

    const questionList = questions
        .map((q, i) => `Q${i + 1} [ID:${q.id}]: ${q.question_text.substring(0, 300)}`)
        .join('\n\n');

    const prompt = `Classify these ${questions.length} JAMB UTME ${subject} questions into topics and subtopics.
    
    ALLOWED STRUCTURE (Topic: [Possible Subtopics]):
    ${structurePrompt}
    
    QUESTIONS:
    ${questionList}
    
    CRITICAL: Return ONLY a valid JSON object. No markdown, no commentary.
    FORMAT: {"id1": {"topic": "...", "subtopic": "..."}, "id2": {...}}`;

    const rawContent = await callGemini(prompt);
    
    // Extract JSON block
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        console.error(`\n   ❌ No JSON found. Saving raw output to gemini_raw_fail.txt`);
        fs.writeFileSync('gemini_raw_fail.txt', rawContent);
        throw new Error(`No JSON in response`);
    }

    let cleaned = jsonMatch[0]
        .trim()
        .replace(/,\s*([\}\]])/g, '$1') // Remove trailing commas
        .replace(/\}\s*"/g, '}, "');    // Add missing commas between key-value pairs

    try {
        const parsed = JSON.parse(cleaned) as Record<string, { topic: string; subtopic: string }>;
        return new Map(Object.entries(parsed));
    } catch (e) {
        console.error(`\n   ❌ JSON Parse Error. Saving raw and cleaned output for debug.`);
        fs.writeFileSync('gemini_raw_fail.txt', rawContent);
        fs.writeFileSync('gemini_fail_cleaned.txt', cleaned);
        throw e;
    }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.error('❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
        process.exit(1);
    }
    if (!GEMINI_API_KEY) {
        console.error('❌ GEMINI_API_KEY is required');
        process.exit(1);
    }

    console.log(`🚀 Topic Classification Script`);
    console.log(`   Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE (will update DB)'}`);
    console.log(`   Batch size: ${BATCH_SIZE}`);
    if (SUBJECT_FILTER) console.log(`   Subject filter: ${SUBJECT_FILTER}`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // Fetch all unclassified questions
    let query = supabase
        .from('past_questions')
        .select('id, subject, question_text, topic')
        .eq('topic', 'General')
        .order('subject');

    if (SUBJECT_FILTER) {
        query = query.eq('subject', SUBJECT_FILTER);
    }

    const { data: questions, error } = await query;
    if (error) {
        console.error('❌ Failed to fetch questions:', error.message);
        process.exit(1);
    }

    if (!questions || questions.length === 0) {
        console.log('✅ No questions with topic="General" found. Nothing to do.');
        return;
    }

    // Group by subject for better batch classification
    const bySubject = questions.reduce((acc, q) => {
        if (!acc[q.subject]) acc[q.subject] = [];
        acc[q.subject].push(q);
        return acc;
    }, {} as Record<string, typeof questions>);

    console.log(`\n📊 Found ${questions.length} unclassified questions:`);
    for (const [subject, qs] of Object.entries(bySubject)) {
        console.log(`   ${subject}: ${qs.length} questions`);
    }

    let totalUpdated = 0;
    let totalFailed = 0;

    for (const [subject, subjectQuestions] of Object.entries(bySubject)) {
        if (!JAMB_TOPICS[subject]) {
            console.warn(`\n⚠️  No topic list for subject "${subject}", skipping`);
            continue;
        }

        console.log(`\n📚 Classifying ${subject} (${subjectQuestions.length} questions)...`);

        // Process in batches
        for (let i = 0; i < subjectQuestions.length; i += BATCH_SIZE) {
            const batch = subjectQuestions.slice(i, i + BATCH_SIZE);
            const batchNum = Math.floor(i / BATCH_SIZE) + 1;
            const totalBatches = Math.ceil(subjectQuestions.length / BATCH_SIZE);

            process.stdout.write(`   Batch ${batchNum}/${totalBatches}... `);

            try {
                const classifications = await classifyBatch(batch);

                if (DRY_RUN) {
                    for (const [id, result] of classifications) {
                        console.log(`   [DRY RUN] ${id} → ${result.topic} (${result.subtopic})`);
                    }
                    totalUpdated += classifications.size;
                } else {
                    // Update each question in DB
                    const updates = Array.from(classifications.entries()).map(([id, result]) =>
                        supabase.from('past_questions').update({ 
                            topic: result.topic,
                            subtopic: result.subtopic 
                        }).eq('id', id)
                    );
                    const results = await Promise.all(updates);
                    const succeeded = results.filter(r => !r.error).length;
                    const failed = results.filter(r => r.error).length;
                    totalUpdated += succeeded;
                    totalFailed += failed;
                    process.stdout.write(`✅ ${succeeded} classified${failed > 0 ? `, ⚠️ ${failed} failed` : ''}\n`);
                }

                if (i + BATCH_SIZE < subjectQuestions.length) {
                    await sleep(DELAY_MS); // Rate limit between batches
                }
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                console.error(`   ❌ Batch failed: ${msg}`);
                totalFailed += batch.length;
                await sleep(5000);
            }
        }
    }

    console.log(`\n✅ Classification complete:`);
    console.log(`   Updated: ${totalUpdated}`);
    if (totalFailed > 0) console.log(`   Failed:  ${totalFailed}`);
    if (DRY_RUN) console.log('\n   [DRY RUN] No changes were written to the database.');
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
