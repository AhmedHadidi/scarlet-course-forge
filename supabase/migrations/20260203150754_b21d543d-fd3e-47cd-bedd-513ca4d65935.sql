-- Create approval status enum
CREATE TYPE public.approval_status AS ENUM ('pending', 'approved', 'rejected');

-- Add approval columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN approval_status public.approval_status NOT NULL DEFAULT 'pending',
ADD COLUMN approved_at timestamp with time zone,
ADD COLUMN approved_by uuid;

-- Update existing users to 'approved' so they aren't locked out
UPDATE public.profiles SET approval_status = 'approved' WHERE approval_status = 'pending';

-- Create index for faster queries on pending users
CREATE INDEX idx_profiles_approval_status ON public.profiles(approval_status);

-- Allow admins to update approval status on profiles
CREATE POLICY "Admins can update profiles"
ON public.profiles
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));