import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Smartphone } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { phoneToEmail } from "@/lib/account";

const searchSchema = z.object({
  refer: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Login — FunBattle" },
      { name: "description", content: "Log in or register with your mobile number to start playing FunBattle." },
      { property: "og:title", content: "Login — FunBattle" },
      { property: "og:description", content: "Log in or register with your mobile number." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [phone, setPhone] = useState("");
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [referral, setReferral] = useState(search.refer ?? "");
  const [busy, setBusy] = useState(false);

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

  const sendOtp = () => {
    if (!/^[6-9]\d{9}$/.test(phone)) {
      toast.error("Enter a valid 10-digit mobile number");
      return;
    }
    setStep("otp");
    toast.success("OTP sent to +91 " + phone, {
      description: "Demo mode: your 6-digit PIN is your OTP.",
    });
  };

  const submit = async () => {
    if (pin.length !== 6) {
      toast.error("Enter your 6-digit code");
      return;
    }
    setBusy(true);
    const email = phoneToEmail(phone);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
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
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pin });
        if (error) throw error;
      }
      localStorage.removeItem("fb_refer");
      toast.success(mode === "signup" ? "Account created!" : "Welcome back!");
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 py-8">
      <button
        className="mb-6 flex w-fit items-center gap-1 text-sm text-muted-foreground"
        onClick={() => (step === "otp" ? setStep("phone") : navigate({ to: "/" }))}
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="gold-gradient mb-5 flex h-14 w-14 items-center justify-center rounded-2xl text-2xl font-bold text-primary-foreground">
        F
      </div>
      <h1 className="font-display text-2xl font-bold">
        {step === "phone" ? "Enter your mobile number" : "Verify OTP"}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {step === "phone"
          ? "We'll send a one-time code to continue."
          : `Code sent to +91 ${phone}. In this demo the code is the 6-digit PIN you choose.`}
      </p>

      <div className="mt-8 space-y-4">
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
            <Button className="w-full" size="lg" onClick={sendOtp}>
              Send OTP
            </Button>
          </>
        ) : (
          <>
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
            <div className="space-y-2">
              <Label htmlFor="pin">6-digit code</Label>
              <Input
                id="pin"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                placeholder="••••••"
                className="text-center text-lg tracking-[0.5em]"
              />
              <p className="text-xs text-muted-foreground">
                {mode === "signup"
                  ? "This code becomes your login code — remember it."
                  : "Enter the code you set when you registered."}
              </p>
            </div>
            <Button className="w-full" size="lg" onClick={submit} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {mode === "signup" ? "Create account" : "Login"}
            </Button>
            <button
              className="w-full text-center text-sm text-muted-foreground"
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
            >
              {mode === "login" ? "New here? Create an account" : "Already registered? Login"}
            </button>
          </>
        )}
      </div>

      <p className="mt-auto pt-10 text-center text-[11px] text-muted-foreground">
        By continuing you agree to our fair play rules. 18+ only. Play responsibly.
      </p>
    </div>
  );
}
