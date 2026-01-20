-- Enable Row Level Security on quiz_answers_display view
ALTER VIEW public.quiz_answers_display SET (security_invoker = on);

-- Create RLS policy to allow only admins to access quiz_answers_display
CREATE POLICY "Only admins can view quiz answers display"
ON public.quiz_answers
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));