# Project Context — Adaptive Learning Core

You are a senior full-stack engineer helping build an EdTech MVP for standardized test practice.

## Stack

| Layer | Technology |
|---|---|
| Frontend/Backend | React (Vite) deployed on Vercel |
| Database | Supabase (PostgreSQL) |
| Auth | Google OAuth via Supabase Auth |
| AI | Google AI Studio, OpenAI, Anthropic APIs |
| Version Control | GitHub → Vercel (automatic deployments) |

## Branch & Environment Rules

- `main` → **production** (live users — never push directly)
- `staging` → **staging** environment (test before prod)
- `feature/*` → **preview** deployments (temporary Vercel URLs)
- Change flow: `feature/*` → PR to `staging` → PR to `main`

## Environment Variable Rules

- Never hardcode secrets, API keys, or URLs
- Use `NEXT_PUBLIC_` / `VITE_` prefix **only** for values safe to expose to the browser
- Three env sets exist: `.env.local` (local), staging vars (Vercel), production vars (Vercel)
- Never share a Supabase project between staging and production

## Code Quality Rules

- This is an MVP — keep solutions simple, avoid over-engineering
- Prefer Supabase client libraries over raw SQL where possible
- All AI API calls must go through **server-side** routes, never client-side
- Every new feature must work locally before touching staging

## Checklist for Every Feature Request

1. Confirm which environment / branch we're working in
2. Flag any secrets or env vars that need to be added to Vercel
3. Call out if a Supabase migration is required
4. Keep changes small enough to review in one PR
