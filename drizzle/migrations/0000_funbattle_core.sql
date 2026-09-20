-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin','moderator','user');
CREATE TYPE public.battle_status AS ENUM ('open','running','result_pending','disputed','completed','cancelled');
CREATE TYPE public.result_claim AS ENUM ('won','lost','cancel');
CREATE TYPE public.txn_type AS ENUM ('deposit','withdrawal','bet','winning','referral','bonus','refund','penalty');
CREATE TYPE public.txn_status AS ENUM ('pending','approved','completed','rejected');
CREATE TYPE public.kyc_status AS ENUM ('not_submitted','pending','approved','rejected');

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone text NOT NULL,
  username text NOT NULL,
  avatar_url text,
  referral_code text NOT NULL UNIQUE,
  referred_by uuid,
  kyc_status public.kyc_status NOT NULL DEFAULT 'not_submitted',
  battles_won integer NOT NULL DEFAULT 0,
  battles_lost integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ROLES
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "profiles readable" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- WALLETS
CREATE TABLE public.wallets (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  deposit_cash numeric(12,2) NOT NULL DEFAULT 0,
  winning_cash numeric(12,2) NOT NULL DEFAULT 0,
  bonus_cash numeric(12,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own wallet" ON public.wallets FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- BATTLES
CREATE TABLE public.battles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game text NOT NULL,
  amount numeric(12,2) NOT NULL,
  prize numeric(12,2) NOT NULL,
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opponent_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status public.battle_status NOT NULL DEFAULT 'open',
  room_code text,
  winner_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  settled_at timestamptz
);
GRANT SELECT ON public.battles TO authenticated;
GRANT ALL ON public.battles TO service_role;
ALTER TABLE public.battles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "battles readable" ON public.battles FOR SELECT TO authenticated USING (true);

-- BATTLE RESULTS
CREATE TABLE public.battle_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  battle_id uuid NOT NULL REFERENCES public.battles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  claim public.result_claim NOT NULL,
  screenshot_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (battle_id, user_id)
);
GRANT SELECT ON public.battle_results TO authenticated;
GRANT ALL ON public.battle_results TO service_role;
ALTER TABLE public.battle_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "results readable" ON public.battle_results FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin')
  OR EXISTS (SELECT 1 FROM public.battles b WHERE b.id = battle_id AND (b.creator_id = auth.uid() OR b.opponent_id = auth.uid())));

-- TRANSACTIONS
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.txn_type NOT NULL,
  amount numeric(12,2) NOT NULL,
  status public.txn_status NOT NULL DEFAULT 'completed',
  note text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own transactions" ON public.transactions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- WITHDRAWALS
CREATE TABLE public.withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  method text NOT NULL,
  upi_id text,
  account_name text,
  account_number text,
  ifsc text,
  status public.txn_status NOT NULL DEFAULT 'pending',
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
GRANT SELECT ON public.withdrawals TO authenticated;
GRANT ALL ON public.withdrawals TO service_role;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own withdrawals" ON public.withdrawals FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- DEPOSIT REQUESTS
CREATE TABLE public.deposit_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  utr text,
  status public.txn_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
GRANT SELECT ON public.deposit_requests TO authenticated;
GRANT ALL ON public.deposit_requests TO service_role;
ALTER TABLE public.deposit_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own deposits" ON public.deposit_requests FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- KYC
CREATE TABLE public.kyc_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  doc_type text NOT NULL,
  doc_number text NOT NULL,
  doc_url text,
  status public.kyc_status NOT NULL DEFAULT 'pending',
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.kyc_submissions TO authenticated;
GRANT ALL ON public.kyc_submissions TO service_role;
ALTER TABLE public.kyc_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own kyc" ON public.kyc_submissions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "insert own kyc" ON public.kyc_submissions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- REFERRAL EARNINGS
CREATE TABLE public.referral_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  battle_id uuid REFERENCES public.battles(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.referral_earnings TO authenticated;
GRANT ALL ON public.referral_earnings TO service_role;
ALTER TABLE public.referral_earnings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own referral earnings" ON public.referral_earnings FOR SELECT TO authenticated USING (referrer_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- SIGNUP TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_code text;
  v_ref_code text;
  v_referrer uuid;
BEGIN
  LOOP
    v_code := lpad((floor(random()*1000000))::int::text, 6, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = v_code);
  END LOOP;

  v_ref_code := NULLIF(NEW.raw_user_meta_data->>'referral_code','');
  IF v_ref_code IS NOT NULL THEN
    SELECT id INTO v_referrer FROM public.profiles WHERE referral_code = v_ref_code;
  END IF;

  INSERT INTO public.profiles (id, phone, username, referral_code, referred_by)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'username',''), 'Player' || substr(NEW.id::text,1,4)),
    v_code,
    v_referrer
  );

  INSERT INTO public.wallets (user_id, bonus_cash) VALUES (NEW.id, 25);
  INSERT INTO public.transactions (user_id, type, amount, note) VALUES (NEW.id, 'bonus', 25, 'Welcome bonus');
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- WALLET HELPERS
CREATE OR REPLACE FUNCTION public.wallet_debit(_user uuid, _amount numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w public.wallets%ROWTYPE; rem numeric := _amount; take numeric;
BEGIN
  SELECT * INTO w FROM public.wallets WHERE user_id = _user FOR UPDATE;
  IF w.deposit_cash + w.winning_cash + w.bonus_cash < _amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;
  take := LEAST(rem, w.winning_cash); w.winning_cash := w.winning_cash - take; rem := rem - take;
  take := LEAST(rem, w.deposit_cash); w.deposit_cash := w.deposit_cash - take; rem := rem - take;
  take := LEAST(rem, w.bonus_cash); w.bonus_cash := w.bonus_cash - take; rem := rem - take;
  UPDATE public.wallets SET deposit_cash = w.deposit_cash, winning_cash = w.winning_cash, bonus_cash = w.bonus_cash, updated_at = now() WHERE user_id = _user;
END;
$$;

CREATE OR REPLACE FUNCTION public.wallet_credit(_user uuid, _amount numeric, _bucket text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _bucket = 'deposit' THEN
    UPDATE public.wallets SET deposit_cash = deposit_cash + _amount, updated_at = now() WHERE user_id = _user;
  ELSIF _bucket = 'bonus' THEN
    UPDATE public.wallets SET bonus_cash = bonus_cash + _amount, updated_at = now() WHERE user_id = _user;
  ELSE
    UPDATE public.wallets SET winning_cash = winning_cash + _amount, updated_at = now() WHERE user_id = _user;
  END IF;
END;
$$;
