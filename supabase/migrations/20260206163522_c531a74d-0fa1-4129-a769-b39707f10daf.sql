
-- Create table to store video engagement metrics for verification
CREATE TABLE public.video_engagement (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  video_id UUID NOT NULL REFERENCES public.course_videos(id) ON DELETE CASCADE,
  watch_time_seconds INTEGER NOT NULL DEFAULT 0,
  total_duration_seconds INTEGER NOT NULL DEFAULT 0,
  tab_switches INTEGER NOT NULL DEFAULT 0,
  engagement_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  ai_verification_passed BOOLEAN DEFAULT NULL,
  ai_question TEXT DEFAULT NULL,
  ai_user_answer TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, video_id)
);

-- Enable RLS
ALTER TABLE public.video_engagement ENABLE ROW LEVEL SECURITY;

-- Users can view their own engagement data
CREATE POLICY "Users can view their own engagement" 
ON public.video_engagement 
FOR SELECT 
USING (auth.uid() = user_id);

-- Users can insert their own engagement data
CREATE POLICY "Users can insert their own engagement" 
ON public.video_engagement 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can update their own engagement data
CREATE POLICY "Users can update their own engagement" 
ON public.video_engagement 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Admins can view all engagement data
CREATE POLICY "Admins can view all engagement" 
ON public.video_engagement 
FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_video_engagement_updated_at
BEFORE UPDATE ON public.video_engagement
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
