-- SETTLE HELPERS
CREATE OR REPLACE FUNCTION public.settle_battle_win(_battle uuid, _winner uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b public.battles%ROWTYPE; loser uuid; p uuid; comm numeric;
BEGIN
  SELECT * INTO b FROM public.battles WHERE id = _battle FOR UPDATE;
  IF b.status IN ('completed','cancelled') THEN RETURN; END IF;
  loser := CASE WHEN _winner = b.creator_id THEN b.opponent_id ELSE b.creator_id END;

  PERFORM public.wallet_credit(_winner, b.prize, 'winning');
  INSERT INTO public.transactions (user_id, type, amount, note, meta)
  VALUES (_winner, 'winning', b.prize, 'Battle won', jsonb_build_object('battle_id', _battle));

  UPDATE public.profiles SET battles_won = battles_won + 1 WHERE id = _winner;
  UPDATE public.profiles SET battles_lost = battles_lost + 1 WHERE id = loser;

  comm := round(b.amount * 0.02, 2);
  FOR p IN SELECT unnest(ARRAY[b.creator_id, b.opponent_id]) LOOP
    DECLARE ref uuid;
    BEGIN
      SELECT referred_by INTO ref FROM public.profiles WHERE id = p;
      IF ref IS NOT NULL AND comm > 0 THEN
        PERFORM public.wallet_credit(ref, comm, 'winning');
        INSERT INTO public.referral_earnings (referrer_id, referred_id, battle_id, amount) VALUES (ref, p, _battle, comm);
        INSERT INTO public.transactions (user_id, type, amount, note, meta)
        VALUES (ref, 'referral', comm, 'Referral commission', jsonb_build_object('battle_id', _battle));
      END IF;
    END;
  END LOOP;

  UPDATE public.battles SET status = 'completed', winner_id = _winner, settled_at = now() WHERE id = _battle;
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_battle(_battle uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b public.battles%ROWTYPE;
BEGIN
  SELECT * INTO b FROM public.battles WHERE id = _battle FOR UPDATE;
  IF b.status IN ('completed','cancelled') THEN RETURN; END IF;
  PERFORM public.wallet_credit(b.creator_id, b.amount, 'deposit');
  INSERT INTO public.transactions (user_id, type, amount, note, meta) VALUES (b.creator_id,'refund',b.amount,'Battle cancelled refund', jsonb_build_object('battle_id',_battle));
  IF b.opponent_id IS NOT NULL THEN
    PERFORM public.wallet_credit(b.opponent_id, b.amount, 'deposit');
    INSERT INTO public.transactions (user_id, type, amount, note, meta) VALUES (b.opponent_id,'refund',b.amount,'Battle cancelled refund', jsonb_build_object('battle_id',_battle));
  END IF;
  UPDATE public.battles SET status='cancelled', settled_at = now() WHERE id = _battle;
END;
$$;

-- CREATE BATTLE
CREATE OR REPLACE FUNCTION public.create_battle(p_game text, p_amount numeric)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); bid uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_amount < 10 THEN RAISE EXCEPTION 'Minimum battle amount is 10'; END IF;
  PERFORM public.wallet_debit(uid, p_amount);
  INSERT INTO public.battles (game, amount, prize, creator_id)
  VALUES (p_game, p_amount, round(p_amount * 2 * 0.95, 2), uid) RETURNING id INTO bid;
  INSERT INTO public.transactions (user_id, type, amount, note, meta)
  VALUES (uid, 'bet', p_amount, 'Battle created', jsonb_build_object('battle_id', bid));
  RETURN bid;
END;
$$;

-- ACCEPT BATTLE
CREATE OR REPLACE FUNCTION public.accept_battle(p_battle uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); b public.battles%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO b FROM public.battles WHERE id = p_battle FOR UPDATE;
  IF b.id IS NULL THEN RAISE EXCEPTION 'Battle not found'; END IF;
  IF b.status <> 'open' THEN RAISE EXCEPTION 'Battle is no longer open'; END IF;
  IF b.creator_id = uid THEN RAISE EXCEPTION 'You cannot accept your own battle'; END IF;
  PERFORM public.wallet_debit(uid, b.amount);
  UPDATE public.battles SET opponent_id = uid, status = 'running', started_at = now() WHERE id = p_battle;
  INSERT INTO public.transactions (user_id, type, amount, note, meta)
  VALUES (uid, 'bet', b.amount, 'Battle joined', jsonb_build_object('battle_id', p_battle));
END;
$$;

-- CANCEL OPEN BATTLE (creator)
CREATE OR REPLACE FUNCTION public.cancel_open_battle(p_battle uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); b public.battles%ROWTYPE;
BEGIN
  SELECT * INTO b FROM public.battles WHERE id = p_battle;
  IF b.creator_id <> uid THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF b.status <> 'open' THEN RAISE EXCEPTION 'Battle already started'; END IF;
  PERFORM public.refund_battle(p_battle);
END;
$$;

-- ROOM CODE
CREATE OR REPLACE FUNCTION public.set_room_code(p_battle uuid, p_code text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); b public.battles%ROWTYPE;
BEGIN
  SELECT * INTO b FROM public.battles WHERE id = p_battle;
  IF uid NOT IN (b.creator_id, COALESCE(b.opponent_id, b.creator_id)) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF b.status <> 'running' THEN RAISE EXCEPTION 'Battle is not running'; END IF;
  UPDATE public.battles SET room_code = p_code WHERE id = p_battle;
END;
$$;

-- SUBMIT RESULT
CREATE OR REPLACE FUNCTION public.submit_battle_result(p_battle uuid, p_claim public.result_claim, p_screenshot text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); b public.battles%ROWTYPE; other uuid; oc public.result_claim; cnt int;
BEGIN
  SELECT * INTO b FROM public.battles WHERE id = p_battle FOR UPDATE;
  IF uid NOT IN (b.creator_id, COALESCE(b.opponent_id, b.creator_id)) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF b.status NOT IN ('running','result_pending') THEN RAISE EXCEPTION 'Result cannot be submitted now'; END IF;

  INSERT INTO public.battle_results (battle_id, user_id, claim, screenshot_url)
  VALUES (p_battle, uid, p_claim, p_screenshot)
  ON CONFLICT (battle_id, user_id) DO UPDATE SET claim = EXCLUDED.claim, screenshot_url = EXCLUDED.screenshot_url;

  other := CASE WHEN uid = b.creator_id THEN b.opponent_id ELSE b.creator_id END;
  SELECT claim INTO oc FROM public.battle_results WHERE battle_id = p_battle AND user_id = other;

  IF oc IS NULL THEN
    UPDATE public.battles SET status = 'result_pending' WHERE id = p_battle;
    RETURN 'result_pending';
  END IF;

  IF p_claim = 'won' AND oc = 'lost' THEN PERFORM public.settle_battle_win(p_battle, uid); RETURN 'completed'; END IF;
  IF p_claim = 'lost' AND oc = 'won' THEN PERFORM public.settle_battle_win(p_battle, other); RETURN 'completed'; END IF;
  IF p_claim = 'cancel' AND oc = 'cancel' THEN PERFORM public.refund_battle(p_battle); RETURN 'cancelled'; END IF;

  UPDATE public.battles SET status = 'disputed' WHERE id = p_battle;
  RETURN 'disputed';
END;
$$;

-- ADMIN: resolve battle
CREATE OR REPLACE FUNCTION public.admin_resolve_battle(p_battle uuid, p_winner uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin only'; END IF;
  IF p_winner IS NULL THEN PERFORM public.refund_battle(p_battle);
  ELSE PERFORM public.settle_battle_win(p_battle, p_winner); END IF;
END;
$$;

-- DEPOSITS
CREATE OR REPLACE FUNCTION public.create_deposit_request(p_amount numeric, p_utr text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); did uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_amount < 10 THEN RAISE EXCEPTION 'Minimum deposit is 10'; END IF;
  INSERT INTO public.deposit_requests (user_id, amount, utr) VALUES (uid, p_amount, p_utr) RETURNING id INTO did;
  INSERT INTO public.transactions (user_id, type, amount, status, note, meta)
  VALUES (uid, 'deposit', p_amount, 'pending', 'Deposit requested', jsonb_build_object('deposit_id', did));
  RETURN did;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_process_deposit(p_id uuid, p_approve boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.deposit_requests%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin only'; END IF;
  SELECT * INTO d FROM public.deposit_requests WHERE id = p_id FOR UPDATE;
  IF d.status <> 'pending' THEN RAISE EXCEPTION 'Already processed'; END IF;
  IF p_approve THEN
    PERFORM public.wallet_credit(d.user_id, d.amount, 'deposit');
    UPDATE public.deposit_requests SET status='completed', processed_at=now() WHERE id=p_id;
    UPDATE public.transactions SET status='completed', note='Deposit added' WHERE (meta->>'deposit_id')::uuid = p_id;
  ELSE
    UPDATE public.deposit_requests SET status='rejected', processed_at=now() WHERE id=p_id;
    UPDATE public.transactions SET status='rejected', note='Deposit rejected' WHERE (meta->>'deposit_id')::uuid = p_id;
  END IF;
END;
$$;

-- WITHDRAWALS
CREATE OR REPLACE FUNCTION public.request_withdrawal(p_amount numeric, p_method text, p_upi text DEFAULT NULL, p_name text DEFAULT NULL, p_account text DEFAULT NULL, p_ifsc text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); wid uuid; w public.wallets%ROWTYPE; k public.kyc_status;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT kyc_status INTO k FROM public.profiles WHERE id = uid;
  IF k <> 'approved' THEN RAISE EXCEPTION 'KYC verification required before withdrawal'; END IF;
  IF p_amount < 100 THEN RAISE EXCEPTION 'Minimum withdrawal is 100'; END IF;
  SELECT * INTO w FROM public.wallets WHERE user_id = uid FOR UPDATE;
  IF w.winning_cash < p_amount THEN RAISE EXCEPTION 'Not enough winning cash'; END IF;
  UPDATE public.wallets SET winning_cash = winning_cash - p_amount, updated_at = now() WHERE user_id = uid;
  INSERT INTO public.withdrawals (user_id, amount, method, upi_id, account_name, account_number, ifsc)
  VALUES (uid, p_amount, p_method, p_upi, p_name, p_account, p_ifsc) RETURNING id INTO wid;
  INSERT INTO public.transactions (user_id, type, amount, status, note, meta)
  VALUES (uid, 'withdrawal', p_amount, 'pending', 'Withdrawal requested', jsonb_build_object('withdrawal_id', wid));
  RETURN wid;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_process_withdrawal(p_id uuid, p_status public.txn_status, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE wd public.withdrawals%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin only'; END IF;
  SELECT * INTO wd FROM public.withdrawals WHERE id = p_id FOR UPDATE;
  IF wd.status IN ('completed','rejected') THEN RAISE EXCEPTION 'Already processed'; END IF;
  UPDATE public.withdrawals SET status = p_status, admin_note = p_note,
    processed_at = CASE WHEN p_status IN ('completed','rejected') THEN now() ELSE NULL END WHERE id = p_id;
  UPDATE public.transactions SET status = p_status WHERE (meta->>'withdrawal_id')::uuid = p_id;
  IF p_status = 'rejected' THEN
    PERFORM public.wallet_credit(wd.user_id, wd.amount, 'winning');
    INSERT INTO public.transactions (user_id, type, amount, note, meta)
    VALUES (wd.user_id, 'refund', wd.amount, 'Withdrawal rejected refund', jsonb_build_object('withdrawal_id', p_id));
  END IF;
END;
$$;

-- KYC
CREATE OR REPLACE FUNCTION public.admin_process_kyc(p_id uuid, p_status public.kyc_status, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k public.kyc_submissions%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin only'; END IF;
  SELECT * INTO k FROM public.kyc_submissions WHERE id = p_id;
  UPDATE public.kyc_submissions SET status = p_status, admin_note = p_note WHERE id = p_id;
  UPDATE public.profiles SET kyc_status = p_status WHERE id = k.user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_kyc_pending()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles SET kyc_status = 'pending' WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER kyc_submitted AFTER INSERT ON public.kyc_submissions
FOR EACH ROW EXECUTE FUNCTION public.mark_kyc_pending();

-- ADMIN METRICS
CREATE OR REPLACE FUNCTION public.admin_metrics()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin only'; END IF;
  SELECT jsonb_build_object(
    'users', (SELECT count(*) FROM public.profiles),
    'battles', (SELECT count(*) FROM public.battles),
    'open_battles', (SELECT count(*) FROM public.battles WHERE status='open'),
    'disputes', (SELECT count(*) FROM public.battles WHERE status='disputed'),
    'pending_withdrawals', (SELECT count(*) FROM public.withdrawals WHERE status='pending'),
    'pending_deposits', (SELECT count(*) FROM public.deposit_requests WHERE status='pending'),
    'pending_kyc', (SELECT count(*) FROM public.kyc_submissions WHERE status='pending'),
    'volume', (SELECT COALESCE(sum(amount),0) FROM public.transactions WHERE type='bet')
  ) INTO r;
  RETURN r;
END;
$$;

-- claim admin if no admin exists yet (bootstrap for the first operator)
CREATE OR REPLACE FUNCTION public.claim_admin()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role='admin') THEN RETURN false; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(),'admin') ON CONFLICT DO NOTHING;
  RETURN true;
END;
$$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.battles;
