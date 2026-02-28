-- Add RLS policy for sub-admins to view video engagement for their department users
CREATE POLICY "Sub-admins can view department user engagement"
ON public.video_engagement
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM department_admins da
    JOIN profiles p ON p.department_id = da.department_id
    WHERE da.user_id = auth.uid()
    AND p.id = video_engagement.user_id
  )
  AND has_role(auth.uid(), 'sub_admin'::app_role)
);