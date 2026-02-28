-- Allow sub-admins to update approval status for users in their department
CREATE POLICY "Sub-admins can update department user approval" 
ON public.profiles 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.department_admins da
    WHERE da.user_id = auth.uid() 
    AND da.department_id = profiles.department_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.department_admins da
    WHERE da.user_id = auth.uid() 
    AND da.department_id = profiles.department_id
  )
);