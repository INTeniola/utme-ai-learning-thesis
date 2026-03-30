import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import * as fs from 'fs';

const envPath = resolve('/Users/pc/Projects/adaptive-learning-core', '.env');
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Auditing DB...");
  const { data: t1, error: e1 } = await supabase.from('past_questions').select('topic').ilike('subject', 'english');
  if (e1) console.error("Error t1:", e1);
  else {
    const uniqueTopics = [...new Set(t1.map(x => x.topic))];
    console.log("Distinct Topics in English past_questions:", uniqueTopics);
  }

  const { data: t2, error: e2 } = await supabase.from('knowledge_graph').select('metadata');
  if (e2) console.error("Error t2:", e2);
  else {
    const uniqueTitles = [...new Set(t2.map(x => x.metadata?.source_title).filter(Boolean))];
    console.log("Distinct source_titles in knowledge_graph:", uniqueTitles);
    
    // Also count how many chunks ref "Life Changer" vs "Lekki Headmaster"
    const lifeChanger = t2.filter(x => String(x.metadata?.source_title).includes("Life Changer")).length;
    const lekki = t2.filter(x => String(x.metadata?.source_title).includes("Lekki Headmaster")).length;
    console.log(`Knowledge Graph Chunks - Life Changer: ${lifeChanger}, Lekki Headmaster: ${lekki}`);
  }
}
run();
