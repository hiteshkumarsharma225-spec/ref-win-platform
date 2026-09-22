import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BookOpen, HelpCircle, LogOut, ShieldCheck, User, LockKeyhole, Fingerprint, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
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
    toast.success("MPIN saved for device quick unlock.");
  }

  function clearMpin() {
    localStorage.removeItem("refwin_mpin_hash");
    setMpinSet(false);
    toast.success("MPIN removed from this device.");
  }

  async function registerPasskey() {
    try {
      const { error } = await supabase.auth.registerPasskey();
      if (error) throw error;
      toast.success("Biometric / device passkey added successfully.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add passkey.");
    }
  }

  async function listPasskeys() {
    try {
      const { data, error } = await supabase.auth.passkey.list();
      if (error) throw error;
      if (!data?.length) {
        toast.info("No biometric passkey is registered on this account.");
        return;
      }
      toast.success(`${data.length} passkey(s) registered on this account.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read passkeys.");
    }
  }

  async function removeAllPasskeys() {
    try {
      const { data, error } = await supabase.auth.passkey.list();
      if (error) throw error;
      if (!data?.length) { toast.info("No passkey to remove."); return; }
      for (const passkey of data) {
        const { error: deleteError } = await supabase.auth.passkey.delete({ passkeyId: passkey.id });
        if (deleteError) throw deleteError;
      }
      toast.success("Biometric passkey removed from this account.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove passkey.");
    }
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
          <div className="flex items-center gap-2"><LockKeyhole className="h-5 w-5 text-primary"/><p className="font-semibold">4-digit MPIN quick unlock</p></div>
          <p className="mt-1 text-xs text-muted-foreground">Optional device-local convenience. It does not replace your secure account authentication.</p>
          <div className="mt-3 flex gap-2">
            <input inputMode="numeric" maxLength={4} type="password" value={mpin} onChange={e=>setMpin(e.target.value.replace(/\D/g,"").slice(0,4))} placeholder={mpinSet?"Enter new MPIN":"Set 4-digit MPIN"} className="h-10 flex-1 rounded-lg border border-border bg-background px-3 text-sm"/>
            <Button onClick={()=>void saveMpin()}>{mpinSet?"Change":"Set"}</Button>
            {mpinSet?<Button variant="outline" onClick={clearMpin}>Remove</Button>:null}
          </div>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4">
          <div className="flex items-center gap-2"><Fingerprint className="h-5 w-5 text-primary"/><p className="font-semibold">Biometric / Passkey login</p></div>
          <p className="mt-1 text-xs text-muted-foreground">Secure account login using your phone's fingerprint, face unlock, or device PIN. The biometric secret stays on your device.</p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Button variant="outline" onClick={()=>void registerPasskey()}>Add</Button>
            <Button variant="outline" onClick={()=>void listPasskeys()}>Check</Button>
            <Button variant="outline" onClick={()=>void removeAllPasskeys()}><Trash2 className="mr-1 h-4 w-4"/>Remove</Button>
          </div>
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
