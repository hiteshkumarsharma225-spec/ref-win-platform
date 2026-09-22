CREATE TABLE IF NOT EXISTS public.virtual_credit_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processed','successful')),
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  completed_at timestamptz,
  approved_by uuid REFERENCES auth.users(id),
  completed_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS virtual_credit_withdrawals_user_idx
ON public.virtual_credit_withdrawals(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS virtual_credit_withdrawals_status_idx
ON public.virtual_credit_withdrawals(status, created_at DESC);

ALTER TABLE public.virtual_credit_withdrawals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own virtual credit withdrawals" ON public.virtual_credit_withdrawals;
CREATE POLICY "Users can view own virtual credit withdrawals"
ON public.virtual_credit_withdrawals FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view virtual credit withdrawals" ON public.virtual_credit_withdrawals;
CREATE POLICY "Admins can view virtual credit withdrawals"
ON public.virtual_credit_withdrawals FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.request_virtual_credit_withdrawal(p_amount numeric)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_balance numeric;
  v_kyc kyc_status;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT kyc_status INTO v_kyc FROM profiles WHERE id = auth.uid();
  IF v_kyc IS DISTINCT FROM 'approved' THEN RAISE EXCEPTION 'KYC approval is required'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Enter a valid credit amount'; END IF;

  SELECT bonus_cash INTO v_balance FROM wallets WHERE user_id = auth.uid() FOR UPDATE;
  IF COALESCE(v_balance,0) < p_amount THEN RAISE EXCEPTION 'Insufficient virtual credits'; END IF;

  IF EXISTS (
    SELECT 1 FROM virtual_credit_withdrawals
    WHERE user_id = auth.uid() AND status IN ('pending','processed')
  ) THEN
    RAISE EXCEPTION 'You already have a withdrawal request in progress';
  END IF;

  UPDATE wallets
  SET bonus_cash = bonus_cash - p_amount, updated_at = now()
  WHERE user_id = auth.uid();

  INSERT INTO virtual_credit_withdrawals(user_id, amount)
  VALUES(auth.uid(), p_amount)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_virtual_credit_withdrawal(p_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_amount numeric;
BEGIN
  SELECT amount INTO v_amount
  FROM virtual_credit_withdrawals
  WHERE id = p_id AND user_id = auth.uid() AND status = 'pending'
  FOR UPDATE;

  IF v_amount IS NULL THEN RAISE EXCEPTION 'Withdrawal cannot be cancelled'; END IF;

  UPDATE virtual_credit_withdrawals SET status = 'successful' WHERE id = p_id AND status = 'pending';
  UPDATE wallets SET bonus_cash = bonus_cash + v_amount, updated_at = now() WHERE user_id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_approve_virtual_credit_withdrawal(p_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admin only'; END IF;
  UPDATE virtual_credit_withdrawals
  SET status='processed', approved_at=now(), approved_by=auth.uid()
  WHERE id=p_id AND status='pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Withdrawal is not pending'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_complete_virtual_credit_withdrawal(p_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admin only'; END IF;
  UPDATE virtual_credit_withdrawals
  SET status='successful', completed_at=now(), completed_by=auth.uid()
  WHERE id=p_id AND status='processed';
  IF NOT FOUND THEN RAISE EXCEPTION 'Withdrawal is not processed'; END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_virtual_credit_withdrawal(numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_virtual_credit_withdrawal(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_approve_virtual_credit_withdrawal(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_complete_virtual_credit_withdrawal(uuid) TO authenticated;
