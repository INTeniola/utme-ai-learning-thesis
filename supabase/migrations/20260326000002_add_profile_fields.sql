-- Add target_university and phone_number to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS target_university TEXT,
ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- Update academic_goals default to include target_university placeholder if needed
-- (Though we'll likely store it as a top-level column for easier querying)

COMMENT ON COLUMN public.profiles.target_university IS 'The higher education institution the student aims to attend.';
COMMENT ON COLUMN public.profiles.phone_number IS 'Verified or provided contact number for the student.';
