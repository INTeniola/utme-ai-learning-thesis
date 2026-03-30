-- Fix: Convert UTC current date to Africa/Lagos (UTC+1) for accurate streak calculation
CREATE OR REPLACE FUNCTION public.update_user_streak()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  last_date DATE;
  -- Get the current date in Nigeria timezone
  current_date_val DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lagos')::DATE;
  user_exists BOOLEAN;
BEGIN
  -- Validate that the user_id exists in profiles before updating
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.user_id) INTO user_exists;
  
  IF NOT user_exists THEN
    -- Log warning but don't fail the trigger
    RAISE WARNING 'User % not found in profiles, skipping streak update', NEW.user_id;
    RETURN NEW;
  END IF;

  SELECT last_activity_date INTO last_date
  FROM public.profiles
  WHERE id = NEW.user_id;
  
  -- If last_activity is null or more than 1 day ago (in Lagos time), reset to 1
  IF last_date IS NULL OR last_date < current_date_val - INTERVAL '1 day' THEN
    UPDATE public.profiles
    SET current_streak = 1, last_activity_date = current_date_val
    WHERE id = NEW.user_id;
  -- If they were active exactly yesterday (in Lagos time), increment streak
  ELSIF last_date = current_date_val - INTERVAL '1 day' THEN
    UPDATE public.profiles
    SET current_streak = current_streak + 1, last_activity_date = current_date_val
    WHERE id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$;
