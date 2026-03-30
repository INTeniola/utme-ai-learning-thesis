# Quizant — Environment Variables

## How to Set Up
1. Copy `.env.example` to `.env.local`
2. Fill in the values from the sources listed below
3. Never commit `.env.local` to version control

## Variables

### Supabase
| Variable | What it does | Where to get it | Required |
|---|---|---|---|
| VITE_SUPABASE_URL | Supabase project URL | Supabase dashboard → Settings → API | Yes |
| VITE_SUPABASE_PUBLISHABLE_KEY | Public anon key | Supabase dashboard → Settings → API | Yes |
| SUPABASE_SERVICE_ROLE_KEY | Service role key for backend overrides | Supabase dashboard → Settings → API | No (Backend/Edge Functions only) |

### AI Providers
| Variable | What it does | Where to get it | Required |
|---|---|---|---|
| VITE_GEMINI_API_KEY | Primary AI model | aistudio.google.com | Yes |
| VITE_GEMINI_API_KEY_2 | Secondary AI model failover | aistudio.google.com | Optional |
| VITE_OPENAI_API_KEY | Optional fallback model | platform.openai.com | Optional |
| VITE_ANTHROPIC_API_KEY | Fallback AI model | console.anthropic.com | Optional |

## Environments
| Environment | Branch | URL | Supabase Project |
|---|---|---|---|
| Production | main | quizant.vercel.app | [prod project ID] |
| Staging | staging | [staging URL] | [staging project ID] |
| Local | any | localhost:5173 | Either |

## First Time Setup
```bash
# 1. Clone the repository
git clone https://github.com/your-org/quizant.git
cd quizant

# 2. Install dependencies
npm install

# 3. Setup Environment Variables
cp .env.example .env.local
# (Edit .env.local with your real API keys)

# 4. Start the development server
npm run dev
```
