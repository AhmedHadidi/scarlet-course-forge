
-- Add 'sub_admin' to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'sub_admin';

-- Create departments table
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on departments
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- Anyone can view departments (needed for signup dropdown)
CREATE POLICY "Anyone can view departments"
ON public.departments
FOR SELECT
USING (true);

-- Only admins can manage departments
CREATE POLICY "Admins can manage departments"
ON public.departments
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create department_admins table to link sub-admins to departments
CREATE TABLE public.department_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(department_id, user_id)
);

-- Enable RLS on department_admins
ALTER TABLE public.department_admins ENABLE ROW LEVEL SECURITY;

-- Admins can manage department_admins
CREATE POLICY "Admins can manage department admins"
ON public.department_admins
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Sub-admins can view their own assignments
CREATE POLICY "Sub-admins can view their assignments"
ON public.department_admins
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Add department_id to profiles table
ALTER TABLE public.profiles
ADD COLUMN department_id UUID REFERENCES public.departments(id);

-- Create function to check if user is sub-admin of a department
CREATE OR REPLACE FUNCTION public.is_department_admin(_user_id uuid, _department_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.department_admins
    WHERE user_id = _user_id
      AND department_id = _department_id
  )
$$;

-- Update profiles RLS to allow sub-admins to view users in their department
CREATE POLICY "Sub-admins can view department users"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM public.department_admins da
    WHERE da.user_id = auth.uid()
      AND da.department_id = profiles.department_id
  )
);

-- Create trigger for updated_at on departments
CREATE TRIGGER update_departments_updated_at
BEFORE UPDATE ON public.departments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
