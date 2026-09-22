import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BookOpen, HelpCircle, LogOut, ShieldCheck, User, LockKeyhole, Fingerprint } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin, useProfile, useUser } from "@/lib/account";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useUser();
  const { data: profile, isLoading } = useProfile(user?.id);
  const { data: isAdmin } = useIsAdmin(user?.id);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [mpin, setMpin] = useState("");
  const [mpinSet, setMpinSet] = useState(() => !!localStorage.getItem("refwin_mpin_hash"));

  const won = profile?.battles_won ?? 0;
  const lost = profile?.battles_lost ?? 0;
  const total = won + lost;
  const winRate = total ? Math.round((won / total) * 100) : 0;

  async function hashMpin(value: string) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return Array.from(new Uint8Array(digest)).map(x => x.toString(16).padStart(2, "0")).join("");
  }

  async function saveMpin() {
    if (!/^\\d{4}$/.test(mpin)) { toast.error("MPIN must be exactly 4 digits."); return; }
    localStorage.setItem("refwin_mpin_hash", await hashMpin(mpin));
    setMpin("");
    setMpinSet(true);
    toast.success("MPIN saved on this device.");
  }

  async function clearMpin() {
    localStorage.removeItem("refwin_mpin_hash");
    setMpinSet(false);
    toast.success("MPIN removed from this device.");
  }

  async function setupBiometric() {
    if (!window.PublicKeyCredential || !navigator.credentials) { toast.error("Biometric/passkey is not supported."); return; }
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.();
    if (!available) { toast.error("No biometric authenticator is available on this device."); return; }
    toast.success("Device biometric is available. Passkey enrollment requires server-side WebAuthn verification before it can be enabled as an account login.");
  }

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <AppShell>
      <div className="glow-gold rounded-2xl bg-card p-5">
        <div className="flex items-center gap-4">
          <div className="gold-gradient grid h-16 w-16 place-items-center rounded-full text-primary-foreground">
            <User className="h-8 w-8" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate font-display text-lg font-bold">
              {isLoading ? "Loading…" : (profile?.username ?? "Player")}
            </h1>
            <p className="truncate text-sm text-muted-foreground">{profile?.phone ?? "—"}</p>
            <Badge variant="secondary" className="mt-1 capitalize">
              KYC: {(profile?.kyc_status ?? "not_submitted").replace("_", " ")}
            </Badge>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Stat label="Won" value={won} />
        <Stat label="Lost" value={lost} />
        <Stat label="Win rate" value={`${winRate}%`} />
      </div>

      <div className="mt-5 grid gap-2">
        <Row to="/kyc" icon={<ShieldCheck className="h-5 w-5 text-primary" />} label="KYC verification" />
        <div className="rounded-xl border border-border/60 bg-card p-4">
          <div className="flex items-center gap-2"><LockKeyhole className="h-5 w-5 text-primary"/><p className="font-semibold">MPIN quick unlock</p></div>
          <p className="mt-1 text-xs text-muted-foreground">A 4-digit device quick-unlock. Your normal account password remains the primary authentication.</p>
          <div className="mt-3 flex gap-2">
            <input inputMode="numeric" maxLength={4} type="password" value={mpin} onChange={e=>setMpin(e.target.value.replace(/\D/g,"").slice(0,4))} placeholder={mpinSet?"Enter new 4-digit MPIN":"Set 4-digit MPIN"} className="h-10 flex-1 rounded-lg border border-border bg-background px-3 text-sm"/>
            <Button onClick={()=>void saveMpin()}>{mpinSet?"Change":"Set"}</Button>
            {mpinSet?<Button variant="outline" onClick={clearMpin}>Remove</Button>:null}
          </div>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4">
          <div className="flex items-center gap-2"><Fingerprint className="h-5 w-5 text-primary"/><p className="font-semibold">Biometric / Passkey</p></div>
          <p className="mt-1 text-xs text-muted-foreground">Check device support. Full account passkey login requires WebAuthn server verification.</p>
          <Button className="mt-3 w-full" variant="outline" onClick={()=>void setupBiometric()}>Add / Check biometric</Button>
        </div>
        <Row to="/rules" icon={<BookOpen className="h-5 w-5 text-primary" />} label="Rules & fair play" />
        <Row to="/support" icon={<HelpCircle className="h-5 w-5 text-primary" />} label="Help & support" />
        <Row to="/admin" icon={<ShieldCheck className="h-5 w-5 text-primary" />} label={isAdmin ? "Admin Panel" : "Admin Panel (admin only)"} />
      </div>

      <button
        onClick={signOut}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm font-semibold text-destructive"
      >
        <LogOut className="h-4 w-4" /> Sign out
      </button>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-3">
      <p className="font-display text-lg font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function Row({
  to,
  icon,
  label,
}: {
  to: "/kyc" | "/rules" | "/support" | "/admin";
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-4 text-sm">
      {icon}
      {label}
    </Link>
  );
}
