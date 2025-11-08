-- Add allow_retakes column to quizzes table
ALTER TABLE public.quizzes
ADD COLUMN allow_retakes boolean NOT NULL DEFAULT false;

-- Create feature_settings table for admin control
CREATE TABLE public.feature_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_name text NOT NULL UNIQUE,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on feature_settings
ALTER TABLE public.feature_settings ENABLE ROW LEVEL SECURITY;

-- Admins can manage feature settings
CREATE POLICY "Admins can manage feature settings"
ON public.feature_settings
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Anyone can view feature settings (users need to know what features are enabled)
CREATE POLICY "Anyone can view feature settings"
ON public.feature_settings
FOR SELECT
USING (true);

-- Insert default feature settings
INSERT INTO public.feature_settings (feature_name, is_enabled) VALUES
  ('certificates', true),
  ('notifications', true);

-- Add trigger for updated_at
CREATE TRIGGER update_feature_settings_updated_at
  BEFORE UPDATE ON public.feature_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();