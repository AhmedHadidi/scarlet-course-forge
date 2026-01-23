-- Add RLS policy for sub-admins to view quiz attempts for their department users
CREATE POLICY "Sub-admins can view department quiz attempts"
ON public.quiz_attempts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM department_admins da
    JOIN profiles p ON p.department_id = da.department_id
    WHERE da.user_id = auth.uid()
    AND p.id = quiz_attempts.user_id
  )
);

-- Add RLS policy for sub-admins to view certificates for their department users
CREATE POLICY "Sub-admins can view department certificates"
ON public.certificates
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM department_admins da
    JOIN profiles p ON p.department_id = da.department_id
    WHERE da.user_id = auth.uid()
    AND p.id = certificates.user_id
  )
);

-- Add RLS policy for sub-admins to view enrollments for their department users
CREATE POLICY "Sub-admins can view department enrollments"
ON public.enrollments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM department_admins da
    JOIN profiles p ON p.department_id = da.department_id
    WHERE da.user_id = auth.uid()
    AND p.id = enrollments.user_id
  )
);

-- Add RLS policy for sub-admins to view video progress for their department users
CREATE POLICY "Sub-admins can view department video progress"
ON public.video_progress
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM department_admins da
    JOIN profiles p ON p.department_id = da.department_id
    WHERE da.user_id = auth.uid()
    AND p.id = video_progress.user_id
  )
);