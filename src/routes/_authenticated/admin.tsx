import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Coins, Eye, Loader2, MinusCircle, PlusCircle, Search, ShieldAlert, X } from "lucide-react";
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
  const [userSearch, setUserSearch] = useState("");
  const [adjustAmount, setAdjustAmount] = useState(100);

  const kycRequests = useQuery({
    queryKey: ["admin-kyc"],
    enabled: !!user && !!isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("kyc_submissions").select("*").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    refetchInterval: 5000,
  });

  const reviewKyc = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const { error } = await supabase.rpc("admin_review_kyc", { p_id: id, p_status: status, p_note: status === "approved" ? "KYC approved by admin." : "KYC rejected by admin." });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-kyc"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("KYC status updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const withdrawalRequests = useQuery({
    queryKey: ["admin-credit-withdrawals"],
    enabled: !!user && !!isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("virtual_credit_withdrawals").select("*").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      const ids = [...new Set((data ?? []).map((r) => r.user_id))];
      if (!ids.length) return [];
      const { data: profiles, error: profileError } = await supabase.from("profiles").select("id,username,phone").in("id", ids);
      if (profileError) throw profileError;
      const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
      return (data ?? []).map((r) => ({ ...r, profile: byId.get(r.user_id) ?? null }));
    },
    refetchInterval: 5000,
  });

  const approveWithdrawal = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("admin_approve_virtual_credit_withdrawal", { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-credit-withdrawals"] }); toast.success("Withdrawal processed"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const completeWithdrawal = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("admin_complete_virtual_credit_withdrawal", { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-credit-withdrawals"] }); toast.success("Withdrawal marked successful"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const paymentRequests = useQuery({
    queryKey: ["admin-payment-requests"],
    enabled: !!user && !!isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_payment_requests")
        .select("id,user_id,amount,utr,status,merchant_upi,created_at,processed_at,admin_note")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      const ids = [...new Set((data ?? []).map((r) => r.user_id))];
      if (!ids.length) return [];
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id,username,phone")
        .in("id", ids);
      if (profileError) throw profileError;
      const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
      return (data ?? []).map((r) => ({ ...r, profile: byId.get(r.user_id) ?? null }));
    },
    refetchInterval: 5000,
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
      const { error } = await supabase.rpc("admin_resolve_demo_battle", {
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
      const { error } = await supabase.rpc("admin_adjust_demo_credits", {
        p_user: userId,
        p_delta: delta,
        p_note: "Admin credit wallet adjustment",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-wallet-users"] });
      toast.success("Virtual credits updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const approvePayment = useMutation({
    mutationFn: async (request: { id: string; userId: string; amount: number }) => {
      const { error: adjustError } = await supabase.rpc("admin_adjust_demo_credits", {
        p_user: request.userId,
        p_delta: request.amount,
        p_note: `UPI payment UTR verified: ${request.id}`,
      });
      if (adjustError) throw adjustError;

      const { error } = await supabase
        .from("credit_payment_requests")
        .update({
          status: "approved",
          processed_at: new Date().toISOString(),
          processed_by: user!.id,
          admin_note: "UTR verified by admin; virtual credits added.",
        })
        .eq("id", request.id)
        .eq("status", "pending");
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-payment-requests"] });
      qc.invalidateQueries({ queryKey: ["admin-wallet-users"] });
      toast.success("Payment verified and virtual credits added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rejectPayment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("credit_payment_requests")
        .update({
          status: "rejected",
          processed_at: new Date().toISOString(),
          processed_by: user!.id,
          admin_note: "Payment reference rejected by admin.",
        })
        .eq("id", id)
        .eq("status", "pending");
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-payment-requests"] });
      toast.success("Payment request rejected");
    },
    onError: (e: Error) => toast.error(e.message),
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

  const requests = paymentRequests.data ?? [];
  const pendingPayments = requests.filter((r) => r.status === "pending");
  const resultReviews = reviewBattles.data ?? [];
  const pendingResults = resultReviews.filter((b) => b.status === "result_pending").length;
  const disputedResults = resultReviews.filter((b) => b.status === "disputed").length;

  return (
    <AppShell title="Admin Panel">
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Result reviews" value={resultReviews.length} />
        <Stat label="Disputed" value={disputedResults} />
        <Stat label="Result pending" value={pendingResults} />
        <Stat label="UPI requests" value={pendingPayments.length} />
      </div>

      <div className="mt-5 space-y-3">
        <section>
          <h1 className="font-display text-lg font-bold">Match Result Approvals</h1>
          <p className="text-xs text-muted-foreground">Review pending/disputed battles. Approved rewards are virtual credits only.</p>
        </section>

        {resultReviews.length === 0 ? (
          <div className="rounded-xl border border-border/60 bg-card p-5 text-sm text-muted-foreground">No match results waiting for admin review.</div>
        ) : resultReviews.map((battle) => (
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
                        const { data, error } = await supabase.storage.from("result-screenshots").createSignedUrl(String(result.screenshot_url), 600);
                        if (error) { toast.error(error.message); return; }
                        window.open(data.signedUrl, "_blank", "noopener,noreferrer");
                      }}><Eye className="h-4 w-4" /> Screenshot</Button>
                    ) : null}
                  </div>
                  <Button className="mt-2 w-full" size="sm" onClick={() => resolve.mutate({ battleId: battle.id, winnerId: result.user_id })} disabled={resolve.isPending || result.claim === "lost"}>
                    {resolve.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Approve {result.profile?.username ?? "player"} as winner
                  </Button>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">If evidence is inconclusive, leave the battle disputed.</p>
          </div>
        ))}

        <section className="pt-3">
          <h1 className="font-display text-lg font-bold">Credit Withdrawal Requests</h1>
          <p className="text-xs text-muted-foreground">Manage non-cashable virtual-credit withdrawal requests.</p>
        </section>
        {(withdrawalRequests.data ?? []).filter((r) => r.status === "pending" || r.status === "processed").map((r) => (
          <div key={r.id} className="rounded-2xl border border-border/60 bg-card p-4">
            <div className="flex items-center justify-between">
              <div><p className="font-semibold">{r.profile?.username ?? "Unknown user"}</p><p className="text-xs text-muted-foreground">{r.profile?.phone ?? r.user_id}</p></div>
              <Badge variant={r.status === "pending" ? "secondary" : "default"}>{r.status === "pending" ? "pending" : "processed"}</Badge>
            </div>
            <div className="mt-3 rounded-xl bg-secondary/60 p-3"><p className="font-display text-xl font-bold">{Number(r.amount).toLocaleString("en-IN")} credits</p><p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("en-IN")}</p></div>
            {r.status === "pending" ? <Button className="mt-3 w-full" onClick={() => approveWithdrawal.mutate(r.id)} disabled={approveWithdrawal.isPending}><Check className="h-4 w-4" /> Withdrawal Complete / Process</Button> : null}
            {r.status === "processed" ? <Button className="mt-3 w-full" onClick={() => completeWithdrawal.mutate(r.id)} disabled={completeWithdrawal.isPending}><Check className="h-4 w-4" /> Withdrawal Complete</Button> : null}
          </div>
        ))}
        <section className="pt-3">
          <h1 className="font-display text-lg font-bold">Past Withdrawals</h1>
          <p className="text-xs text-muted-foreground">Successfully completed credit requests.</p>
        </section>
        {(withdrawalRequests.data ?? []).filter((r) => r.status === "successful").map((r) => (
          <div key={r.id} className="rounded-xl border border-border/60 bg-card p-3 text-sm"><div className="flex justify-between"><span className="font-semibold">{r.profile?.username ?? "Unknown user"}</span><Badge>successful</Badge></div><p className="mt-1 text-muted-foreground">{Number(r.amount).toLocaleString("en-IN")} credits · {new Date(r.created_at).toLocaleString("en-IN")}</p></div>
        ))}

        <section className="pt-3">
          <h1 className="font-display text-lg font-bold">KYC Verification Requests</h1>
          <p className="text-xs text-muted-foreground">Review identity details and document photos before approving KYC.</p>
        </section>
        {(kycRequests.data ?? []).map((k) => (
          <div key={k.id} className="rounded-2xl border border-border/60 bg-card p-4">
            <div className="flex items-center justify-between">
              <div><p className="font-semibold">{k.full_name}</p><p className="text-xs text-muted-foreground">{k.mobile_number ?? "—"} · {String(k.doc_type).toUpperCase()}</p></div>
              <Badge variant={k.status === "approved" ? "default" : k.status === "rejected" ? "destructive" : "secondary"}>{k.status}</Badge>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Document: {k.doc_number}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                ["Front", k.document_front_url],
                ["Back", k.document_back_url],
                ["PAN", k.pan_document_url],
              ].filter(([, url]) => !!url).map(([label, url]) => (
                <Button key={label} size="sm" variant="outline" onClick={async () => {
                  const { data, error } = await supabase.storage.from("kyc-docs").createSignedUrl(String(url), 600);
                  if (error) return toast.error(error.message);
                  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
                }}>
                  <Eye className="h-4 w-4" /> View {label}
                </Button>
              ))}
            </div>
            {k.status === "pending" ? <div className="mt-3 grid grid-cols-2 gap-2"><Button onClick={() => reviewKyc.mutate({ id: k.id, status: "approved" })}>Approve</Button><Button variant="outline" onClick={() => reviewKyc.mutate({ id: k.id, status: "rejected" })}>Reject</Button></div> : null}
          </div>
        ))}

        <section className="pt-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h1 className="font-display text-lg font-bold">UPI Credit Requests</h1>
              <p className="text-xs text-muted-foreground">Verify the UTR before adding non-cashable virtual credits.</p>
            </div>
            <Coins className="h-5 w-5 text-primary" />
          </div>
        </section>

        {requests.length === 0 ? (
          <div className="rounded-xl border border-border/60 bg-card p-5 text-sm text-muted-foreground">No UPI credit requests yet.</div>
        ) : requests.map((r) => (
          <div key={r.id} className="rounded-2xl border border-border/60 bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">{r.profile?.username ?? "Unknown user"}</p>
                <p className="text-xs text-muted-foreground">{r.profile?.phone ?? r.user_id}</p>
              </div>
              <Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}>{r.status}</Badge>
            </div>
            <div className="mt-3 rounded-xl bg-secondary/60 p-3">
              <p className="font-display text-xl font-bold">{Number(r.amount).toLocaleString("en-IN")} credits</p>
              <p className="mt-1 text-xs text-muted-foreground">UTR: {r.utr}</p>
              <p className="text-xs text-muted-foreground">UPI: {r.merchant_upi}</p>
              <p className="text-[11px] text-muted-foreground">{new Date(r.created_at).toLocaleString("en-IN")}</p>
            </div>
            {r.status === "pending" ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button onClick={() => approvePayment.mutate({ id: r.id, userId: r.user_id, amount: Number(r.amount) })} disabled={approvePayment.isPending}>
                  {approvePayment.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Approve
                </Button>
                <Button variant="outline" onClick={() => rejectPayment.mutate(r.id)} disabled={rejectPayment.isPending}>
                  <X className="h-4 w-4" /> Reject
                </Button>
              </div>
            ) : null}
          </div>
        ))}

        <section className="pt-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h1 className="font-display text-lg font-bold">Virtual Credit Wallet</h1>
              <p className="text-xs text-muted-foreground">Add or deduct virtual credits. This does not create withdrawable cash.</p>
            </div>
            <Coins className="h-5 w-5 text-primary" />
          </div>
        </section>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="Username or phone" className="h-10 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm outline-none focus:border-primary" />
          </div>
          <input inputMode="numeric" value={adjustAmount} onChange={(e) => setAdjustAmount(Number(e.target.value.replace(/\D/g, "")) || 0)} className="h-10 w-24 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary" />
        </div>

        <div className="space-y-2">
          {(adminUsers.data ?? []).map((u) => (
            <div key={u.id} className="rounded-2xl border border-border/60 bg-card p-4">
              <div className="flex items-center justify-between">
                <div><p className="font-semibold">{u.username}</p><p className="text-xs text-muted-foreground">{u.phone}</p></div>
                <div className="text-right"><p className="font-display font-bold">{Number(u.wallet?.bonus_cash ?? 0).toLocaleString("en-IN")}</p><p className="text-[11px] text-muted-foreground">credits</p></div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button onClick={() => adjust.mutate({ userId: u.id, delta: adjustAmount })} disabled={adjust.isPending || adjustAmount <= 0}><PlusCircle className="h-4 w-4" /> Add</Button>
                <Button variant="outline" onClick={() => adjust.mutate({ userId: u.id, delta: -adjustAmount })} disabled={adjust.isPending || adjustAmount <= 0}><MinusCircle className="h-4 w-4" /> Deduct</Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold">{value}</p>
    </div>
  );
}
