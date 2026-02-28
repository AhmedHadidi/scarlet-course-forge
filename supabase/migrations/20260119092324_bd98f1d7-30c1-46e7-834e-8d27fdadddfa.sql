-- Drop the existing policy that exposes is_correct to all authenticated users
DROP POLICY IF EXISTS "Anyone can view answers of published course quizzes" ON public.quiz_answers;

-- Create a restrictive policy: only admins can view the full quiz_answers table (including is_correct)
CREATE POLICY "Admins can view all quiz answers"
  ON public.quiz_answers FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Create a public view that excludes is_correct for regular users
CREATE OR REPLACE VIEW public.quiz_answers_display AS
  SELECT 
    id,
    question_id,
    answer_text,
    created_at
  FROM public.quiz_answers;

-- Grant SELECT on the view to authenticated users
GRANT SELECT ON public.quiz_answers_display TO authenticated;

-- Add a comment explaining the security design
COMMENT ON VIEW public.quiz_answers_display IS 'Public view of quiz answers that excludes is_correct field to prevent cheating. Full access available to admins via quiz_answers table.';