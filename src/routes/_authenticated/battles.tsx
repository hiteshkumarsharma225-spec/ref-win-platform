import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Swords, Trophy } from "lucide-react";
import { z } from "zod";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { BATTLE_AMOUNTS, GAMES, gameName, prizeFor, rupees } from "@/lib/game";
import { useUser } from "@/lib/account";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/battles")({
  validateSearch: z.object({ game: z.string().optional() }),
  component: BattlesPage,
});

type BattleRow = {
  id: string;
  game: string;
  amount: number | string;
  prize: number | string;
  status: string;
  creator_id: string;
  opponent_id: string | null;
  created_at: string;
};

function BattlesPage() {
  const { game } = Route.useSearch();
  const navigate = useNavigate();
  const activeGame = game ?? GAMES[0].id;
  const { user } = useUser();
  const qc = useQueryClient();

  const battles = useQuery({
    queryKey: ["battles", activeGame],
    refetchInterval: 5000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("battles")
        .select("id, game, amount, prize, status, creator_id, opponent_id, created_at")
        .eq("game", activeGame)
        .in("status", ["open", "running", "result_pending", "disputed"])
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return data as BattleRow[];
    },
  });

  const names = useQuery({
    queryKey: ["player-names"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, username");
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((p) => [p.id, p.username])) as Record<
        string,
        string
      >;
    },
  });

  const accept = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("accept_battle", { p_battle: id });
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries();
      navigate({ to: "/battle/$id", params: { id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("cancel_open_battle", { p_battle: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Battle cancelled, entry refunded");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const list = battles.data ?? [];
  const open = list.filter((b) => b.status === "open");
  const running = list.filter((b) => b.status !== "open");

  return (
    <AppShell>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {GAMES.map((g) => (
          <button
            key={g.id}
            onClick={() => navigate({ to: "/battles", search: { game: g.id } })}
            className={cn(
              "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
              activeGame === g.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground",
            )}
          >
            {g.emoji} {g.name}
          </button>
        ))}
      </div>

      <CreateBattleDialog game={activeGame} />

      <Section title="Open Battles" icon={Swords} count={open.length}>
        {open.length === 0 ? (
          <Empty text="No open battles. Create one and wait for a challenger." />
        ) : (
          open.map((b) => (
            <BattleCard
              key={b.id}
              battle={b}
              name={names.data?.[b.creator_id] ?? "Player"}
              action={
                b.creator_id === user?.id ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => cancel.mutate(b.id)}
                    disabled={cancel.isPending}
                  >
                    Cancel
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => accept.mutate(b.id)} disabled={accept.isPending}>
                    {accept.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Accept"}
                  </Button>
                )
              }
            />
          ))
        )}
      </Section>

      <Section title="Running Battles" icon={Trophy} count={running.length}>
        {running.length === 0 ? (
          <Empty text="No running battles right now." />
        ) : (
          running.map((b) => (
            <BattleCard
              key={b.id}
              battle={b}
              name={`${names.data?.[b.creator_id] ?? "Player"} vs ${
                names.data?.[b.opponent_id ?? ""] ?? "Player"
              }`}
              action={
                b.creator_id === user?.id || b.opponent_id === user?.id ? (
                  <Button
                    size="sm"
                    onClick={() => navigate({ to: "/battle/$id", params: { id: b.id } })}
                  >
                    Open
                  </Button>
                ) : (
                  <Badge variant="secondary">Live</Badge>
                )
              }
            />
          ))
        )}
      </Section>
    </AppShell>
  );
}

function Section({
  title,
  icon: Icon,
  count,
  children,
}: {
  title: string;
  icon: typeof Swords;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-6">
      <h2 className="mb-3 flex items-center gap-2 font-display text-base font-bold">
        <Icon className="h-4 w-4 text-primary" /> {title}
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
          {count}
        </span>
      </h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-dashed border-border bg-card/50 p-5 text-center text-sm text-muted-foreground">
      {text}
    </p>
  );
}

function BattleCard({
  battle,
  name,
  action,
}: {
  battle: BattleRow;
  name: string;
  action: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4">
      <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>Challenge by {name}</span>
        <span>{gameName(battle.game)}</span>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Entry</p>
          <p className="font-display text-lg font-bold">{rupees(battle.amount)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Prize</p>
          <p className="font-display text-lg font-bold text-accent">{rupees(battle.prize)}</p>
        </div>
        {action}
      </div>
    </div>
  );
}

function CreateBattleDialog({ game }: { game: string }) {
  const [openDialog, setOpenDialog] = useState(false);
  const [amount, setAmount] = useState(50);
  const [selectedGame, setSelectedGame] = useState(game);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("create_battle", {
        p_game: selectedGame,
        p_amount: amount,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (id) => {
      setOpenDialog(false);
      qc.invalidateQueries();
      toast.success("Battle created! Waiting for an opponent.");
      navigate({ to: "/battle/$id", params: { id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog
      open={openDialog}
      onOpenChange={(o) => {
        setOpenDialog(o);
        if (o) setSelectedGame(game);
      }}
    >
      <DialogTrigger asChild>
        <Button className="w-full" size="lg">
          <Plus className="h-4 w-4" /> Create Battle
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">Create Battle</DialogTitle>
          <DialogDescription>Set your entry amount and challenge a player.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Game</Label>
            <div className="grid grid-cols-3 gap-2">
              {GAMES.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setSelectedGame(g.id)}
                  className={cn(
                    "rounded-lg border p-2 text-xs",
                    selectedGame === g.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground",
                  )}
                >
                  {g.emoji}
                  <br />
                  {g.name.replace("Ludo ", "")}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Battle amount</Label>
            <div className="grid grid-cols-3 gap-2">
              {BATTLE_AMOUNTS.map((a) => (
                <button
                  key={a}
                  onClick={() => setAmount(a)}
                  className={cn(
                    "rounded-lg border py-2 text-sm font-semibold",
                    amount === a
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card",
                  )}
                >
                  ₹{a}
                </button>
              ))}
            </div>
            <Input
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value.replace(/\D/g, "")) || 0)}
              placeholder="Custom amount"
            />
          </div>

          <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Entry</span>
              <span className="font-semibold">{rupees(amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Winning prize</span>
              <span className="font-display font-bold text-primary">{rupees(prizeFor(amount))}</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">5% platform commission applies.</p>
          </div>
        </div>

        <DialogFooter>
          <Button
            className="w-full"
            onClick={() => create.mutate()}
            disabled={create.isPending || amount < 10}
          >
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Set Battle
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
