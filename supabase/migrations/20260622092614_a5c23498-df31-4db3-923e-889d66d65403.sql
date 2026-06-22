
-- Enums
CREATE TYPE public.innovation_category AS ENUM ('time_saving', 'performance', 'automation', 'quality');
CREATE TYPE public.innovation_status AS ENUM ('idea', 'in_progress', 'implemented', 'evaluated');

-- Table
CREATE TABLE public.innovations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category public.innovation_category NOT NULL,
  status public.innovation_status NOT NULL DEFAULT 'idea',
  progress_percentage INT NOT NULL DEFAULT 0 CHECK (progress_percentage BETWEEN 0 AND 100),
  impact_description TEXT,
  time_saved_hours NUMERIC,
  cost_saved NUMERIC,
  tools_used TEXT[] DEFAULT '{}',
  start_date DATE,
  completion_date DATE,
  attachments_urls TEXT[] DEFAULT '{}',
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_innovations_user ON public.innovations(user_id);
CREATE INDEX idx_innovations_department ON public.innovations(department_id);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.innovations TO authenticated;
GRANT ALL ON public.innovations TO service_role;

-- RLS
ALTER TABLE public.innovations ENABLE ROW LEVEL SECURITY;

-- Owner: full access to own rows
CREATE POLICY "Users manage own innovations"
ON public.innovations FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Admins: full read/update on all
CREATE POLICY "Admins read all innovations"
ON public.innovations AS PERMISSIVE FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update all innovations"
ON public.innovations AS PERMISSIVE FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Sub-admins: read/update innovations in their department
CREATE POLICY "Sub-admins read department innovations"
ON public.innovations AS PERMISSIVE FOR SELECT
TO authenticated
USING (
  department_id IS NOT NULL
  AND public.is_department_admin(auth.uid(), department_id)
);

CREATE POLICY "Sub-admins update department innovations"
ON public.innovations AS PERMISSIVE FOR UPDATE
TO authenticated
USING (
  department_id IS NOT NULL
  AND public.is_department_admin(auth.uid(), department_id)
)
WITH CHECK (
  department_id IS NOT NULL
  AND public.is_department_admin(auth.uid(), department_id)
);

-- updated_at trigger
CREATE TRIGGER update_innovations_updated_at
BEFORE UPDATE ON public.innovations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-fill department_id from profile on insert if null
CREATE OR REPLACE FUNCTION public.set_innovation_department()
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

CREATE TRIGGER trg_set_innovation_department
BEFORE INSERT ON public.innovations
FOR EACH ROW EXECUTE FUNCTION public.set_innovation_department();
