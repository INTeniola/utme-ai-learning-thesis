# Quizant — AI Study Companion for JAMB UTME

Quizant is an AI-powered study platform for Nigerian students preparing for 
the JAMB UTME examination. It combines an AI tutor (Mentat), adaptive 
quizzes, mock exams, and spaced repetition flashcards.

## Tech Stack
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Shadcn UI
- **Database & Auth:** Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **AI:** Gemini 3.1 Flash-Lite (primary) → Claude Haiku (fallback)
- **Hosting:** Vercel (auto-deploy from GitHub)

## Getting Started

### Prerequisites
- Node.js 18+
- A Supabase account with access to the project
- A Gemini API key from aistudio.google.com
- **Docker Desktop** (Critical: Required for running local migrations via `supabase db reset`)

### Setup
1. Clone the repository: `git clone https://github.com/your-org/quizant.git`
2. Install dependencies: `npm install`
3. Set up environment variables: `cp .env.example .env.local`
4. Fill in `.env.local` with your actual API keys and Supabase credentials.
5. Start development server: `npm run dev`

#### Supabase Auth Configuration
To ensure users receive 6-digit OTPs instead of magic links during email signup:
1. Go to your Supabase Dashboard -> **Authentication** -> **Email Templates**
2. Edit both **Magic Link** and **Confirm Signup** templates.
3. Ensure the template body uses the `{{ .Token }}` variable (OTP code) instead of the `{{ .SiteURL }}/auth/v1/verify...` URL.

## Project Structure
- `src/components/` — Reusable React components grouped by feature (dashboard, flashcards, etc)
- `src/hooks/` — Custom React hooks for data fetching and state (useAITutor, useQuiz)
- `src/lib/` — Shared utilities, logger, and formatting helpers
- `src/pages/` — Top-level route components
- `src/services/` — Core API interactions (aiGateway.ts)
- `supabase/functions/` — Deno edge functions for secure backend tasks
- `supabase/migrations/` — SQL definitions for the database schema
- `index.html` — The main entry point for the Vite app
- `vite.config.ts` — Vite build configuration
- `tailwind.config.ts` — Tailwind CSS theme and design tokens configuration
- `package.json` — Project dependencies and scripts
- `docs/` — Application documentation (Components, Screens, Design Tokens, Environment)

## Architecture Overview

### AI Gateway (`src/services/aiGateway.ts`)
The AI Gateway implements a robust failover chain to ensure high availability. It attempts to route requests to the primary Gemini model first. If it encounters latency, quota limits, or errors, it seamlessly cascades to secondary keys or to the Claude Haiku fallback model, ensuring zero downtime for the student.

### Mentat Tutor (`src/hooks/useAITutor.ts`)
The tutor hook aggressively assembles contextual data around the student via `buildRichStudentContext`. It queries their recent mock scores, weakest topics, and current goals to assemble a highly personalized system prompt before dispatching messages.

### Quiz System (`src/hooks/useQuiz.ts` + edge function)
The `generate-quiz` edge function safely integrates with the AI API to return structured JSON questions based on specific subjects. `useQuiz.ts` then maps this data into the UI, handles step-by-step progression, and updates the `concept_mastery` metrics upon submission.

### Database Schema
Key tables:
- `profiles` — user account data, exam date, selected subjects
- `past_questions` — JAMB question bank (subject, topic, year, options, answer)
- `concept_mastery` — per-user topic accuracy tracking
- `exam_sessions` — mock exam and quiz results
- `study_sessions` — session time tracking
- `conversations` — Mentat Tutor chat sessions
- `ai_interactions` — individual messages in each conversation
- `knowledge_graph` — uploaded document chunks for RAG
- `flashcards` — spaced repetition cards with SM-2 data

## Branches and Deployment
- `main` → auto-deploys to production (quizant.vercel.app)
- `staging` → auto-deploys to staging environment
- All changes go through staging before production
- No direct pushes to main

## Known Issues
- VS Code default TypeScript Server will report "Cannot find module 'https...'" and "Cannot find name 'Deno'" in `supabase/functions/` unless the `denoland.vscode-deno` extension is installed and enabled for the workspace.

## Do Not Touch Without a Ticket
1. `src/lib/aiGateway.ts` failover logic and model routing boundaries.
2. Supabase RLS policies (modifying these can expose sensitive user data).
3. `useAuth.ts` and the authentication session management flow.
4. Database migrations extending `knowledge_graph` or `concept_mastery`.
5. Environment variable names in the `.env` configuration mapping.
