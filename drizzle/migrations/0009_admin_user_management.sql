-- Admin user management: soft-delete/deactivate support.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS profiles_is_active_idx
ON public.profiles(is_active);

CREATE OR REPLACE FUNCTION public.admin_set_user_active(
  p_user uuid,
  p_active boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  IF p_user = auth.uid() THEN
    RAISE EXCEPTION 'Admin cannot deactivate their own account';
  END IF;

  UPDATE public.profiles
  SET is_active = p_active
  WHERE id = p_user;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_user_active(uuid, boolean)
TO authenticated;
