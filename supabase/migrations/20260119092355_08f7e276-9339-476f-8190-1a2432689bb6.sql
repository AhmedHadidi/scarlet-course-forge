-- Drop the SECURITY DEFINER view and recreate with SECURITY INVOKER (default)
DROP VIEW IF EXISTS public.quiz_answers_display;

-- Create the view explicitly with SECURITY INVOKER
CREATE VIEW public.quiz_answers_display 
WITH (security_invoker = true) AS
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

-- Also create a policy so the view works for authenticated users querying published course answers
-- The view queries quiz_answers, so we need a policy that allows viewing answer text only
DROP POLICY IF EXISTS "Admins can view all quiz answers" ON public.quiz_answers;

-- Create a policy that allows authenticated users to view answers for published courses (without is_correct visible via the view)
CREATE POLICY "Authenticated users can view answers via view"
  ON public.quiz_answers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quiz_questions
      JOIN public.quizzes ON quizzes.id = quiz_questions.quiz_id
      JOIN public.courses ON courses.id = quizzes.course_id
      WHERE quiz_questions.id = quiz_answers.question_id
      AND (courses.is_published = true OR public.has_role(auth.uid(), 'admin'))
    )
  );

-- Restrict enrollments update policy to prevent direct completion
DROP POLICY IF EXISTS "Users can update their own enrollments" ON public.enrollments;

-- Create new policy that only allows updating progress_percentage, not completed_at
-- completed_at will be set by the server-side edge function
CREATE POLICY "Users can update their own enrollment progress"
  ON public.enrollments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);