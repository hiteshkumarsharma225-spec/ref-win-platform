import { useEffect, useState, useRef } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Swords, Trophy, Timer, MessageSquareWarning, Upload } from "lucide-react";
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
  validateSearch: z.object({ game: z.string().optional(), view: z.enum(["open", "live"]).optional() }),
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
  const { game, view } = Route.useSearch();
  const navigate = useNavigate();
  const activeGame = game ?? GAMES[0].id;
  const { user } = useUser();
  const qc = useQueryClient();
  const [complaintBattle, setComplaintBattle] = useState<string | null>(null);
  const [complaintText, setComplaintText] = useState("");
  const [complaintProof, setComplaintProof] = useState("");
  const complaintFile = useRef<HTMLInputElement>(null);

  const myBattles = useQuery({
    queryKey: ["my-battles", user?.id],
    enabled: !!user,
    refetchInterval: 5000,
    queryFn: async () => {
      await supabase.rpc("resolve_expired_battles");
      const { data, error } = await supabase
        .from("battles")
        .select("id,game,amount,prize,status,creator_id,opponent_id,winner_id,created_at,started_at,settled_at")
        .or(`creator_id.eq.${user!.id},opponent_id.eq.${user!.id}`)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const openChallenges = useQuery({
    queryKey: ["open-challenges", activeGame],
    refetchInterval: 5000,
    queryFn: async () => {
      await supabase.rpc("expire_open_battles");
      const { data, error } = await supabase
        .from("battles")
        .select("id,game,amount,prize,status,creator_id,opponent_id,created_at")
        .eq("game", activeGame)
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      return data as BattleRow[];
    },
  });

  const names = useQuery({
    queryKey: ["player-names"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, username");
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((p) => [p.id, p.username])) as Record<string, string>;
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
      toast.success("Battle cancelled, credits restored");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendComplaint = async () => {
    if (!user || !complaintBattle || complaintText.trim().length < 3) return;
    const { error } = await supabase.from("match_complaints").insert({
      battle_id: complaintBattle,
      user_id: user.id,
      concern: complaintText.trim(),
      proof_url: complaintProof || null,
    });
    if (error) { toast.error(error.message); return; }
    setComplaintBattle(null); setComplaintText(""); setComplaintProof("");
    qc.invalidateQueries({ queryKey: ["my-battles"] });
    toast.success("Complaint submitted to admin.");
  };

  const uploadComplaint = async (file: File) => {
    if (!user || !complaintBattle) return;
    const path = `${user.id}/complaint-${complaintBattle}-${Date.now()}-${file.name.replace(/[^\\w.-]/g, "")}`;
    const { error } = await supabase.storage.from("result-screenshots").upload(path, file);
    if (error) { toast.error(error.message); return; }
    setComplaintProof(path);
    toast.success("Proof attached");
  };

  const list = myBattles.data ?? [];
  const running = list.filter((b) => ["running", "result_pending", "disputed"].includes(b.status));
  const completed = list.filter((b) => ["completed", "cancelled"].includes(b.status));
  const open = openChallenges.data ?? [];

  return (
    <AppShell title="My Battles">
      <div className="mb-4 rounded-2xl border border-border/60 bg-card p-4">
        <p className="text-xs text-muted-foreground">MY BATTLES</p>
        <h1 className="font-display text-xl font-bold">Running & Completed</h1>
        <p className="mt-1 text-xs text-muted-foreground">Your complete battle record with opponent, result, date and time.</p>
      </div>

      <Section title="Running Battles" icon={Trophy} count={running.length}>
        {running.length === 0 ? <Empty text="No running battles." /> : running.map((b) => {
          const opponentId = b.creator_id === user?.id ? b.opponent_id : b.creator_id;
          return <BattleCard key={b.id} battle={b as BattleRow} name={opponentId ? `vs ${names.data?.[opponentId] ?? "Player"}` : "Waiting for opponent"} action={
            <Button size="sm" onClick={() => navigate({ to: "/battle/$id", params: { id: b.id } })}>Open Battle</Button>
          } />;
        })}
      </Section>

      <Section title="Completed Battles" icon={Trophy} count={completed.length}>
        {completed.length === 0 ? <Empty text="No completed battles yet." /> : completed.map((b) => {
          const opponentId = b.creator_id === user?.id ? b.opponent_id : b.creator_id;
          const opponent = opponentId ? names.data?.[opponentId] ?? "Player" : "—";
          const won = b.winner_id === user?.id;
          const result = b.status === "cancelled" ? "Refunded" : won ? "Won" : "Lost";
          return <div key={b.id} className="rounded-2xl border border-border/60 bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div><p className="font-semibold">{gameName(b.game)} · vs {opponent}</p><p className="text-[11px] text-muted-foreground">{new Date(b.created_at).toLocaleString("en-IN")}</p></div>
              <Badge variant={won ? "default" : "secondary"}>{result}</Badge>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div><p className="text-muted-foreground">Entry</p><p className="font-semibold">{rupees(b.amount)} Credits</p></div>
              <div><p className="text-muted-foreground">Virtual Reward</p><p className="font-semibold text-accent">{rupees(b.prize)} Credits</p></div>
            </div>
            {b.status === "completed" ? <div className="mt-3 border-t border-border/50 pt-3">
              {complaintBattle === b.id ? <div className="space-y-2">
                <textarea value={complaintText} onChange={e=>setComplaintText(e.target.value)} placeholder="Describe your concern..." className="min-h-20 w-full rounded-xl border border-border bg-background p-3 text-xs" />
                <input ref={complaintFile} type="file" accept="image/*" className="hidden" onChange={e=>{const f=e.target.files?.[0]; if(f) void uploadComplaint(f);}} />
                <div className="flex gap-2"><Button size="sm" variant="outline" onClick={()=>complaintFile.current?.click()}><Upload className="h-4 w-4"/>Proof</Button>{complaintProof?<span className="self-center text-[11px] text-muted-foreground">Attached</span>:null}</div>
                <div className="grid grid-cols-2 gap-2"><Button size="sm" onClick={()=>void sendComplaint()} disabled={complaintText.trim().length<3}>Send Complaint</Button><Button size="sm" variant="outline" onClick={()=>{setComplaintBattle(null);setComplaintText("");setComplaintProof("");}}>Cancel</Button></div>
              </div> : <Button size="sm" variant="outline" onClick={()=>setComplaintBattle(b.id)}><MessageSquareWarning className="h-4 w-4"/> Complaint / Report</Button>}
            </div> : null}
          </div>;
        })}
      </Section>

      <div className="mt-8 border-t border-border/60 pt-5">
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
          {GAMES.map(g=><button key={g.id} onClick={()=>navigate({to:"/battles",search:{game:g.id}})} className={cn("shrink-0 rounded-full border px-4 py-2 text-sm font-medium",activeGame===g.id?"border-primary bg-primary text-primary-foreground":"border-border bg-card text-muted-foreground")}>{g.emoji} {g.name}</button>)}
        </div>
        <CreateBattleDialog game={activeGame} />
        <Section title="Open Challenges" icon={Swords} count={open.length}>
          {open.length===0?<Empty text="No open challenges."/>:open.map(b=><BattleCard key={b.id} battle={b} name={names.data?.[b.creator_id]??"Player"} action={b.creator_id===user?.id?<Button variant="outline" size="sm" onClick={()=>cancel.mutate(b.id)}>Cancel</Button>:<Button size="sm" onClick={()=>accept.mutate(b.id)}>Accept</Button>}/>)}
        </Section>
      </div>
    </AppShell>
  );
}

