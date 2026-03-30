-- ============================================================
-- Add username to profiles with scalable uniqueness enforcement
-- ============================================================

-- 1. Add username column (nullable: existing users get NULL until they set one)
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS username TEXT;

-- 2. Case-insensitive unique index — enforces uniqueness at the DB level.
--    'Alice' and 'alice' will conflict at write time, zero race conditions.
--    B-Tree on TEXT: O(log N) at any scale; Postgres handles 100M+ rows.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_idx
    ON public.profiles (LOWER(username))
    WHERE username IS NOT NULL;

-- 3. Leaderboard policy: all authenticated users can read any profile row.
--    Needed so the leaderboard join can resolve usernames for other users.
--    Profiles intentionally contain no sensitive data (no email, no phone).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'profiles'
          AND policyname = 'Leaderboard: any auth user can read profiles'
    ) THEN
        EXECUTE $policy$
            CREATE POLICY "Leaderboard: any auth user can read profiles"
                ON public.profiles FOR SELECT
                TO authenticated
                USING (true)
        $policy$;
    END IF;
END $$;

-- 4. Index on exam_sessions for fast leaderboard aggregation
--    (score DESC used in ranking query)
CREATE INDEX IF NOT EXISTS exam_sessions_user_score_idx
    ON public.exam_sessions (user_id, score DESC);

-- 5. Ensure exam_sessions has the columns we depend on
--    (score and total_questions should already exist; this is a safety check)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'exam_sessions'
          AND column_name = 'score'
    ) THEN
        ALTER TABLE public.exam_sessions ADD COLUMN score INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'exam_sessions'
          AND column_name = 'total_questions'
    ) THEN
        ALTER TABLE public.exam_sessions ADD COLUMN total_questions INTEGER DEFAULT 0;
    END IF;
END $$;
