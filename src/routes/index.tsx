import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Dices, Flame, ShieldCheck, Trophy, Zap } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { GAMES, rupees } from "@/lib/game";
import { useProfile, useUser, useWallet } from "@/lib/account";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "REAL LUDO PLAYER — Ludo Battle Lobby" },
      {
        name: "description",
        content:
          "Pick a game, set your entry amount and battle real players for cash prizes on REAL LUDO PLAYER.",
      },
      { property: "og:title", content: "REAL LUDO PLAYER — Ludo Battle Lobby" },
      {
        property: "og:description",
        content: "Pick a game, set your entry amount and battle real players for cash prizes.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const { user, loading } = useUser();
  const { data: profile } = useProfile(user?.id);
  const { data: wallet } = useWallet(user?.id);
  const navigate = useNavigate();

  const { data: stats } = useQuery({
    queryKey: ["home-stats"],
    queryFn: async () => {
      const [open, running] = await Promise.all([
        supabase.from("battles").select("id", { count: "exact", head: true }).eq("status", "open"),
        supabase
          .from("battles")
          .select("id", { count: "exact", head: true })
          .in("status", ["running", "result_pending"]),
      ]);
      return { open: open.count ?? 0, running: running.count ?? 0 };
    },
    enabled: !!user,
  });

  return (
    <AppShell>
      {!user && !loading ? (
        <div className="glow-gold mb-5 rounded-2xl bg-card p-5">
          <h1 className="font-display text-2xl font-bold leading-tight">
            Play Ludo. <span className="gold-text">Win real cash.</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Create a battle, share your room code and get paid the moment you win.
          </p>
          <Button className="mt-4 w-full" size="lg" onClick={() => navigate({ to: "/auth" })}>
            Login / Register
          </Button>
        </div>
      ) : null}

      {user ? (
        <div className="mb-5 grid grid-cols-3 gap-2">
          <StatCard label="Balance" value={rupees(
            Number(wallet?.deposit_cash ?? 0) +
              Number(wallet?.winning_cash ?? 0) +
              Number(wallet?.bonus_cash ?? 0),
          )} />
          <Link to="/battles" search={{ view: "open" }} className="block rounded-xl border border-border/60 bg-card p-3 text-center transition-colors active:bg-secondary">
            <p className="font-display text-base font-bold text-primary">{String(stats?.open ?? 0)}</p>
            <p className="text-[11px] text-muted-foreground">Open</p>
          </Link>
          <Link to="/battles" search={{ view: "live" }} className="block rounded-xl border border-border/60 bg-card p-3 text-center transition-colors active:bg-secondary">
            <p className="font-display text-base font-bold text-primary">{String(stats?.running ?? 0)}</p>
            <p className="text-[11px] text-muted-foreground">Live</p>
          </Link>
        </div>
      ) : null}

      {profile ? (
        <p className="mb-4 text-sm text-muted-foreground">
          Welcome back, <span className="font-semibold text-foreground">{profile.username}</span> 👋
        </p>
      ) : null}

      <h2 className="mb-3 flex items-center gap-2 font-display text-base font-bold">
        <Flame className="h-4 w-4 text-primary" /> Choose your game
      </h2>

      <div className="space-y-3">
        {GAMES.map((game) => (
          <Link
            key={game.id}
            to="/battles"
            search={{ game: game.id }}
            className="group flex items-center gap-4 rounded-2xl border border-border/60 bg-card p-4 transition-all hover:border-primary/50 hover:bg-secondary/40 active:bg-secondary"
          >
            <div className="gold-gradient flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl shadow-lg shadow-primary/10">
              <Dices className="h-11 w-11 text-background drop-shadow-md" strokeWidth={2.4} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-display font-bold">{game.name}</p>
              <p className="truncate text-xs text-muted-foreground">{game.tagline}</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </Link>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-3 gap-2 text-center text-[11px] text-muted-foreground">
        <Feature icon={Zap} text="Instant payouts" />
        <Feature icon={ShieldCheck} text="Fair play checks" />
        <Feature icon={Trophy} text="24x7 battles" />
      </div>

      <Link
        to="/rules"
        className="mt-6 block rounded-xl border border-border/60 bg-card p-4 text-sm text-muted-foreground"
      >
        Read the rules, fair play policy and support options →
      </Link>
    </AppShell>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-3 text-center">
      <p className="font-display text-base font-bold text-primary">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function Feature({ icon: Icon, text }: { icon: typeof Zap; text: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-3">
      <Icon className="mx-auto mb-1 h-4 w-4 text-accent" />
      {text}
    </div>
  );
}
