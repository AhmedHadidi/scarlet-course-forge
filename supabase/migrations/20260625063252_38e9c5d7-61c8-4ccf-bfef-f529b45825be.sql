
CREATE TABLE public.prompt_copies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prompt_id UUID NOT NULL REFERENCES public.prompts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  copied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.prompt_copies TO authenticated;
GRANT ALL ON public.prompt_copies TO service_role;

ALTER TABLE public.prompt_copies ENABLE ROW LEVEL SECURITY;

-- Users can log their own copy events
CREATE POLICY "Users can insert their own copy events"
ON public.prompt_copies FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Admins can see all copies
CREATE POLICY "Admins can view all copy events"
ON public.prompt_copies AS PERMISSIVE FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Sub-admins can see copies from their department(s)
CREATE POLICY "Sub-admins can view their department copy events"
ON public.prompt_copies AS PERMISSIVE FOR SELECT TO authenticated
USING (
  department_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.department_admins da
    WHERE da.user_id = auth.uid() AND da.department_id = prompt_copies.department_id
  )
);

-- Users can see their own copy events (for personal history if needed)
CREATE POLICY "Users can view their own copy events"
ON public.prompt_copies AS PERMISSIVE FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX idx_prompt_copies_prompt_id ON public.prompt_copies(prompt_id);
CREATE INDEX idx_prompt_copies_user_id ON public.prompt_copies(user_id);
CREATE INDEX idx_prompt_copies_department_id ON public.prompt_copies(department_id);
CREATE INDEX idx_prompt_copies_copied_at ON public.prompt_copies(copied_at DESC);

-- Trigger to auto-set department_id from the user's profile
CREATE OR REPLACE FUNCTION public.set_prompt_copy_department()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.department_id IS NULL THEN
    SELECT department_id INTO NEW.department_id
    FROM public.profiles WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_prompt_copy_department
BEFORE INSERT ON public.prompt_copies
FOR EACH ROW EXECUTE FUNCTION public.set_prompt_copy_department();
