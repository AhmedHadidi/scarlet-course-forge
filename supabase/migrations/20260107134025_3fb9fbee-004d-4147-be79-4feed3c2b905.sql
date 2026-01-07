-- Add attempt_type column to quiz_attempts to distinguish pre-course and post-course attempts
ALTER TABLE public.quiz_attempts 
ADD COLUMN attempt_type text NOT NULL DEFAULT 'post' CHECK (attempt_type IN ('pre', 'post'));

-- Add index for faster lookups
CREATE INDEX idx_quiz_attempts_type ON public.quiz_attempts(user_id, quiz_id, attempt_type);