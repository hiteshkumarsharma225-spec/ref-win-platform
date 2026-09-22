-- Match result response + user complaints
ALTER TABLE public.battles
  ADD COLUMN IF NOT EXISTS opponent_result_deadline_at timestamptz,
  ADD COLUMN IF NOT EXISTS objection_deadline_at timestamptz;

CREATE TABLE IF NOT EXISTS public.match_complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  battle_id uuid NOT NULL REFERENCES public.battles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  concern text NOT NULL CHECK (length(trim(concern)) >= 3),
  proof_url text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','under_review','resolved','rejected')),
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS match_complaints_battle_idx ON public.match_complaints(battle_id, created_at DESC);
CREATE INDEX IF NOT EXISTS match_complaints_user_idx ON public.match_complaints(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS match_complaints_status_idx ON public.match_complaints(status, created_at DESC);

ALTER TABLE public.match_complaints ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own match complaints" ON public.match_complaints;
CREATE POLICY "Users can view own match complaints" ON public.match_complaints
FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "Users can create own match complaints" ON public.match_complaints;
CREATE POLICY "Users can create own match complaints" ON public.match_complaints
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.battles b
    WHERE b.id = battle_id AND (b.creator_id = auth.uid() OR b.opponent_id = auth.uid())
  )
);
DROP POLICY IF EXISTS "Admins can update match complaints" ON public.match_complaints;
CREATE POLICY "Admins can update match complaints" ON public.match_complaints
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin'))
WITH CHECK (public.has_role(auth.uid(),'admin'));
GRANT SELECT, INSERT ON public.match_complaints TO authenticated;
GRANT UPDATE ON public.match_complaints TO authenticated;

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
  other_claim public.result_claim;
  existing_claim public.result_claim;
BEGIN
  SELECT * INTO b FROM public.battles WHERE id=p_battle FOR UPDATE;
  IF b.id IS NULL THEN RAISE EXCEPTION 'Battle not found'; END IF;
  IF uid NOT IN (b.creator_id, COALESCE(b.opponent_id,b.creator_id)) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF b.status NOT IN ('running','result_pending') THEN RAISE EXCEPTION 'Result cannot be submitted now'; END IF;

  SELECT claim INTO existing_claim FROM public.battle_results WHERE battle_id=p_battle AND user_id=uid;
  IF existing_claim IS NOT NULL THEN RAISE EXCEPTION 'You have already submitted your result'; END IF;

  IF b.result_deadline_at IS NOT NULL AND b.result_deadline_at <= now() THEN
    RAISE EXCEPTION 'The match result window has expired';
  END IF;

  INSERT INTO public.battle_results (battle_id,user_id,claim,screenshot_url)
  VALUES (p_battle,uid,p_claim,p_screenshot);

  other := CASE WHEN uid=b.creator_id THEN b.opponent_id ELSE b.creator_id END;
  SELECT claim INTO other_claim FROM public.battle_results WHERE battle_id=p_battle AND user_id=other;

  IF other_claim IS NULL THEN
    UPDATE public.battles
    SET status='result_pending',
        opponent_result_deadline_at=now()+interval '15 minutes',
        objection_deadline_at=now()+interval '15 minutes'
    WHERE id=p_battle;
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

  UPDATE public.battles SET status='disputed', objection_deadline_at=NULL WHERE id=p_battle;
  RETURN 'disputed';
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_battle_result(p_battle uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  b public.battles%ROWTYPE;
  first_user uuid;
  first_claim public.result_claim;
  other uuid;
BEGIN
  SELECT * INTO b FROM public.battles WHERE id=p_battle FOR UPDATE;
  IF b.id IS NULL THEN RAISE EXCEPTION 'Battle not found'; END IF;
  IF uid NOT IN (b.creator_id, b.opponent_id) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF b.status <> 'result_pending' THEN RAISE EXCEPTION 'No result awaiting acceptance'; END IF;
  IF b.opponent_result_deadline_at IS NOT NULL AND b.opponent_result_deadline_at <= now() THEN
    RAISE EXCEPTION 'Acceptance window has expired';
  END IF;

  SELECT user_id, claim INTO first_user, first_claim
  FROM public.battle_results
  WHERE battle_id=p_battle
  ORDER BY created_at ASC LIMIT 1;

  IF first_user IS NULL OR first_user = uid THEN RAISE EXCEPTION 'Only the opponent can accept this result'; END IF;
  IF first_claim='won' THEN
    PERFORM public.settle_battle_win(p_battle,first_user);
  ELSIF first_claim='lost' THEN
    PERFORM public.settle_battle_win(p_battle,uid);
  ELSE
    PERFORM public.refund_battle(p_battle);
  END IF;
  RETURN 'completed';
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_battle_objection(
  p_battle uuid,
  p_concern text,
  p_proof text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  b public.battles%ROWTYPE;
  first_user uuid;
BEGIN
  IF length(trim(coalesce(p_concern,''))) < 3 THEN RAISE EXCEPTION 'Please describe your concern'; END IF;
  SELECT * INTO b FROM public.battles WHERE id=p_battle FOR UPDATE;
  IF b.id IS NULL THEN RAISE EXCEPTION 'Battle not found'; END IF;
  IF uid NOT IN (b.creator_id,b.opponent_id) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF b.status <> 'result_pending' THEN RAISE EXCEPTION 'This match is not awaiting an objection'; END IF;
  IF b.objection_deadline_at IS NULL OR b.objection_deadline_at <= now() THEN RAISE EXCEPTION 'The 5-minute objection window has expired'; END IF;

  SELECT user_id INTO first_user FROM public.battle_results WHERE battle_id=p_battle ORDER BY created_at ASC LIMIT 1;
  IF first_user = uid THEN RAISE EXCEPTION 'Only the opponent can object to the submitted result'; END IF;

  INSERT INTO public.match_complaints(battle_id,user_id,concern,proof_url,status)
  VALUES(p_battle,uid,trim(p_concern),p_proof,'open');

  UPDATE public.battles SET status='disputed', objection_deadline_at=NULL WHERE id=p_battle;
  RETURN 'disputed';
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_expired_battles()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  b public.battles%ROWTYPE;
  winner uuid;
  first_user uuid;
  first_claim public.result_claim;
  n integer := 0;
BEGIN
  FOR b IN
    SELECT * FROM public.battles
    WHERE status IN ('running','result_pending')
      AND (
        (status='running' AND result_deadline_at IS NOT NULL AND result_deadline_at <= now())
        OR
        (status='result_pending' AND opponent_result_deadline_at IS NOT NULL AND opponent_result_deadline_at <= now())
      )
    FOR UPDATE SKIP LOCKED
  LOOP
    IF b.status='result_pending' THEN
      SELECT user_id,claim INTO first_user,first_claim
      FROM public.battle_results WHERE battle_id=b.id ORDER BY created_at ASC LIMIT 1;
      IF first_user IS NOT NULL AND first_claim='won' THEN
        PERFORM public.settle_battle_win(b.id,first_user);
      ELSIF first_user IS NOT NULL AND first_claim='lost' THEN
        PERFORM public.settle_battle_win(b.id,COALESCE(b.opponent_id,b.creator_id));
      ELSE
        PERFORM public.refund_battle(b.id);
      END IF;
    ELSE
      PERFORM public.refund_battle(b.id);
    END IF;
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_battle_result(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_battle_objection(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_expired_battles() TO authenticated;
