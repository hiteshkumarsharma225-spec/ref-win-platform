import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Mail, LockKeyhole, Fingerprint } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

const searchSchema = z.object({ refer: z.string().optional() });

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Login — REAL LUDO PLAYER" },
      { name: "description", content: "Sign in with Google or email and password." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [referral, setReferral] = useState(search.refer ?? "");
  const [busy, setBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [quickUnlock, setQuickUnlock] = useState<"mpin" | "biometric" | null>(null);
  const [mpin, setMpin] = useState("");

  useEffect(() => {
    const saved = search.refer ?? localStorage.getItem("fb_refer") ?? "";
    if (saved) { setReferral(saved); localStorage.setItem("fb_refer", saved); }
    if (search.refer) setMode("signup");
  }, [search.refer]);

  const continueGoogle = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
        queryParams: { access_type: "offline", prompt: "select_account" },
      },
    });
    if (error) { toast.error(error.message); setBusy(false); }
  };

  const submitEmail = async () => {
    if (!email.trim() || !password) { toast.error("Enter email and password."); return; }
    if (password.length < 6) { toast.error("Password must be at least 6 characters."); return; }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              username: username.trim() || undefined,
              referral_code: referral || null,
            },
          },
        });
        if (error) throw error;
        localStorage.removeItem("fb_refer");
        toast.success("Account created. Check your email if confirmation is enabled.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        toast.success("Welcome back!");
        navigate({ to: "/" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed.");
    } finally { setBusy(false); }
  };

  const unlockWithMpin = async () => {
    if (!/^\\d{4}$/.test(mpin)) { toast.error("Enter your 4-digit MPIN."); return; }
    const saved = localStorage.getItem("refwin_mpin_hash");
    if (!saved) { toast.error("No MPIN is set on this device. Login with email/password first."); return; }
    const bytes = new TextEncoder().encode(mpin);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const hash = Array.from(new Uint8Array(digest)).map(x => x.toString(16).padStart(2, "0")).join("");
    if (hash !== saved) { toast.error("Incorrect MPIN."); return; }
    toast.success("MPIN verified");
    navigate({ to: "/" });
  };

  const unlockWithBiometric = async () => {
    if (!window.PublicKeyCredential || !navigator.credentials) {
      toast.error("Biometric/passkey is not supported on this device/browser.");
      return;
    }
    try {
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.();
      if (!available) throw new Error("No device biometric authenticator is available.");
      toast.info("Biometric/passkey setup is available from Profile after normal login.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Biometric verification unavailable.");
    }
  };

  const forgotPassword = async () => {
    if (!email.trim()) { toast.error("Enter your email first."); return; }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin + "/auth",
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else { setResetSent(true); toast.success("Password reset email sent."); }
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 py-8">
      <button className="mb-6 flex w-fit items-center gap-1 text-sm text-muted-foreground" onClick={() => navigate({ to: "/" })}>
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <div className="gold-gradient mb-5 flex h-14 w-14 items-center justify-center rounded-2xl text-2xl font-bold text-primary-foreground">F</div>
      <h1 className="font-display text-2xl font-bold">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
      <p className="mt-1 text-sm text-muted-foreground">Use Google or your email and password. Mobile OTP has been removed.</p>

      <Button className="mt-6 w-full" size="lg" variant="outline" onClick={continueGoogle} disabled={busy}>
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <span className="mr-2 font-bold">G</span>}
        Continue with Google
      </Button>

            <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={() => setQuickUnlock(quickUnlock === "mpin" ? null : "mpin")}>
          <LockKeyhole className="h-4 w-4" /> MPIN
        </Button>
        <Button variant="outline" onClick={() => void unlockWithBiometric()}>
          <Fingerprint className="h-4 w-4" /> Biometric
        </Button>
      </div>
      {quickUnlock === "mpin" ? (
        <div className="mt-2 flex gap-2">
          <Input inputMode="numeric" maxLength={4} type="password" value={mpin} onChange={e => setMpin(e.target.value.replace(/\\D/g, "").slice(0,4))} placeholder="4-digit MPIN" />
          <Button onClick={() => void unlockWithMpin()}>Unlock</Button>
        </div>
      ) : null}

<div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border"/>OR<span className="h-px flex-1 bg-border"/></div>

      <div className="space-y-4">
        {mode === "signup" ? <div className="space-y-2"><Label>Username</Label><Input value={username} maxLength={20} onChange={e=>setUsername(e.target.value)} placeholder="Choose a display name"/></div> : null}
        <div className="space-y-2"><Label>Email</Label><div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground"/><Input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></div></div>
        <div className="space-y-2"><Label>Password</Label><div className="flex items-center gap-2"><LockKeyhole className="h-4 w-4 text-muted-foreground"/><Input type="password" autoComplete={mode==="login"?"current-password":"new-password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••"/></div></div>
        {mode === "signup" ? <div className="space-y-2"><Label>Referral code (optional)</Label><Input value={referral} onChange={e=>setReferral(e.target.value)} placeholder="Referral code"/></div> : null}
        <Button className="w-full" size="lg" onClick={submitEmail} disabled={busy}>{busy?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:null}{mode==="login"?"Login":"Create account"}</Button>
        {mode === "login" ? <button className="w-full text-sm text-muted-foreground underline" onClick={forgotPassword} disabled={busy}>Forgot password?</button> : null}
        {resetSent ? <p className="text-center text-xs text-muted-foreground">Check your inbox for the password reset link.</p> : null}
        <button className="w-full text-center text-sm text-muted-foreground" onClick={()=>setMode(mode==="login"?"signup":"login")}>{mode==="login"?"New here? Create an account":"Already registered? Login"}</button>
      </div>

      <p className="mt-auto pt-10 text-center text-[11px] text-muted-foreground">By continuing you agree to the app rules and fair-play terms.</p>
    </div>
  );
}
