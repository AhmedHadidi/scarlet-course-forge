
-- Drop existing restrictive policies on courses
DROP POLICY IF EXISTS "Admins can manage courses" ON public.courses;
DROP POLICY IF EXISTS "Anyone can view published courses" ON public.courses;

-- Recreate as PERMISSIVE policies
CREATE POLICY "Anyone can view published courses"
ON public.courses
FOR SELECT
USING ((is_published = true) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage courses"
ON public.courses
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));
