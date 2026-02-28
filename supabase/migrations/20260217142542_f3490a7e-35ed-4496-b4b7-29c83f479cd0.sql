
-- Table for granular video player events (play, pause, seek, speed change, etc.)
CREATE TABLE public.video_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  video_id uuid NOT NULL REFERENCES public.course_videos(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  event_type text NOT NULL,
  video_time numeric NOT NULL DEFAULT 0,
  total_duration numeric NOT NULL DEFAULT 0,
  playback_rate numeric NOT NULL DEFAULT 1,
  percentage_watched numeric NOT NULL DEFAULT 0,
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index for querying by user+video+session
CREATE INDEX idx_video_events_user_video ON public.video_events(user_id, video_id);
CREATE INDEX idx_video_events_session ON public.video_events(session_id);
CREATE INDEX idx_video_events_created ON public.video_events(created_at DESC);

-- Enable RLS
ALTER TABLE public.video_events ENABLE ROW LEVEL SECURITY;

-- Users can insert their own events
CREATE POLICY "Users can insert their own events"
ON public.video_events FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can view their own events
CREATE POLICY "Users can view their own events"
ON public.video_events FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all events
CREATE POLICY "Admins can view all events"
ON public.video_events FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Sub-admins can view department user events
CREATE POLICY "Sub-admins can view department events"
ON public.video_events FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM department_admins da
    JOIN profiles p ON p.department_id = da.department_id
    WHERE da.user_id = auth.uid() AND p.id = video_events.user_id
  )
  AND has_role(auth.uid(), 'sub_admin'::app_role)
);

-- Add behavioral indicator columns to video_engagement
ALTER TABLE public.video_engagement
  ADD COLUMN IF NOT EXISTS session_id text,
  ADD COLUMN IF NOT EXISTS pause_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rewind_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS skip_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completion_rate numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_playback_rate numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS drop_off_point numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS repeated_segments jsonb DEFAULT '[]';

-- Privacy tracking preference in profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tracking_opt_in boolean NOT NULL DEFAULT true;
