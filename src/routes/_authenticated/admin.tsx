import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Clock3, Coins, Eye, Loader2, MinusCircle, PlusCircle, Search, ShieldAlert, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin, useUser } from "@/lib/account";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

function AdminPage() {
  const { user } = useUser();
  const { data: isAdmin, isLoading: roleLoading } = useIsAdmin(user?.id);
  const qc = useQueryClient();

  const requests = useQuery({
    queryKey: ["admin-credit-requests"],
    enabled: !!user && !!isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deposit_requests")
        .select("id,user_id,amount,utr,status,created_at,processed_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;

      const userIds = [...new Set((data ?? []).map((r) => r.user_id))];
      if (!userIds.length) return [];

      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id,username,phone")
        .in("id", userIds);
      if (profileError) throw profileError;

      const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
      return (data ?? []).map((r) => ({ ...r, profile: byId.get(r.user_id) ?? null }));
    },
  });

  const reviewBattles = useQuery({
    queryKey: ["admin-battle-reviews"],
    enabled: !!user && !!isAdmin,
    queryFn: async () => {
      const { data: battles, error } = await supabase
        .from("battles")
        .select("id,game,creator_id,opponent_id,status,result_deadline_at,created_at")
        .in("status", ["result_pending", "disputed"])
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;

      const ids = (battles ?? []).map((b) => b.id);
      if (!ids.length) return [];
      const { data: results, error: resultError } = await supabase
        .from("battle_results")
        .select("id,battle_id,user_id,claim,screenshot_url,created_at")
        .in("battle_id", ids);
      if (resultError) throw resultError;

      const userIds = [...new Set((results ?? []).map((r) => r.user_id))];
      const { data: profiles, error: profileError } = userIds.length
        ? await supabase.from("profiles").select("id,username,phone").in("id", userIds)
        : { data: [], error: null };
      if (profileError) throw profileError;

      const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
      return (battles ?? []).map((battle) => ({
        ...battle,
        results: (results ?? []).filter((r) => r.battle_id === battle.id).map((r) => ({
          ...r,
          profile: byId.get(r.user_id) ?? null,
        })),
      }));
    },
    refetchInterval: 5000,
  });

  const [userSearch, setUserSearch] = useState("");
  const [adjustAmount, setAdjustAmount] = useState(100);

  const adminUsers = useQuery({
    queryKey: ["admin-wallet-users", userSearch],
    enabled: !!user && !!isAdmin && userSearch.trim().length >= 2,
    queryFn: async () => {
      const q = userSearch.trim();
      const { data, error } = await supabase
        .from("profiles")
        .select("id,username,phone")
        .or("username.ilike.%" + q + "%,phone.ilike.%" + q + "%")
        .limit(10);
      if (error) throw error;
      const ids = (data ?? []).map((p) => p.id);
      if (!ids.length) return [];
      const { data: wallets, error: walletError } = await supabase
        .from("wallets")
        .select("user_id,bonus_cash,deposit_cash,winning_cash")
        .in("user_id", ids);
      if (walletError) throw walletError;
      const byId = new Map((wallets ?? []).map((w) => [w.user_id, w]));
      return (data ?? []).map((p) => ({ ...p, wallet: byId.get(p.id) ?? null }));
    },
  });

  const resolve = useMutation({
    mutationFn: async ({ battleId, winnerId }: { battleId: string; winnerId: string }) => {
      const { error } = await (supabase.rpc as any)("admin_resolve__battle", {
        p_battle: battleId,
        p_winner: winnerId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-battle-reviews"] });
      toast.success("Battle result approved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const adjust = useMutation({
    mutationFn: async ({ userId, delta }: { userId: string; delta: number }) => {
      const { error } = await (supabase.rpc as any)("admin_adjust__credits", {
        p_user: userId,
        p_delta: delta,
        p_note: "Admin credit wallet adjustment",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-wallet-users"] });
      toast.success("Wallet updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const process = useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => {
      const { error } = await supabase.rpc("admin_process_deposit", {
        p_id: id,
        p_approve: approve,
      });
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["admin-credit-requests"] });
      qc.invalidateQueries({ queryKey: ["admin-battle-reviews"] });
      toast.success(variables.approve ? "Credits approved" : "Request rejected");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (roleLoading) {
    return <AppShell title="Admin Panel"><div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div></AppShell>;
  }

  if (!isAdmin) {
    return (
      <AppShell title="Admin Panel">
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-5">
          <ShieldAlert className="mb-2 h-6 w-6 text-destructive" />
          <h1 className="font-display font-bold">Admin access required</h1>
          <p className="mt-1 text-sm text-muted-foreground">This page is available only to users with the admin role.</p>
          <Link to="/profile" className="mt-4 inline-block text-sm font-semibold underline">Back to profile</Link>
        </div>
      </AppShell>
    );
  }

  const rows = requests.data ?? [];
  const pending = rows.filter((r) => r.status === "pending");
  const resultReviews = reviewBattles.data ?? [];
  const pendingResults = resultReviews.filter((b) => b.status === "result_pending").length;
  const disputedResults = resultReviews.filter((b) => b.status === "disputed").length;

  return (
    <AppShell title="Admin Panel">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <p className="text-xs text-muted-foreground">Result reviews</p>
          <p className="mt-1 font-display text-2xl font-bold text-primary">{resultReviews.length}</p>
        </div>
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-xs text-muted-foreground">Disputed</p>
          <p className="mt-1 font-display text-2xl font-bold">{disputedResults}</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card p-4">
          <p className="text-xs text-muted-foreground">Result pending</p>
          <p className="mt-1 font-display text-2xl font-bold">{pendingResults}</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card p-4">
          <p className="text-xs text-muted-foreground">Credit requests</p>
          <p className="mt-1 font-display text-2xl font-bold">{pending.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border/60 bg-card p-4">
          <p className="text-xs text-muted-foreground">Pending requests</p>
          <p className="mt-1 font-display text-2xl font-bold">{pending.length}</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card p-4">
          <p className="text-xs text-muted-foreground">Total requests</p>
          <p className="mt-1 font-display text-2xl font-bold">{rows.length}</p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        <div>
          <h1 className="font-display text-lg font-bold">Match Result Approvals</h1>
          <p className="text-xs text-muted-foreground">
            Review pending/disputed battles and submitted screenshots. Approval adds virtual credits only.
          </p>
        </div>
        {(reviewBattles.data ?? []).length === 0 ? (
          <div className="rounded-xl border border-border/60 bg-card p-5 text-sm text-muted-foreground">
            No match results waiting for admin review.
          </div>
        ) : (reviewBattles.data ?? []).map((battle) => (
          <div key={battle.id} className="rounded-2xl border border-border/60 bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{battle.game}</p>
                <p className="text-xs text-muted-foreground">Battle {battle.id.slice(0, 8)} · {battle.status}</p>
              </div>
              <Badge variant={battle.status === "disputed" ? "destructive" : "secondary"}>{battle.status}</Badge>
            </div>
            <div className="mt-3 space-y-2">
              {battle.results.map((result) => (
                <div key={result.id} className="rounded-xl border border-border/60 bg-secondary/40 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold">{result.profile?.username ?? "Unknown player"}</p>
                      <p className="text-xs text-muted-foreground">Claimed: {result.claim}</p>
                    </div>
                    {result.screenshot_url ? (
                      <Button variant="outline" size="sm" onClick={async () => {
                        const { data, error } = await supabase.storage.from("result-screenshots").createSignedUrl(result.screenshot_url, 600);
                        if (error) return toast.error(error.message);
                        window.open(data.signedUrl, "_blank", "noopener,noreferrer");
                      }}><Eye className="h-4 w-4" /> Screenshot</Button>
                    ) : null}
                  </div>
                  <Button
                    className="mt-2 w-full"
                    size="sm"
                    onClick={() => resolve.mutate({ battleId: battle.id, winnerId: result.user_id })}
                    disabled={resolve.isPending || result.claim === "lost"}
                  >
                    {resolve.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Approve {result.profile?.username ?? "player"} as winner
                  </Button>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              For a player who claimed Lost, select the opponent only when the evidence supports that outcome. If evidence is inconclusive, leave the battle disputed.
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Approved rewards are virtual credits and are not a cash withdrawal balance.
            </p>
          </div>
        ))}

        <div className="pt-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h1 className="font-display text-lg font-bold">Wallet Management</h1>
              <p className="text-xs text-muted-foreground">Add or deduct virtual credits for testing and friends-only play.</p>
            </div>
            <Coins className="h-5 w-5 text-primary" />
          </div>
          <p className="text-xs text-muted-foreground">
            Search a user and add or deduct virtual credits. This never changes withdrawable cash.
          </p>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Username or phone"
              className="h-10 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm outline-none focus:border-primary"
            />
          </div>
          <input
            inputMode="numeric"
            value={adjustAmount}
            onChange={(e) => setAdjustAmount(Number(e.target.value.replace(/\D/g, "")) || 0)}
            className="h-10 w-24 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary"
          />
        </div>
        <div className="space-y-2">
          {(adminUsers.data ?? []).map((u) => (
            <div key={u.id} className="rounded-2xl border border-border/60 bg-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{u.username}</p>
                  <p className="text-xs text-muted-foreground">{u.phone}</p>
                </div>
                <div className="text-right">
                  <p className="font-display font-bold">{Number(u.wallet?.bonus_cash ?? 0).toLocaleString("en-IN")}</p>
                  <p className="text-[11px] text-muted-foreground">credits</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button onClick={() => adjust.mutate({ userId: u.id, delta: adjustAmount })} disabled={adjust.isPending || adjustAmount <= 0}>
                  <PlusCircle className="h-4 w-4" /> Add
                </Button>
                <Button variant="outline" onClick={() => adjust.mutate({ userId: u.id, delta: -adjustAmount })} disabled={adjust.isPending || adjustAmount <= 0}>
                  <MinusCircle className="h-4 w-4" /> Deduct
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-3">
          <h1 className="font-display text-lg font-bold">Credit Requests</h1>
          <p className="text-xs text-muted-foreground">Approve a request to add virtual credits to the user's virtual wallet.</p>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-xl border border-border/60 bg-card p-5 text-sm text-muted-foreground">
            No credit requests yet.
          </div>
        ) : rows.map((r) => (
          <div key={r.id} className="rounded-2xl border border-border/60 bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">{r.profile?.username ?? "Unknown user"}</p>
                <p className="text-xs text-muted-foreground">{r.profile?.phone ?? r.user_id}</p>
              </div>
              <Badge variant={r.status === "completed" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}>
                {r.status}
              </Badge>
            </div>

            <div className="mt-3 flex items-center justify-between rounded-xl bg-secondary/60 p-3">
              <div className="flex items-center gap-2">
                <Coins className="h-5 w-5 text-primary" />
                <span className="font-display text-xl font-bold">{Number(r.amount).toLocaleString("en-IN")}</span>
                <span className="text-xs text-muted-foreground">credits</span>
              </div>
              <Clock3 className="h-4 w-4 text-muted-foreground" />
            </div>

            <p className="mt-2 text-[11px] text-muted-foreground">
              Requested {new Date(r.created_at).toLocaleString("en-IN")}
            </p>

            {r.status === "pending" ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button
                  onClick={() => process.mutate({ id: r.id, approve: true })}
                  disabled={process.isPending}
                >
                  {process.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Approve
                </Button>
                <Button
                  variant="outline"
                  onClick={() => process.mutate({ id: r.id, approve: false })}
                  disabled={process.isPending}
                >
                  <X className="h-4 w-4" /> Reject
                </Button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </AppShell>
  );
}
