
CREATE OR REPLACE FUNCTION public.get_monthly_top_performers()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  month_start timestamptz := date_trunc('month', now());
  top_innovator record;
  top_learner record;
  result jsonb := jsonb_build_object('innovator', null, 'learner', null);
BEGIN
  SELECT p.full_name, COUNT(i.id) AS cnt
  INTO top_innovator
  FROM public.innovations i
  JOIN public.profiles p ON p.id = i.user_id
  WHERE i.created_at >= month_start
  GROUP BY p.full_name
  ORDER BY cnt DESC, p.full_name ASC
  LIMIT 1;

  IF top_innovator.full_name IS NOT NULL THEN
    result := jsonb_set(result, '{innovator}', jsonb_build_object(
      'full_name', top_innovator.full_name,
      'count', top_innovator.cnt
    ));
  END IF;

  SELECT p.full_name,
         COALESCE(SUM(ve.watch_time_seconds), 0) AS total_seconds
  INTO top_learner
  FROM public.video_engagement ve
  JOIN public.profiles p ON p.id = ve.user_id
  WHERE ve.updated_at >= month_start
  GROUP BY p.full_name
  ORDER BY total_seconds DESC, p.full_name ASC
  LIMIT 1;

  IF top_learner.full_name IS NOT NULL THEN
    result := jsonb_set(result, '{learner}', jsonb_build_object(
      'full_name', top_learner.full_name,
      'watch_seconds', top_learner.total_seconds
    ));
  END IF;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_monthly_top_performers() TO anon, authenticated;
