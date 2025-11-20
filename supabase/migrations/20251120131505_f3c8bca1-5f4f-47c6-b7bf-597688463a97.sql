-- Fix the set_default_user_status function to have a secure search_path
CREATE OR REPLACE FUNCTION set_default_user_status()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status_id IS NULL THEN
    SELECT status_id INTO NEW.status_id
    FROM public.user_statuses
    WHERE status_name = 'active'
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;