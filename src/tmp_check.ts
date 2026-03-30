
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL!
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkAllSubjects() {
  const { data, error } = await supabase
    .from('past_questions_public')
    .select('subject')

  if (error) {
    console.error('Error fetching subjects:', error)
    return
  }

  const subjects = [...new Set(data.map(d => d.subject))]
  console.log('ALL Available Subjects in Database:', subjects)
}

checkAllSubjects()
