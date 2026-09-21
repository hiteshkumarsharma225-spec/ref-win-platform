-- Safe demo-only admin controls.
-- These functions never credit winning_cash/deposit_cash and never perform cash payouts.

CREATE OR REPLACE FUNCTION public.admin_resolve_demo_battle(p_battle uuid, p_winner uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b public.battles%ROWTYPE;
  participant boolean;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  SELECT * INTO b FROM public.battles WHERE id = p_battle FOR UPDATE;

  IF b.id IS NULL THEN RAISE EXCEPTION 'Battle not found'; END IF;
  IF b.status NOT IN ('result_pending', 'disputed') THEN
    RAISE EXCEPTION 'Battle is not awaiting review';
  END IF;

  participant := p_winner = b.creator_id OR p_winner = b.opponent_id;
  IF NOT participant THEN RAISE EXCEPTION 'Winner must be a battle participant'; END IF;

  UPDATE public.wallets
  SET bonus_cash = bonus_cash + b.prize, updated_at = now()
  WHERE user_id = p_winner;

  INSERT INTO public.transactions(user_id, type, amount, status, note, meta)
  VALUES (
    p_winner,
    'bonus',
    b.prize,
    'completed',
    'Demo battle result approved by admin',
    jsonb_build_object('battle_id', b.id, 'virtual_demo', true)
  );

  UPDATE public.battles
  SET status = 'completed',
      winner_id = p_winner,
      settled_at = now(),
      result_resolved_at = now(),
      result_resolution = 'admin_demo_approved'
  WHERE id = b.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_adjust_demo_credits(
  p_user uuid,
  p_delta numeric,
  p_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_bonus numeric;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  IF p_delta = 0 THEN RAISE EXCEPTION 'Adjustment cannot be zero'; END IF;

  SELECT bonus_cash INTO current_bonus
  FROM public.wallets
  WHERE user_id = p_user
  FOR UPDATE;

  IF current_bonus IS NULL THEN RAISE EXCEPTION 'Wallet not found'; END IF;
  IF current_bonus + p_delta < 0 THEN RAISE EXCEPTION 'Demo credit balance cannot become negative'; END IF;

  UPDATE public.wallets
  SET bonus_cash = bonus_cash + p_delta, updated_at = now()
  WHERE user_id = p_user;

  INSERT INTO public.transactions(user_id, type, amount, status, note, meta)
  VALUES (
    p_user,
    'bonus',
    abs(p_delta),
    'completed',
    COALESCE(p_note, 'Admin demo-credit adjustment'),
    jsonb_build_object(
      'virtual_demo', true,
      'direction', CASE WHEN p_delta > 0 THEN 'credit' ELSE 'debit' END,
      'delta', p_delta,
      'admin_id', auth.uid()
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_resolve_demo_battle(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_adjust_demo_credits(uuid, numeric, text) TO authenticated;
