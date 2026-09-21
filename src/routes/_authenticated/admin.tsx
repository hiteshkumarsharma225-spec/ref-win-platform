import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Clock3, Coins, Eye, Loader2, ShieldAlert, X } from "lucide-react";
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
    queryKey: ["admin-demo-credit-requests"],
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
    queryKey: ["admin-demo-battle-reviews"],
    enabled: !!user && !!isAdmin,
    queryFn: async () => {
      const { data: battles, error } = await supabase
        .from("battles")
        .select("id,game,creator_id,opponent_id,status,result_deadline_at,created_at")
        .eq("status", "disputed")
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

  const process = useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => {
      const { error } = await supabase.rpc("admin_process_deposit", {
        p_id: id,
        p_approve: approve,
      });
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["admin-demo-credit-requests"] });
      qc.invalidateQueries({ queryKey: ["admin-demo-battle-reviews"] });
      toast.success(variables.approve ? "Demo credits approved" : "Request rejected");
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

  return (
    <AppShell title="Admin Panel">
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
          <h1 className="font-display text-lg font-bold">Demo Credit Requests</h1>
          <p className="text-xs text-muted-foreground">Approve a request to add virtual credits to the user's demo wallet.</p>
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
                <span className="text-xs text-muted-foreground">demo credits</span>
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
