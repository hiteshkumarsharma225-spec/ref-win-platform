import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Smartphone, MessageSquare, KeyRound } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { phoneToEmail } from "@/lib/account";
import { sendPhoneOtp, verifyPhoneOtp } from "@/lib/otp.functions";

const searchSchema = z.object({
  refer: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Login — REAL LUDO PLAYER" },
      { name: "description", content: "Log in or register with your mobile number using a real SMS one-time code." },
      { property: "og:title", content: "Login — REAL LUDO PLAYER" },
      { property: "og:description", content: "Log in or register with your mobile number using a real SMS one-time code." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const sendOtpFn = useServerFn(sendPhoneOtp);
  const verifyOtpFn = useServerFn(verifyPhoneOtp);

  const [method, setMethod] = useState<"otp" | "pin">("otp");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [phone, setPhone] = useState("");
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [referral, setReferral] = useState(search.refer ?? "");
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (search.refer) {
      setReferral(search.refer);
      setMode("signup");
      localStorage.setItem("fb_refer", search.refer);
    } else {
      const saved = localStorage.getItem("fb_refer");
      if (saved) setReferral(saved);
    }
  }, [search.refer]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const validPhone = /^[6-9]\d{9}$/.test(phone);

  const requestCode = async (resend = false) => {
    setError(null);
    if (!validPhone) {
      setError("Enter a valid 10-digit mobile number.");
      return;
    }
    resend ? setResending(true) : setBusy(true);
    try {
      await sendOtpFn({ data: { phone } });
      setStep("code");
      setCooldown(30);
      toast.success(`Code sent to +91 ${phone}`, { description: "It can take a few seconds to arrive." });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not send the code. Please try again.";
      setError(msg);
      toast.error(msg);
    } finally {
      setResending(false);
      setBusy(false);
    }
  };

  const submitOtp = async () => {
    setError(null);
    if (code.length !== 6) {
      setError("Enter the 6-digit code from the SMS.");
      return;
    }
    setBusy(true);
    try {
      const result = await verifyOtpFn({
        data: { phone, code, username, referral },
      });
      const { error: sessionError } = await supabase.auth.verifyOtp({
        type: "email",
        token_hash: result.tokenHash,
      });
      if (sessionError) throw sessionError;
      localStorage.removeItem("fb_refer");
      toast.success(result.isNew ? "Account created!" : "Welcome back!");
      navigate({ to: "/" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not verify that code.";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const submitPin = async () => {
    setError(null);
    if (!validPhone) {
      setError("Enter a valid 10-digit mobile number.");
      return;
    }
    if (pin.length !== 6) {
      setError("Enter your 6-digit login PIN.");
      return;
    }
    setBusy(true);
    const email = phoneToEmail(phone);
    try {
      if (mode === "signup") {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password: pin,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              phone,
              username: username || `Player${phone.slice(-4)}`,
              referral_code: referral || null,
            },
          },
        });
        if (signUpError) throw signUpError;
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: pin });
        if (signInError) throw signInError;
      }
      localStorage.removeItem("fb_refer");
      toast.success(mode === "signup" ? "Account created!" : "Welcome back!");
      navigate({ to: "/" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const switchMethod = (next: "otp" | "pin") => {
    setMethod(next);
    setStep("phone");
    setError(null);
    setCode("");
    setPin("");
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 py-8">
      <button
        className="mb-6 flex w-fit items-center gap-1 text-sm text-muted-foreground"
        onClick={() => (step === "code" ? (setStep("phone"), setError(null)) : navigate({ to: "/" }))}
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="gold-gradient mb-5 flex h-14 w-14 items-center justify-center rounded-2xl text-2xl font-bold text-primary-foreground">
        F
      </div>
      <h1 className="font-display text-2xl font-bold">
        {step === "code" ? "Enter the code" : "Enter your mobile number"}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {step === "code"
          ? `We sent a 6-digit code by SMS to +91 ${phone}.`
          : method === "otp"
            ? "We'll text you a 6-digit one-time code."
            : "Sign in with your 6-digit login PIN."}
      </p>

      <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl border border-border/60 bg-card p-1">
        <button
          onClick={() => switchMethod("otp")}
          className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${method === "otp" ? "gold-gradient text-primary-foreground" : "text-muted-foreground"}`}
        >
          <MessageSquare className="h-4 w-4" /> SMS code
        </button>
        <button
          onClick={() => switchMethod("pin")}
          className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${method === "pin" ? "gold-gradient text-primary-foreground" : "text-muted-foreground"}`}
        >
          <KeyRound className="h-4 w-4" /> PIN
        </button>
      </div>

      <div className="mt-6 space-y-4">
        {step === "phone" ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="phone">Mobile number</Label>
              <div className="flex items-center gap-2 rounded-lg border border-input bg-card px-3">
                <Smartphone className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">+91</span>
                <Input
                  id="phone"
                  inputMode="numeric"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                  placeholder="9876543210"
                  className="border-0 bg-transparent px-0 focus-visible:ring-0"
                />
              </div>
            </div>

            {mode === "signup" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={username}
                    maxLength={16}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Choose a display name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="referral">Referral code (optional)</Label>
                  <Input
                    id="referral"
                    value={referral}
                    onChange={(e) => setReferral(e.target.value)}
                    placeholder="e.g. 080545"
                  />
                </div>
              </>
            ) : null}

            {method === "pin" ? (
              <div className="space-y-2">
                <Label htmlFor="pin">6-digit login PIN</Label>
                <Input
                  id="pin"
                  inputMode="numeric"
                  maxLength={6}
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="••••••"
                  className="text-center text-lg tracking-[0.5em]"
                />
                <p className="text-xs text-muted-foreground">
                  {mode === "signup"
                    ? "This 6-digit code becomes your login PIN."
                    : "Forgot it? Switch to SMS code above."}
                </p>
              </div>
            ) : null}

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <Button
              className="w-full"
              size="lg"
              disabled={busy}
              onClick={() => (method === "otp" ? requestCode() : submitPin())}
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {method === "otp" ? "Send SMS code" : mode === "signup" ? "Create account" : "Login"}
            </Button>

            <button
              className="w-full text-center text-sm text-muted-foreground"
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setError(null);
              }}
            >
              {mode === "login" ? "New here? Create an account" : "Already registered? Login"}
            </button>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="code">6-digit SMS code</Label>
              <Input
                id="code"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="••••••"
                className="text-center text-lg tracking-[0.5em]"
              />
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <Button className="w-full" size="lg" onClick={submitOtp} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Verify & continue
            </Button>

            <button
              className="flex w-full items-center justify-center gap-2 text-center text-sm text-muted-foreground disabled:opacity-50"
              disabled={cooldown > 0 || resending}
              onClick={() => requestCode(true)}
            >
              {resending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
            </button>
          </>
        )}
      </div>

      <p className="mt-auto pt-10 text-center text-[11px] text-muted-foreground">
        Standard SMS rates may apply. By continuing you agree to our fair play rules.
      </p>
    </div>
  );
}
