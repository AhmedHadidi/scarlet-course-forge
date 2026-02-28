-- Allow users to update their own enrollment progress
CREATE POLICY "Users can update their own enrollments"
ON public.enrollments
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);