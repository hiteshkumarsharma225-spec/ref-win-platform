import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Gift, Share2, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { REFERRAL_RATE, rupees } from "@/lib/game";
import { useProfile, useUser } from "@/lib/account";

export const Route = createFileRoute("/_authenticated/refer")({
  component: ReferPage,
});

function ReferPage() {
  const { user } = useUser();
  const { data: profile } = useProfile(user?.id);

  const link =
    typeof window !== "undefined" && profile
      ? `${window.location.origin}/?refer=${profile.referral_code}`
      : "";

  const earnings = useQuery({
    queryKey: ["referral-earnings", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("referral_earnings")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const invited = useQuery({
    queryKey: ["invited", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { count } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("referred_by", user!.id);
      return count ?? 0;
    },
  });

  const total = (earnings.data ?? []).reduce((s, e) => s + Number(e.amount), 0);

  const share = async () => {
    const text = `Play Ludo battles and win real cash on FunBattle! Use my code ${profile?.referral_code} 👉 ${link}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "FunBattle", text, url: link });
        return;
      } catch {
        /* user cancelled */
      }
    }
    await navigator.clipboard.writeText(text);
    toast.success("Invite message copied");
  };

  return (
    <AppShell>
      <div className="glow-gold rounded-2xl bg-card p-5 text-center">
        <Gift className="mx-auto mb-2 h-8 w-8 text-primary" />
        <h1 className="font-display text-xl font-bold">Refer & Earn</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Earn {Math.round(REFERRAL_RATE * 100)}% commission on every battle your friends play — for life.
        </p>

        <div className="mt-4 rounded-xl border border-primary/40 bg-primary/10 p-3">
          <p className="text-xs text-muted-foreground">Your referral code</p>
          <p className="font-display text-2xl font-bold tracking-widest text-primary">
            {profile?.referral_code ?? "······"}
          </p>
        </div>

        <div className="mt-3 flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              navigator.clipboard.writeText(link);
              toast.success("Referral link copied");
            }}
          >
            <Copy className="h-4 w-4" /> Copy link
          </Button>
          <Button className="flex-1" onClick={share}>
            <Share2 className="h-4 w-4" /> Share
          </Button>
        </div>
        <p className="mt-2 break-all text-[11px] text-muted-foreground">{link}</p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-border/60 bg-card p-4 text-center">
          <Users className="mx-auto mb-1 h-4 w-4 text-accent" />
          <p className="font-display text-lg font-bold">{invited.data ?? 0}</p>
          <p className="text-[11px] text-muted-foreground">Friends joined</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4 text-center">
          <Gift className="mx-auto mb-1 h-4 w-4 text-primary" />
          <p className="font-display text-lg font-bold text-primary">{rupees(total)}</p>
          <p className="text-[11px] text-muted-foreground">Total earned</p>
        </div>
      </div>

      <h2 className="mt-6 mb-2 font-display font-bold">Commission tiers</h2>
      <div className="space-y-2 text-sm">
        <Tier label="Starter · 0-10 referrals" value="2% per battle" />
        <Tier label="Pro · 11-50 referrals" value="2% + ₹10 signup bonus" />
        <Tier label="Legend · 50+ referrals" value="2% + ₹25 signup bonus + priority support" />
      </div>

      <h2 className="mt-6 mb-2 font-display font-bold">Earnings history</h2>
      <div className="space-y-2">
        {(earnings.data ?? []).length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
            No referral earnings yet. Share your link to start earning.
          </p>
        ) : null}
        {(earnings.data ?? []).map((e) => (
          <div
            key={e.id}
            className="flex items-center justify-between rounded-xl border border-border/60 bg-card p-3 text-sm"
          >
            <span className="text-muted-foreground">
              {new Date(e.created_at).toLocaleDateString("en-IN")} · battle commission
            </span>
            <span className="font-display font-bold text-accent">+{rupees(e.amount)}</span>
          </div>
        ))}
      </div>
    </AppShell>
  );
}

function Tier({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border/60 bg-card p-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-primary">{value}</span>
    </div>
  );
}
