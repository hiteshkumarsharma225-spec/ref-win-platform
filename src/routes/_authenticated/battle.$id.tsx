import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Copy, Loader2, Timer, Upload, MessageSquareWarning } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { gameName, rupees, statusLabel } from "@/lib/game";
import { useUser } from "@/lib/account";

export const Route = createFileRoute("/_authenticated/battle/$id")({ component: BattleRoom });

function BattleRoom() {
  const { id } = Route.useParams();
  const { user } = useUser();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [code,setCode]=useState("");
  const [elapsed,setElapsed]=useState(0);
  const [objection,setObjection]=useState("");
  const [complaint,setComplaint]=useState("");
  const [uploading,setUploading]=useState(false);
  const [complaintUploading,setComplaintUploading]=useState(false);
  const resultFile=useRef<HTMLInputElement>(null);
  const objectionFile=useRef<HTMLInputElement>(null);
  const complaintFile=useRef<HTMLInputElement>(null);
  const [objectionProof,setObjectionProof]=useState("");
  const [complaintProof,setComplaintProof]=useState("");

  const battle=useQuery({
    queryKey:["battle",id],refetchInterval:3000,
    queryFn:async()=>{await supabase.rpc("resolve_expired_battles");const {data,error}=await supabase.from("battles").select("*").eq("id",id).maybeSingle();if(error)throw error;return data;}
  });
  const results=useQuery({
    queryKey:["battle-results",id],enabled:!!user,
    queryFn:async()=>{const {data,error}=await supabase.from("battle_results").select("*").eq("battle_id",id).order("created_at");if(error)throw error;return data??[];}
  });
  const myResult=results.data?.find(r=>r.user_id===user?.id);
  const opponentResult=results.data?.find(r=>r.user_id!==user?.id);
  const players=useQuery({
    queryKey:["battle-players",id],enabled:!!battle.data,
    queryFn:async()=>{const ids=[battle.data!.creator_id,battle.data!.opponent_id].filter(Boolean) as string[];const {data,error}=await supabase.from("profiles").select("id,username").in("id",ids);if(error)throw error;return Object.fromEntries((data??[]).map(p=>[p.id,p.username]));}
  });

  useEffect(()=>{const started=battle.data?.started_at??battle.data?.created_at;if(!started)return;const t=setInterval(()=>setElapsed(Math.floor((Date.now()-new Date(started).getTime())/1000)),1000);return()=>clearInterval(t);},[battle.data?.started_at,battle.data?.created_at]);

  useEffect(()=>{
    if(!user)return;
    const channel=supabase.channel("battle-result-"+id)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"battle_results",filter:"battle_id=eq."+id},payload=>{
        if(payload.new.user_id!==user.id){toast.info("Opponent submitted their match result", {description:"Review the result and accept it or submit your objection."});void qc.invalidateQueries({queryKey:["battle-results",id]});void qc.invalidateQueries({queryKey:["battle",id]});}
      }).subscribe();
    return()=>{void supabase.removeChannel(channel);};
  },[id,user?.id,qc]);

  const saveCode=useMutation({mutationFn:async()=>{const {error}=await supabase.rpc("set_room_code",{p_battle:id,p_code:code});if(error)throw error;},onSuccess:()=>{toast.success("Room code shared");qc.invalidateQueries({queryKey:["battle",id]});},onError:(e:Error)=>toast.error(e.message)});

  const submit=useMutation({mutationFn:async({claim,shot}:{claim:"won"|"lost"|"cancel";shot?:string})=>{const {data,error}=await supabase.rpc("submit_battle_result",{p_battle:id,p_claim:claim,p_screenshot:shot??""});if(error)throw error;return data as string;},onSuccess:(state)=>{qc.invalidateQueries();toast.success(({result_pending:"Result submitted. Your opponent has 15 minutes to accept or object.",completed:"Match completed — virtual credits updated.",cancelled:"Match cancelled — virtual credits refunded.",disputed:"Objection recorded. The match is now under admin review."} as Record<string,string>)[state]??"Result submitted");},onError:(e:Error)=>toast.error(e.message)});

  const accept=useMutation({mutationFn:async()=>{const {data,error}=await supabase.rpc("accept_battle_result",{p_battle:id});if(error)throw error;return data;},onSuccess:()=>{qc.invalidateQueries();toast.success("Result accepted. Match settled.");},onError:(e:Error)=>toast.error(e.message)});

  const object=useMutation({mutationFn:async()=>{const {data,error}=await supabase.rpc("submit_battle_objection",{p_battle:id,p_concern:objection,p_proof:objectionProof||""});if(error)throw error;return data;},onSuccess:()=>{qc.invalidateQueries();setObjection("");setObjectionProof("");toast.success("Objection submitted to admin.");},onError:(e:Error)=>toast.error(e.message)});

  const uploadResult=async(file:File)=>{if(!user)return;setUploading(true);try{const path=user.id+"/"+id+"-result-"+Date.now()+"."+file.name.split(".").pop();const {error}=await supabase.storage.from("result-screenshots").upload(path,file);if(error)throw error;await submit.mutateAsync({claim:"won",shot:path});}catch(e){toast.error(e instanceof Error?e.message:"Upload failed");}finally{setUploading(false);}};

  const uploadObjection=async(file:File)=>{if(!user)return;try{const path=user.id+"/"+id+"-objection-"+Date.now()+"."+file.name.split(".").pop();const {error}=await supabase.storage.from("result-screenshots").upload(path,file);if(error)throw error;setObjectionProof(path);toast.success("Objection proof attached");}catch(e){toast.error(e instanceof Error?e.message:"Upload failed");}};

  const sendComplaint=useMutation({mutationFn:async()=>{const {data,error}=await supabase.from("match_complaints").insert({battle_id:id,user_id:user!.id,concern:complaint,proof_url:complaintProof||null}).select("id").single();if(error)throw error;return data;},onSuccess:()=>{setComplaint("");setComplaintProof("");toast.success("Complaint sent to admin");},onError:(e:Error)=>toast.error(e.message)});

  const uploadComplaint=async(file:File)=>{if(!user)return;setComplaintUploading(true);try{const path=user.id+"/"+id+"-complaint-"+Date.now()+"."+file.name.split(".").pop();const {error}=await supabase.storage.from("result-screenshots").upload(path,file);if(error)throw error;setComplaintProof(path);toast.success("Complaint proof attached");}catch(e){toast.error(e instanceof Error?e.message:"Upload failed");}finally{setComplaintUploading(false);}};

  const b=battle.data;
  if(battle.isLoading)return <AppShell><Loader2 className="mx-auto mt-20 h-6 w-6 animate-spin text-primary"/></AppShell>;
  if(!b)return <AppShell><p className="mt-20 text-center text-muted-foreground">Battle not found.</p></AppShell>;

  const isPlayer=b.creator_id===user?.id||b.opponent_id===user?.id;
  const responseDeadline=b.opponent_result_deadline_at?new Date(b.opponent_result_deadline_at).getTime():null;
  const objectionDeadline=b.objection_deadline_at?new Date(b.objection_deadline_at).getTime():null;
  const now=Date.now();
  const responseLeft=responseDeadline?Math.max(0,Math.ceil((responseDeadline-now)/1000)):null;
  const objectionLeft=objectionDeadline?Math.max(0,Math.ceil((objectionDeadline-now)/1000)):null;
  const fmt=(s:number|null)=>s===null?"--:--":String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0");
  const mm=String(Math.floor(elapsed/60)).padStart(2,"0"),ss=String(elapsed%60).padStart(2,"0");
  const isOpponentToFirstResult=!!opponentResult===false && !!myResult===false; // UI below uses actual first-result owner
  const firstResult=results.data?.[0];
  const canRespond=!!isPlayer&&b.status==="result_pending"&&!!opponentResult&&!myResult;
  const complaintAllowed=b.status==="completed"||b.status==="disputed"||b.status==="cancelled";

  return <AppShell>
    <div className="glow-gold rounded-2xl bg-card p-5 text-center">
      <Badge variant="secondary" className="mb-2">{gameName(b.game)}</Badge>
      <p className="font-display text-3xl font-bold gold-text">{rupees(b.prize)} Credits</p>
      <p className="text-xs text-muted-foreground">Virtual reward · Entry {rupees(b.amount)} Credits</p>
      <div className="mt-4 flex items-center justify-center gap-3 text-sm"><span className="font-semibold">{players.data?.[b.creator_id]??"Player 1"}</span><span className="gold-text font-bold">VS</span><span className="font-semibold">{b.opponent_id?(players.data?.[b.opponent_id]??"Player 2"):"Waiting…"}</span></div>
      <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground"><Timer className="h-4 w-4"/>{mm}:{ss} · {statusLabel(b.status)}</div>
    </div>

    {b.status==="result_pending"&&firstResult&&!myResult&&<div className="mt-4 rounded-2xl border border-primary/40 bg-primary/5 p-4">
      <p className="font-display font-bold">Opponent result submitted</p>
      <p className="mt-1 text-sm">Claim: <span className="font-semibold">{firstResult.claim}</span></p>
      {responseLeft!==null&&<p className="mt-2 font-display text-2xl font-bold">{fmt(responseLeft)}</p>}
      <p className="text-xs text-muted-foreground">Accept window: 15 minutes. Objection window: 5 minutes from the opponent's submission.</p>
      <div className="mt-3 flex gap-2"><Button className="flex-1" onClick={()=>accept.mutate()} disabled={accept.isPending||responseLeft===0}><CheckIcon/>Accept result</Button><Button variant="destructive" className="flex-1" onClick={()=>objectionFile.current?.click()} disabled={objectionLeft===0}>Object</Button></div>
      <input ref={objectionFile} type="file" accept="image/*" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)void uploadObjection(f)}}/>
      {objectionProof&&<p className="mt-2 text-xs text-success">Proof attached.</p>}{objectionLeft!==null&&<p className="mt-1 text-[11px] text-muted-foreground">Objection timer: {fmt(objectionLeft)}</p>}
      <textarea value={objection} onChange={e=>setObjection(e.target.value)} placeholder="Write your concern..." className="mt-3 min-h-20 w-full rounded-xl border border-border bg-background p-3 text-sm"/>
      <Button className="mt-2 w-full" onClick={()=>object.mutate()} disabled={object.isPending||objection.trim().length<3||responseLeft===0}>Submit objection</Button>
      <p className="mt-2 text-[11px] text-muted-foreground">Proof upload is optional but recommended for an objection.</p>
    </div>}

    {isPlayer&&(b.status==="running"||b.status==="result_pending")&&!myResult&&<div className="mt-4 rounded-2xl border border-border/60 bg-card p-4">
      <p className="mb-1 font-display font-bold">Match Result</p><p className="mb-3 text-xs text-muted-foreground">Upload proof if you claim a win.</p>
      <div className="grid grid-cols-3 gap-2">
        <Button onClick={()=>resultFile.current?.click()} disabled={uploading||submit.isPending}><Upload className="h-4 w-4"/>{uploading?"Uploading":"I Won"}</Button>
        <Button variant="secondary" onClick={()=>submit.mutate({claim:"lost"})} disabled={submit.isPending}>I Lost</Button>
        <Button variant="outline" onClick={()=>submit.mutate({claim:"cancel"})} disabled={submit.isPending}>Cancel</Button>
      </div>
      <input ref={resultFile} type="file" accept="image/*" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)void uploadResult(f)}}/>
    </div>}

    {myResult&&b.status==="result_pending"&&<div className="mt-4 rounded-2xl border border-border/60 bg-card p-4"><p className="font-semibold">Your result: {myResult.claim}</p><p className="text-xs text-muted-foreground mt-1">Waiting for the opponent response.</p></div>}

    {b.status==="disputed"&&<div className="mt-4 rounded-2xl border border-destructive/40 bg-destructive/10 p-4"><p className="font-semibold text-destructive">Match under admin review</p><p className="mt-1 text-sm text-muted-foreground">The submitted objection/proof has been forwarded to the admin Complaint Center.</p></div>}

    {complaintAllowed&&isPlayer&&<div className="mt-4 rounded-2xl border border-border/60 bg-card p-4">
      <div className="flex items-center gap-2"><MessageSquareWarning className="h-5 w-5 text-primary"/><p className="font-display font-bold">Complaint about this match</p></div>
      <p className="mt-1 text-xs text-muted-foreground">Write your concern and optionally upload proof. It will appear in the admin Complaint Center.</p>
      <textarea value={complaint} onChange={e=>setComplaint(e.target.value)} placeholder="Describe your concern..." className="mt-3 min-h-24 w-full rounded-xl border border-border bg-background p-3 text-sm"/>
      <div className="mt-2 flex gap-2"><Button variant="outline" onClick={()=>complaintFile.current?.click()} disabled={complaintUploading}><Upload className="h-4 w-4"/>{complaintUploading?"Uploading":"Upload proof"}</Button>{complaintProof&&<span className="self-center text-xs text-success">Proof attached</span>}</div>
      <input ref={complaintFile} type="file" accept="image/*" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)void uploadComplaint(f)}}/>
      <Button className="mt-3 w-full" onClick={()=>sendComplaint.mutate()} disabled={sendComplaint.isPending||complaint.trim().length<3}>Send complaint</Button>
    </div>}

    <div className="mt-4 rounded-2xl border border-warning/40 bg-warning/10 p-4 text-xs text-muted-foreground"><p className="mb-1 flex items-center gap-2 font-semibold text-warning"><AlertTriangle className="h-4 w-4"/>Result verification</p>When the first player submits a result, the opponent gets a 15-minute response window. An objection opens admin review.</div>
    <Button variant="ghost" className="mt-4 w-full" onClick={()=>navigate({to:"/battles"})}>Back to lobby</Button>
  </AppShell>;
}

function CheckIcon(){return <span className="mr-1">✓</span>}
