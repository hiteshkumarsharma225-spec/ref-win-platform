-- Virtual-credit battle system
-- Safe mode: battle entry/rewards use ONLY wallets.bonus_cash.

ALTER TABLE public.battles
  ADD COLUMN IF NOT EXISTS open_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS result_deadline_at timestamptz;

UPDATE public.battles
SET open_expires_at = created_at + interval '180 seconds'
WHERE status = 'open' AND open_expires_at IS NULL;

CREATE OR REPLACE FUNCTION public.create_battle(p_game text, p_amount numeric)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  bid uuid;
  v_balance numeric;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_amount < 10 THEN RAISE EXCEPTION 'Minimum battle amount is 10 virtual credits'; END IF;
  IF p_amount > 100000 THEN RAISE EXCEPTION 'Battle amount is too high'; END IF;

  SELECT bonus_cash INTO v_balance FROM public.wallets WHERE user_id = uid FOR UPDATE;
  IF COALESCE(v_balance, 0) < p_amount THEN
    RAISE EXCEPTION 'Not enough virtual credits';
  END IF;

  UPDATE public.wallets
  SET bonus_cash = bonus_cash - p_amount, updated_at = now()
  WHERE user_id = uid;

  INSERT INTO public.battles (
    game, amount, prize, creator_id, open_expires_at
  )
  VALUES (
    p_game, p_amount, round(p_amount * 1.90, 2), uid, now() + interval '180 seconds'
  )
  RETURNING id INTO bid;

  INSERT INTO public.transactions (user_id, type, amount, note, meta)
  VALUES (
    uid, 'bet', p_amount, 'Virtual credits locked for battle',
    jsonb_build_object('battle_id', bid, 'virtual_demo', true)
  );

  RETURN bid;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_battle(p_battle uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  b public.battles%ROWTYPE;
  v_balance numeric;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO b FROM public.battles WHERE id = p_battle FOR UPDATE;
  IF b.id IS NULL THEN RAISE EXCEPTION 'Battle not found'; END IF;

  IF b.status <> 'open' THEN RAISE EXCEPTION 'Battle is no longer open'; END IF;
  IF b.open_expires_at IS NOT NULL AND b.open_expires_at <= now() THEN
    UPDATE public.battles SET status='cancelled', settled_at=now()
    WHERE id=p_battle AND status='open';
    UPDATE public.wallets
    SET bonus_cash = bonus_cash + b.amount, updated_at=now()
    WHERE user_id=b.creator_id;
    RAISE EXCEPTION 'Battle expired and the creator was refunded';
  END IF;
  IF b.creator_id = uid THEN RAISE EXCEPTION 'You cannot accept your own battle'; END IF;

  SELECT bonus_cash INTO v_balance FROM public.wallets WHERE user_id=uid FOR UPDATE;
  IF COALESCE(v_balance,0) < b.amount THEN RAISE EXCEPTION 'Not enough virtual credits'; END IF;

  UPDATE public.wallets
  SET bonus_cash = bonus_cash - b.amount, updated_at=now()
  WHERE user_id=uid;

  UPDATE public.battles
  SET opponent_id=uid,
      status='running',
      started_at=now(),
      result_deadline_at=now() + interval '2 hours'
  WHERE id=p_battle;

  INSERT INTO public.transactions (user_id, type, amount, note, meta)
  VALUES (
    uid, 'bet', b.amount, 'Virtual credits locked for battle',
    jsonb_build_object('battle_id', p_battle, 'virtual_demo', true)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_battle(_battle uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  b public.battles%ROWTYPE;
BEGIN
  SELECT * INTO b FROM public.battles WHERE id=_battle FOR UPDATE;
  IF b.id IS NULL OR b.status IN ('completed','cancelled') THEN RETURN; END IF;

  UPDATE public.wallets
  SET bonus_cash = bonus_cash + b.amount, updated_at=now()
  WHERE user_id=b.creator_id;

  INSERT INTO public.transactions (user_id,type,amount,note,meta)
  VALUES (
    b.creator_id,'refund',b.amount,'Virtual credits refunded',
    jsonb_build_object('battle_id',_battle,'virtual_demo',true)
  );

  IF b.opponent_id IS NOT NULL THEN
    UPDATE public.wallets
    SET bonus_cash = bonus_cash + b.amount, updated_at=now()
    WHERE user_id=b.opponent_id;

    INSERT INTO public.transactions (user_id,type,amount,note,meta)
    VALUES (
      b.opponent_id,'refund',b.amount,'Virtual credits refunded',
      jsonb_build_object('battle_id',_battle,'virtual_demo',true)
    );
  END IF;

  UPDATE public.battles
  SET status='cancelled', settled_at=now()
  WHERE id=_battle;
END;
$$;

CREATE OR REPLACE FUNCTION public.settle_battle_win(_battle uuid, _winner uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  b public.battles%ROWTYPE;
  loser uuid;
BEGIN
  SELECT * INTO b FROM public.battles WHERE id=_battle FOR UPDATE;
  IF b.id IS NULL OR b.status IN ('completed','cancelled') THEN RETURN; END IF;
  IF _winner NOT IN (b.creator_id, COALESCE(b.opponent_id,b.creator_id)) THEN
    RAISE EXCEPTION 'Winner is not a battle participant';
  END IF;

  loser := CASE WHEN _winner=b.creator_id THEN b.opponent_id ELSE b.creator_id END;

  UPDATE public.wallets
  SET bonus_cash = bonus_cash + b.prize, updated_at=now()
  WHERE user_id=_winner;

  INSERT INTO public.transactions (user_id,type,amount,note,meta)
  VALUES (
    _winner,'winning',b.prize,'Virtual battle reward',
    jsonb_build_object('battle_id',_battle,'virtual_demo',true)
  );

  UPDATE public.profiles
  SET battles_won=battles_won+1
  WHERE id=_winner;

  IF loser IS NOT NULL THEN
    UPDATE public.profiles
    SET battles_lost=battles_lost+1
    WHERE id=loser;
  END IF;

  UPDATE public.battles
  SET status='completed', winner_id=_winner, settled_at=now()
  WHERE id=_battle;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_open_battle(p_battle uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  b public.battles%ROWTYPE;
BEGIN
  SELECT * INTO b FROM public.battles WHERE id=p_battle FOR UPDATE;
  IF b.creator_id <> uid THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF b.status <> 'open' THEN RAISE EXCEPTION 'Battle already started'; END IF;
  PERFORM public.refund_battle(p_battle);
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_open_battles()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  b public.battles%ROWTYPE;
  n integer := 0;
BEGIN
  FOR b IN
    SELECT * FROM public.battles
    WHERE status='open'
      AND open_expires_at IS NOT NULL
      AND open_expires_at <= now()
    FOR UPDATE SKIP LOCKED
  LOOP
    PERFORM public.refund_battle(b.id);
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_battle_result(
  p_battle uuid,
  p_claim public.result_claim,
  p_screenshot text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  b public.battles%ROWTYPE;
  other uuid;
  my_claim public.result_claim;
  other_claim public.result_claim;
BEGIN
  SELECT * INTO b FROM public.battles WHERE id=p_battle FOR UPDATE;

  IF b.id IS NULL THEN RAISE EXCEPTION 'Battle not found'; END IF;
  IF uid NOT IN (b.creator_id, COALESCE(b.opponent_id,b.creator_id)) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF b.status NOT IN ('running','result_pending') THEN
    RAISE EXCEPTION 'Result cannot be submitted now';
  END IF;

  IF b.result_deadline_at IS NOT NULL AND b.result_deadline_at <= now() THEN
    SELECT claim INTO my_claim
    FROM public.battle_results
    WHERE battle_id=p_battle AND user_id=uid;

    SELECT claim INTO other_claim
    FROM public.battle_results
    WHERE battle_id=p_battle
      AND user_id=CASE WHEN uid=b.creator_id THEN b.opponent_id ELSE b.creator_id END;

    IF my_claim='won' AND other_claim IS NULL THEN
      PERFORM public.settle_battle_win(p_battle,uid);
      RETURN 'completed';
    ELSIF other_claim='won' AND my_claim IS NULL THEN
      PERFORM public.settle_battle_win(p_battle,CASE WHEN uid=b.creator_id THEN b.opponent_id ELSE b.creator_id END);
      RETURN 'completed';
    ELSIF my_claim='won' AND other_claim='won' THEN
      UPDATE public.battles SET status='disputed' WHERE id=p_battle;
      RETURN 'disputed';
    ELSE
      PERFORM public.refund_battle(p_battle);
      RETURN 'cancelled';
    END IF;
  END IF;

  INSERT INTO public.battle_results (battle_id,user_id,claim,screenshot_url)
  VALUES (p_battle,uid,p_claim,p_screenshot)
  ON CONFLICT (battle_id,user_id)
  DO UPDATE SET claim=EXCLUDED.claim,screenshot_url=EXCLUDED.screenshot_url;

  other := CASE WHEN uid=b.creator_id THEN b.opponent_id ELSE b.creator_id END;

  SELECT claim INTO other_claim
  FROM public.battle_results
  WHERE battle_id=p_battle AND user_id=other;

  IF other_claim IS NULL THEN
    UPDATE public.battles SET status='result_pending' WHERE id=p_battle;
    RETURN 'result_pending';
  END IF;

  IF p_claim='won' AND other_claim='lost' THEN
    PERFORM public.settle_battle_win(p_battle,uid);
    RETURN 'completed';
  END IF;

  IF p_claim='lost' AND other_claim='won' THEN
    PERFORM public.settle_battle_win(p_battle,other);
    RETURN 'completed';
  END IF;

  IF p_claim='cancel' AND other_claim='cancel' THEN
    PERFORM public.refund_battle(p_battle);
    RETURN 'cancelled';
  END IF;

  UPDATE public.battles SET status='disputed' WHERE id=p_battle;
  RETURN 'disputed';
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_open_battles() TO authenticated;

COMMENT ON FUNCTION public.create_battle IS 'Virtual-credit battle only. Uses wallets.bonus_cash; no cash payout.';
COMMENT ON FUNCTION public.accept_battle IS 'Virtual-credit battle only. Uses wallets.bonus_cash; no cash payout.';
COMMENT ON FUNCTION public.settle_battle_win IS 'Virtual-credit reward only. Uses wallets.bonus_cash; no cash payout.';
