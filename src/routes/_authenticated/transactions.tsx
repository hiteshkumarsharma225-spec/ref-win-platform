import { useState } from "react";
import { useUser } from "@/lib/account";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { rupees } from "@/lib/game";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/transactions")({
  component: TransactionsPage,
});

type TxnType =
  | "deposit"
  | "withdrawal"
  | "bet"
  | "winning"
  | "referral"
  | "bonus"
  | "refund"
  | "penalty";

const FILTERS = [
  { id: "all", label: "All", types: [] as string[] },
  { id: "deposit", label: "Deposits", types: ["deposit"] },
  { id: "withdrawal", label: "Withdrawals", types: ["withdrawal"] },
  { id: "bet", label: "Game Bets", types: ["bet"] },
  { id: "winning", label: "Winnings", types: ["winning", "referral", "bonus", "refund"] },
];

function TransactionsPage() {
  const [filter, setFilter] = useState("all");
  const { user } = useUser();

  const txns = useQuery({
    queryKey: ["transactions", filter],
    queryFn: async () => {
      let q = supabase
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      const types = (FILTERS.find((f) => f.id === filter)?.types ?? []) as TxnType[];
      if (types.length) q = q.in("type", types);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const battles = useQuery({
    queryKey: ["battle-history", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("battles")
        .select("id, game, amount, prize, status, creator_id, opponent_id, winner_id, created_at")
        .or(`creator_id.eq.${user!.id},opponent_id.eq.${user!.id}`)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const opponentIds = Array.from(new Set(
    (battles.data ?? [])
      .map((b) => (b.creator_id === user?.id ? b.opponent_id : b.creator_id))
      .filter(Boolean),
  )) as string[];

  const players = useQuery({
    queryKey: ["battle-history-players", opponentIds.join(",")],
    enabled: opponentIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, username").in("id", opponentIds);
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((p) => [p.id, p.username])) as Record<string, string>;
    },
  });

  return (
    <AppShell>
      <h1 className="mb-3 font-display text-xl font-bold">Transaction history</h1>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium",
              filter === f.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {(txns.data ?? []).length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No transactions yet.
          </p>
        ) : null}
        {(txns.data ?? []).map((t) => {
          const credit = ["winning", "referral", "bonus", "deposit", "refund"].includes(t.type);
          return (
            <div
              key={t.id}
              className="flex items-center justify-between rounded-xl border border-border/60 bg-card p-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold capitalize">{t.note ?? t.type}</p>
                <p className="text-[11px] text-muted-foreground">
                  {new Date(t.created_at).toLocaleString("en-IN")}
                </p>
              </div>
              <div className="text-right">
                <p className={cn("font-display font-bold", credit ? "text-accent" : "text-destructive")}>
                  {credit ? "+" : "-"}
                  {rupees(t.amount)}
                </p>
                <Badge variant="secondary" className="mt-1 text-[10px]">
                  {t.status}
                </Badge>
              </div>
            </div>
          );
        })}
      </div>

      <h2 className="mb-3 mt-8 font-display text-lg font-bold">Battle History</h2>
      <div className="space-y-2">
        {(battles.data ?? []).length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No battles played yet.</p>
        ) : null}
        {(battles.data ?? []).map((b) => {
          const opponentId = b.creator_id === user?.id ? b.opponent_id : b.creator_id;
          const opponent = opponentId ? players.data?.[opponentId] ?? "Player" : "Waiting for opponent";
          const isWinner = b.winner_id === user?.id;
          const result = b.status === "open" ? "Open" : b.status === "cancelled" ? "Refunded" : b.status === "disputed" ? "Disputed" : b.status === "completed" ? (isWinner ? "Won" : "Lost") : b.status.replace("_", " ");
          return (
            <div key={b.id} className="rounded-xl border border-border/60 bg-card p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{b.game} · vs {opponent}</p>
                  <p className="text-[11px] text-muted-foreground">{new Date(b.created_at).toLocaleString("en-IN")}</p>
                </div>
                <Badge variant={result === "Won" ? "default" : "secondary"}>{result}</Badge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <div><p className="text-muted-foreground">Entry</p><p className="font-semibold">{rupees(b.amount)} Credits</p></div>
                <div><p className="text-muted-foreground">{isWinner ? "Reward" : "Virtual Reward"}</p><p className="font-semibold text-accent">{rupees(b.prize)} Credits</p></div>
              </div>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
