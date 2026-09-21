import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Copy, Loader2, Timer, Upload } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { gameName, rupees, statusLabel } from "@/lib/game";
import { useUser } from "@/lib/account";

export const Route = createFileRoute("/_authenticated/battle/$id")({
  component: BattleRoom,
});

function BattleRoom() {
  const { id } = Route.useParams();
  const { user } = useUser();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const battle = useQuery({
    queryKey: ["battle", id],
    refetchInterval: 4000,
    queryFn: async () => {
      const { data, error } = await supabase.from("battles").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const myResult = useQuery({
    queryKey: ["battle-result", id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("battle_results")
        .select("*")
        .eq("battle_id", id)
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const players = useQuery({
    queryKey: ["battle-players", id, battle.data?.opponent_id],
    enabled: !!battle.data,
    queryFn: async () => {
      const ids = [battle.data!.creator_id, battle.data!.opponent_id].filter(Boolean) as string[];
      const { data, error } = await supabase.from("profiles").select("id, username").in("id", ids);
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((p) => [p.id, p.username]));
    },
  });

  useEffect(() => {
    const started = battle.data?.started_at ?? battle.data?.created_at;
    if (!started) return;
    const t = setInterval(() => {
      setElapsed(Math.floor((Date.now() - new Date(started).getTime()) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [battle.data?.started_at, battle.data?.created_at]);

  const saveCode = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("set_room_code", { p_battle: id, p_code: code });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Room code shared with your opponent");
      qc.invalidateQueries({ queryKey: ["battle", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = useMutation({
    mutationFn: async ({ claim, shot }: { claim: "won" | "lost" | "cancel"; shot?: string }) => {
      const { data, error } = await supabase.rpc("submit_battle_result", {
        p_battle: id,
        p_claim: claim,
        p_screenshot: shot ?? "",
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (state) => {
      qc.invalidateQueries();
      const msg: Record<string, string> = {
        result_pending: "Result submitted. Waiting for your opponent.",
        completed: "Match settled — check your wallet!",
        cancelled: "Match cancelled, entry refunded.",
        disputed: "Results don't match. Sent to review team.",
      };
      toast.success(msg[state] ?? "Result submitted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadAndWin = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const path = `${user.id}/${id}-${Date.now()}.${file.name.split(".").pop()}`;
      const { error } = await supabase.storage.from("result-screenshots").upload(path, file);
      if (error) throw error;
      await submit.mutateAsync({ claim: "won", shot: path });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const b = battle.data;
  if (battle.isLoading) {
    return (
      <AppShell>
        <Loader2 className="mx-auto mt-20 h-6 w-6 animate-spin text-primary" />
      </AppShell>
    );
  }
  if (!b) {
    return (
      <AppShell>
        <p className="mt-20 text-center text-muted-foreground">Battle not found.</p>
      </AppShell>
    );
  }

  const isPlayer = b.creator_id === user?.id || b.opponent_id === user?.id;
  const deadline = b.result_deadline_at ? new Date(b.result_deadline_at).getTime() : null;
  const remainingSeconds = deadline ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) : null;
  const deadlineMm = remainingSeconds === null ? "--" : String(Math.floor(remainingSeconds / 60)).padStart(2, "0");
  const deadlineSs = remainingSeconds === null ? "--" : String(remainingSeconds % 60).padStart(2, "0");
  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <AppShell>
      <div className="glow-gold rounded-2xl bg-card p-5 text-center">
        <Badge variant="secondary" className="mb-2">
          {gameName(b.game)}
        </Badge>
        <p className="font-display text-3xl font-bold gold-text">{rupees(b.prize)}</p>
        <p className="text-xs text-muted-foreground">Winning prize · Entry {rupees(b.amount)}</p>

        <div className="mt-4 flex items-center justify-center gap-3 text-sm">
          <span className="font-semibold">{players.data?.[b.creator_id] ?? "Player 1"}</span>
          <span className="gold-text font-display font-bold">VS</span>
          <span className="font-semibold">
            {b.opponent_id ? (players.data?.[b.opponent_id] ?? "Player 2") : "Waiting…"}
          </span>
        </div>

        <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Timer className="h-4 w-4" />
          {mm}:{ss} · {statusLabel(b.status)}
        </div>
        {(b.status === "running" || b.status === "result_pending") && b.result_deadline_at ? (
          <div className={`mt-3 rounded-xl border p-3 ${remainingSeconds !== null && remainingSeconds <= 60 ? "border-destructive/50 bg-destructive/10" : "border-primary/30 bg-primary/5"}`}>
            <p className="text-xs text-muted-foreground">Result submission deadline</p>
            <p className="mt-1 font-display text-2xl font-bold">
              {deadlineMm}:{deadlineSs}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Submit your result before the timer expires. The server will apply the deadline rule.
            </p>
          </div>
        ) : null}
      </div>

      {isPlayer && (b.status === "running" || b.status === "result_pending") ? (
        <div className="mt-4 rounded-2xl border border-border/60 bg-card p-4">
          <p className="mb-2 font-display font-bold">Room Code</p>
          {b.room_code ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 rounded-lg border border-primary/40 bg-primary/10 px-3 py-3 text-center font-display text-xl font-bold tracking-widest text-primary">
                {b.room_code}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  navigator.clipboard.writeText(b.room_code!);
                  toast.success("Room code copied");
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Paste Ludo King room code"
              />
              <Button onClick={() => saveCode.mutate()} disabled={!code || saveCode.isPending}>
                Share
              </Button>
            </div>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Create the room inside Ludo King, then paste the code here so your opponent can join.
          </p>
        </div>
      ) : null}

      {isPlayer && (b.status === "running" || b.status === "result_pending") ? (
        <div className="mt-4 rounded-2xl border border-border/60 bg-card p-4">
          <p className="mb-1 font-display font-bold">Match Result</p>
          {myResult.data ? (
            <p className="text-sm text-muted-foreground">
              You submitted: <span className="font-semibold text-foreground">{myResult.data.claim}</span>.
              Waiting for your opponent's result.
            </p>
          ) : (
            <>
              <p className="mb-3 text-xs text-muted-foreground">
                Upload a winning screenshot if you won. False claims lead to a penalty.
              </p>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  className="bg-success text-success-foreground hover:bg-success/90"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading || submit.isPending}
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  I Won
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => submit.mutate({ claim: "lost" })}
                  disabled={submit.isPending}
                >
                  I Lost
                </Button>
                <Button
                  variant="outline"
                  onClick={() => submit.mutate({ claim: "cancel" })}
                  disabled={submit.isPending}
                >
                  Cancel
                </Button>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadAndWin(f);
                }}
              />
            </>
          )}
        </div>
      ) : null}

      {b.status === "completed" ? (
        <div className="mt-4 rounded-2xl border border-accent/40 bg-accent/10 p-4 text-center">
          <p className="font-display font-bold text-accent">
            {b.winner_id === user?.id ? "You won the demo battle!" : "Match completed"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            This version uses virtual/demo credits only.
          </p>
        </div>
      ) : null}

      {b.status === "disputed" ? (
        <div className="mt-4 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <p className="font-semibold text-destructive">Result mismatch — under review</p>
          <p className="mt-1 text-muted-foreground">
            Our team will verify the screenshots and settle this battle within 30 minutes.
          </p>
        </div>
      ) : null}

      <div className="mt-4 rounded-2xl border border-warning/40 bg-warning/10 p-4 text-xs text-muted-foreground">
        <p className="mb-1 flex items-center gap-2 font-semibold text-warning">
          <AlertTriangle className="h-4 w-4" /> Dispute & penalty rules
        </p>
        Wrong result updates attract a ₹50 penalty. Repeat offences can lock your account. Always
        upload a clear winning screenshot with the room code visible.
      </div>

      <Button variant="ghost" className="mt-4 w-full" onClick={() => navigate({ to: "/battles" })}>
        Back to lobby
      </Button>
    </AppShell>
  );
}
