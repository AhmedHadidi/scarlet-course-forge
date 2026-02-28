-- Fix update_updated_at_column function to set search_path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- Enhance has_role function with additional security
-- Now validates that caller can only check their own role OR is already verified admin
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  caller_id UUID;
  is_checking_self BOOLEAN;
BEGIN
  caller_id := auth.uid();
  
  -- Allow if checking own role
  is_checking_self := (caller_id = _user_id);
  
  -- If not checking self, must be an admin already (prevents unauthorized role probing)
  IF NOT is_checking_self THEN
    -- Check if caller is admin (direct query to avoid recursion)
    IF NOT EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = caller_id AND role = 'admin'
    ) THEN
      RETURN FALSE;
    END IF;
  END IF;
  
  -- Now perform the actual role check
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
END;
$function$;