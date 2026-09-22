-- Resolve expired virtual-credit battles.
-- This function is safe-mode only: rewards/refunds use bonus_cash.

CREATE OR REPLACE FUNCTION public.resolve_expired_battles()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b public.battles%ROWTYPE;
  winner uuid;
  n integer := 0;
BEGIN
  FOR b IN
    SELECT *
    FROM public.battles
    WHERE status IN ('running','result_pending')
      AND result_deadline_at IS NOT NULL
      AND result_deadline_at <= now()
    FOR UPDATE SKIP LOCKED
  LOOP
    winner := NULL;

    SELECT br.user_id
      INTO winner
    FROM public.battle_results br
    WHERE br.battle_id = b.id
      AND br.claim = 'won'
    ORDER BY br.created_at ASC
    LIMIT 1;

    IF winner IS NOT NULL THEN
      PERFORM public.settle_battle_win(b.id, winner);
    ELSE
      PERFORM public.refund_battle(b.id);
    END IF;

    n := n + 1;
  END LOOP;

  RETURN n;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_expired_battles() TO authenticated;

COMMENT ON FUNCTION public.resolve_expired_battles IS
'Resolves expired virtual-credit battles only. Winner receives virtual credits; otherwise locked credits are refunded.';
