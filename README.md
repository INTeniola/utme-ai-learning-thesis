# Research Artifact

**Title:** Evaluating an Integrated AI-Driven Learning Platform for Unified Tertiary Matriculation Examination (UTME) Preparation.

This repository is a strictly functional, research-focused version of the Quizant platform, designed for a Master's Thesis study. It has been aggressively pruned of all non-core features (gamification, social tools, user uploads) to ensure a controlled experimental environment focused on four core research pillars.

## 4 Core Research Pillars
1. **AI Tutor (Mentat):** Conversational RAG-based tutor using pre-loaded JAMB/WAEC knowledge.
2. **Adaptive Quiz:** Dynamically generated practice sessions with difficulty adjustment.
3. **Flashcards:** Spaced-repetition system (SM-2) for active recall of core concepts.
4. **Analytics:** Performance trajectory and goal progress visualization.

## Tech Stack
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Shadcn UI
- **Database & Auth:** Supabase (Auth, PostgreSQL)
- **AI:** Gemini 3.1 Flash-Lite (Primary Research Model)
- **Hosting:** Vercel

## Research Context
This artifact is used to evaluate:
- Participant preference between conversational AI and structured retrieval (Quiz/Cards).
- Correlation between AI interactions and specific mastery gain in UTME topics.
- Self-regulated learning patterns in a minimal vs. sophisticated environment.

## Getting Started
1. Install dependencies: `npm install`
2. Start development server: `npm run dev`
3. Access the Research Hub via the local server URL.
