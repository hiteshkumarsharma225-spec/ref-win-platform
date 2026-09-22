import { useState } from "react";
import type { ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Coins, Eye, Loader2, MinusCircle, PlusCircle, Search, ShieldAlert, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin, useUser } from "@/lib/account";

export const Route = createFileRoute("/_authenticated/admin")({ component: AdminPage });

type Tab = "overview" | "matches" | "complaints" | "deposits" | "withdrawals" | "kyc" | "users";

function AdminPage() {
  const { user } = useUser();
  const { data: isAdmin, isLoading: roleLoading } = useIsAdmin(user?.id);
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("overview");
  const [userSearch, setUserSearch] = useState("");
  const [adjustAmount, setAdjustAmount] = useState(100);
  const [adminNote, setAdminNote] = useState<Record<string,string>>({});

  const enabled = !!user && !!isAdmin;

  const matches = useQuery({
    queryKey: ["admin-all-matches"], enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from("battles").select("id,game,amount,prize,creator_id,opponent_id,status,winner_id,created_at,settled_at").order("created_at",{ascending:false}).limit(200);
      if (error) throw error; return data ?? [];
    }, refetchInterval: 5000,
  });

  const complaints = useQuery({
    queryKey: ["admin-complaints"], enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from("match_complaints").select("*").order("created_at",{ascending:false}).limit(200);
      if (error) throw error;
      const ids=[...new Set((data??[]).map(x=>x.user_id))];
      const { data: profiles }=ids.length ? await supabase.from("profiles").select("id,username,phone").in("id",ids) : {data:[]};
      const map=new Map((profiles??[]).map(p=>[p.id,p]));
      return (data??[]).map(x=>({...x,profile:map.get(x.user_id)}));
    }, refetchInterval: 5000,
  });

  const deposits = useQuery({
    queryKey: ["admin-payment-requests"], enabled,
    queryFn: async () => {
      const { data,error }=await supabase.from("credit_payment_requests").select("id,user_id,amount,utr,status,merchant_upi,created_at,processed_at,admin_note").order("created_at",{ascending:false}).limit(200);
      if(error) throw error;
      const ids=[...new Set((data??[]).map(x=>x.user_id))];
      const {data:profiles}=ids.length?await supabase.from("profiles").select("id,username,phone").in("id",ids):{data:[]};
      const map=new Map((profiles??[]).map(p=>[p.id,p]));
      return (data??[]).map(x=>({...x,profile:map.get(x.user_id)}));
    }, refetchInterval:5000,
  });

  const withdrawals = useQuery({
    queryKey: ["admin-credit-withdrawals"], enabled,
    queryFn: async () => {
      const {data,error}=await supabase.from("virtual_credit_withdrawals").select("*").order("created_at",{ascending:false}).limit(200);
      if(error) throw error;
      const ids=[...new Set((data??[]).map(x=>x.user_id))];
      const {data:profiles}=ids.length?await supabase.from("profiles").select("id,username,phone").in("id",ids):{data:[]};
      const map=new Map((profiles??[]).map(p=>[p.id,p]));
      return (data??[]).map(x=>({...x,profile:map.get(x.user_id)}));
    }, refetchInterval:5000,
  });

  const kyc = useQuery({
    queryKey:["admin-kyc"],enabled,
    queryFn:async()=>{const {data,error}=await supabase.from("kyc_submissions").select("*").order("created_at",{ascending:false}).limit(200);if(error)throw error;return data??[];},
    refetchInterval:5000,
  });

  const reviewKyc=useMutation({
    mutationFn:async({id,status}:{id:string,status:"approved"|"rejected"})=>{const {error}=await supabase.rpc("admin_review_kyc",{p_id:id,p_status:status,p_note:status==="approved"?"KYC approved by admin.":"KYC rejected by admin."});if(error)throw error;},
    onSuccess:()=>{qc.invalidateQueries({queryKey:["admin-kyc"]});toast.success("KYC updated");},onError:(e:Error)=>toast.error(e.message)
  });

  const resolve=useMutation({
    mutationFn:async({battleId,winnerId}:{battleId:string,winnerId:string})=>{const {error}=await supabase.rpc("admin_resolve_demo_battle",{p_battle:battleId,p_winner:winnerId});if(error)throw error;},
    onSuccess:()=>{qc.invalidateQueries({queryKey:["admin-all-matches"]});toast.success("Match settled");},onError:(e:Error)=>toast.error(e.message)
  });

  const complaintUpdate=useMutation({
    mutationFn:async({id,status}:{id:string,status:"under_review"|"resolved"|"rejected"})=>{
      const {error}=await supabase.from("match_complaints").update({status,admin_note:adminNote[id]||null,resolved_at:status==="resolved"||status==="rejected"?new Date().toISOString():null,resolved_by:status==="resolved"||status==="rejected"?user?.id:null}).eq("id",id);
      if(error)throw error;
    },
    onSuccess:()=>{qc.invalidateQueries({queryKey:["admin-complaints"]});toast.success("Complaint updated");},onError:(e:Error)=>toast.error(e.message)
  });

  const approvePayment=useMutation({
    mutationFn:async(r:{id:string,user_id:string,amount:number})=>{
      const {error:e1}=await supabase.rpc("admin_adjust_demo_credits",{p_user:r.user_id,p_delta:r.amount,p_note:"UPI payment verified by admin"});if(e1)throw e1;
      const {error:e2}=await supabase.from("credit_payment_requests").update({status:"approved",processed_at:new Date().toISOString(),processed_by:user!.id,admin_note:"UTR verified; virtual credits added."}).eq("id",r.id).eq("status","pending");if(e2)throw e2;
    },onSuccess:()=>{qc.invalidateQueries({queryKey:["admin-payment-requests"]});toast.success("Payment approved");},onError:(e:Error)=>toast.error(e.message)
  });
  const rejectPayment=useMutation({
    mutationFn:async(id:string)=>{const {error}=await supabase.from("credit_payment_requests").update({status:"rejected",processed_at:new Date().toISOString(),processed_by:user!.id,admin_note:"Rejected by admin"}).eq("id",id).eq("status","pending");if(error)throw error;},
    onSuccess:()=>{qc.invalidateQueries({queryKey:["admin-payment-requests"]});toast.success("Payment rejected");},onError:(e:Error)=>toast.error(e.message)
  });
  const adminUsers=useQuery({
    queryKey:["admin-wallet-users",userSearch],enabled:enabled&&userSearch.trim().length>=2,
    queryFn:async()=>{const q=userSearch.trim();const {data,error}=await supabase.from("profiles").select("id,username,phone").or("username.ilike.%"+q+"%,phone.ilike.%"+q+"%").limit(20);if(error)throw error;const ids=(data??[]).map(x=>x.id);const {data:wallets}=ids.length?await supabase.from("wallets").select("user_id,bonus_cash").in("user_id",ids):{data:[]};const map=new Map((wallets??[]).map(x=>[x.user_id,x]));return (data??[]).map(x=>({...x,wallet:map.get(x.id)}));}
  });
  const adjust=useMutation({
    mutationFn:async({userId,delta}:{userId:string,delta:number})=>{const {error}=await supabase.rpc("admin_adjust_demo_credits",{p_user:userId,p_delta:delta,p_note:"Admin virtual-credit adjustment"});if(error)throw error;},
    onSuccess:()=>{qc.invalidateQueries({queryKey:["admin-wallet-users"]});toast.success("Credits updated");},onError:(e:Error)=>toast.error(e.message)
  });

  if(roleLoading)return <AppShell title="Admin Dashboard"><Loader2 className="mx-auto mt-20 h-6 w-6 animate-spin"/></AppShell>;
  if(!isAdmin)return <AppShell title="Admin Dashboard"><div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-5"><ShieldAlert className="mb-2 h-6 w-6 text-destructive"/><h1 className="font-bold">Admin access required</h1><Link to="/profile" className="mt-4 inline-block underline">Back to profile</Link></div></AppShell>;

  const pendingMatches=(matches.data??[]).filter(x=>x.status==="result_pending"||x.status==="disputed");
  const openComplaints=(complaints.data??[]).filter(x=>x.status==="open"||x.status==="under_review");
  const pendingDeposits=(deposits.data??[]).filter(x=>x.status==="pending");
  const pendingWithdrawals=(withdrawals.data??[]).filter(x=>x.status==="pending"||x.status==="processed");

  const tabs:[Tab,string][]=[["overview","Overview"],["matches","Matches"],["complaints","Complaints"],["deposits","Deposits"],["withdrawals","Withdrawals"],["kyc","KYC"],["users","Users"]];

  return <AppShell title="Admin Dashboard">
    <div className="rounded-2xl border border-border/60 bg-card p-4">
      <div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">CONTROL CENTER</p><h1 className="font-display text-xl font-bold">REAL LUDO PLAYER</h1></div><Badge>ADMIN</Badge></div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Matches" value={matches.data?.length??0}/><Stat label="Open reviews" value={pendingMatches.length}/><Stat label="Complaints" value={openComplaints.length}/><Stat label="Pending deposits" value={pendingDeposits.length}/>
      </div>
    </div>

    <div className="mt-4 flex gap-2 overflow-x-auto pb-1">{tabs.map(([id,label])=><button key={id} onClick={()=>setTab(id)} className={"shrink-0 rounded-full border px-3 py-2 text-xs font-semibold "+(tab===id?"border-primary bg-primary text-primary-foreground":"border-border bg-card text-muted-foreground")}>{label}</button>)}</div>

    {tab==="overview"&&<div className="mt-4 grid gap-3 sm:grid-cols-2">
      <Panel title="Match operations" text={pendingMatches.length+" matches need review."} onClick={()=>setTab("matches")}/>
      <Panel title="Complaint center" text={openComplaints.length+" complaints awaiting action."} onClick={()=>setTab("complaints")}/>
      <Panel title="Deposit ledger" text={(deposits.data?.length ?? 0)+" payment records."} onClick={()=>setTab("deposits")}/>
      <Panel title="Withdrawal ledger" text={(withdrawals.data?.length ?? 0)+" records."} onClick={()=>setTab("withdrawals")}/>
      <Panel title="KYC center" text={kyc.data?.length??0+" submissions."} onClick={()=>setTab("kyc")}/>
      <Panel title="Player management" text="Search and adjust virtual credits." onClick={()=>setTab("users")}/>
    </div>}

    {tab==="matches"&&<Section title="Match history & reviews" subtitle="All past matches plus result/dispute reviews.">{(matches.data??[]).map(m=><Card key={m.id}>
      <div className="flex items-center justify-between"><div><p className="font-semibold">{m.game}</p><p className="text-xs text-muted-foreground">#{m.id.slice(0,8)} · {new Date(m.created_at).toLocaleString("en-IN")}</p></div><Badge variant={m.status==="disputed"?"destructive":"secondary"}>{m.status}</Badge></div>
      <p className="mt-2 text-sm">Entry {Number(m.amount).toLocaleString("en-IN")} credits · Reward {Number(m.prize).toLocaleString("en-IN")} credits</p>
      {m.status==="disputed"||m.status==="result_pending"?<MatchReview battleId={m.id} onResolve={(winner)=>resolve.mutate({battleId:m.id,winnerId:winner})} busy={resolve.isPending}/>:null}
    </Card>)}{!(matches.data??[]).length&&<Empty text="No matches found."/>}</Section>}

    {tab==="complaints"&&<Section title="Complaint Center" subtitle="Player complaints and match objections with proof.">{(complaints.data??[]).map(c=><Card key={c.id}>
      <div className="flex justify-between gap-2"><div><p className="font-semibold">{c.profile?.username??"Player"}</p><p className="text-xs text-muted-foreground">Match #{c.battle_id.slice(0,8)} · {new Date(c.created_at).toLocaleString("en-IN")}</p></div><Badge variant={c.status==="open"?"destructive":"secondary"}>{c.status}</Badge></div>
      <p className="mt-3 whitespace-pre-wrap rounded-xl bg-secondary/50 p-3 text-sm">{c.concern}</p>
      <div className="mt-3 flex flex-wrap gap-2">{c.proof_url&&<Button size="sm" variant="outline" onClick={async()=>{const {data,error}=await supabase.storage.from("result-screenshots").createSignedUrl(String(c.proof_url),600);if(error)toast.error(error.message);else window.open(data.signedUrl,"_blank","noopener,noreferrer");}}><Eye className="h-4 w-4"/> View proof</Button>}</div>
      {c.status!=="resolved"&&c.status!=="rejected"?<><textarea value={adminNote[c.id]??""} onChange={e=>setAdminNote(x=>({...x,[c.id]:e.target.value}))} placeholder="Admin note (optional)" className="mt-3 min-h-20 w-full rounded-xl border border-border bg-background p-3 text-sm"/><div className="mt-2 grid grid-cols-3 gap-2"><Button size="sm" variant="outline" onClick={()=>complaintUpdate.mutate({id:c.id,status:"under_review"})}>Review</Button><Button size="sm" onClick={()=>complaintUpdate.mutate({id:c.id,status:"resolved"})}><Check className="h-4 w-4"/>Resolve</Button><Button size="sm" variant="destructive" onClick={()=>complaintUpdate.mutate({id:c.id,status:"rejected"})}><X className="h-4 w-4"/>Reject</Button></div></>:null}
    </Card>)}{!(complaints.data??[]).length&&<Empty text="No complaints yet."/>}</Section>}

    {tab==="deposits"&&<Section title="Deposit / Credit Payment Ledger" subtitle="Newest first. Pending UTRs require verification before virtual credits are added.">{(deposits.data??[]).map(d=><Card key={d.id}><div className="flex justify-between"><div><p className="font-semibold">{d.profile?.username??"Player"}</p><p className="text-xs text-muted-foreground">{d.profile?.phone??"—"} · {new Date(d.created_at).toLocaleString("en-IN")}</p></div><Badge variant={d.status==="approved"?"default":d.status==="rejected"?"destructive":"secondary"}>{d.status}</Badge></div><div className="mt-3 rounded-xl bg-secondary/50 p-3 text-sm"><p className="font-bold">{Number(d.amount).toLocaleString("en-IN")} credits</p><p className="text-xs text-muted-foreground">UTR: {d.utr}</p></div>{d.status==="pending"&&<div className="mt-2 grid grid-cols-2 gap-2"><Button onClick={()=>approvePayment.mutate({id:d.id,user_id:d.user_id,amount:Number(d.amount)})}> <Check className="h-4 w-4"/>Approve</Button><Button variant="outline" onClick={()=>rejectPayment.mutate(d.id)}><X className="h-4 w-4"/>Reject</Button></div>}</Card>)}{!(deposits.data??[]).length&&<Empty text="No deposits yet."/>}</Section>}

    {tab==="withdrawals"&&<Section title="Withdrawal Ledger" subtitle="Historical virtual-credit withdrawal records.">{(withdrawals.data??[]).map(w=><Card key={w.id}><div className="flex justify-between"><div><p className="font-semibold">{w.profile?.username??"Player"}</p><p className="text-xs text-muted-foreground">{new Date(w.created_at).toLocaleString("en-IN")}</p></div><Badge>{w.status}</Badge></div><p className="mt-2 font-display text-lg font-bold">{Number(w.amount).toLocaleString("en-IN")} credits</p><p className="mt-3 text-xs text-muted-foreground">Historical ledger only.</p></Card>)}{!(withdrawals.data??[]).length&&<Empty text="No withdrawals yet."/>}</Section>}

    {tab==="kyc"&&<Section title="KYC Verification" subtitle="Review submitted identity documents.">{(kyc.data??[]).map(k=><Card key={k.id}><div className="flex justify-between"><div><p className="font-semibold">{k.full_name}</p><p className="text-xs text-muted-foreground">{k.doc_type} · {k.doc_number}</p></div><Badge>{k.status}</Badge></div><div className="mt-3 flex flex-wrap gap-2">{[["Front",k.document_front_url],["Back",k.document_back_url],["PAN",k.pan_document_url]].filter(([,u])=>!!u).map(([label,url])=><Button key={label} size="sm" variant="outline" onClick={async()=>{const {data,error}=await supabase.storage.from("kyc-docs").createSignedUrl(String(url),600);if(error)toast.error(error.message);else window.open(data.signedUrl,"_blank","noopener,noreferrer");}}><Eye className="h-4 w-4"/>View {label}</Button>)}</div>{k.status==="pending"&&<div className="mt-3 grid grid-cols-2 gap-2"><Button onClick={()=>reviewKyc.mutate({id:k.id,status:"approved"})}>Approve</Button><Button variant="outline" onClick={()=>reviewKyc.mutate({id:k.id,status:"rejected"})}>Reject</Button></div>}</Card>)}{!(kyc.data??[]).length&&<Empty text="No KYC submissions."/>}</Section>}

    {tab==="users"&&<Section title="Player Management" subtitle="Search players and adjust virtual credits."><div className="flex gap-2"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground"/><input value={userSearch} onChange={e=>setUserSearch(e.target.value)} placeholder="Username or phone" className="h-10 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm"/></div><input inputMode="numeric" value={adjustAmount} onChange={e=>setAdjustAmount(Number(e.target.value.replace(/\D/g,""))||0)} className="h-10 w-24 rounded-lg border border-border bg-card px-3 text-sm"/></div>{(adminUsers.data??[]).map(u=><Card key={u.id}><div className="flex justify-between"><div><p className="font-semibold">{u.username}</p><p className="text-xs text-muted-foreground">{u.phone}</p></div><p className="font-bold">{Number(u.wallet?.bonus_cash??0).toLocaleString("en-IN")} credits</p></div><div className="mt-3 grid grid-cols-2 gap-2"><Button disabled={!adjustAmount||adjust.isPending} onClick={()=>adjust.mutate({userId:u.id,delta:adjustAmount})}><PlusCircle className="h-4 w-4"/>Add</Button><Button variant="outline" disabled={!adjustAmount||adjust.isPending} onClick={()=>adjust.mutate({userId:u.id,delta:-adjustAmount})}><MinusCircle className="h-4 w-4"/>Deduct</Button></div></Card>)}</Section>}
  </AppShell>;
}

function MatchReview({battleId,onResolve,busy}:{battleId:string;onResolve:(winner:string)=>void;busy:boolean}) {
 const results=useQuery({queryKey:["admin-match-results",battleId],queryFn:async()=>{const {data,error}=await supabase.from("battle_results").select("id,user_id,claim,screenshot_url,created_at").eq("battle_id",battleId).order("created_at");if(error)throw error;const ids=(data??[]).map(x=>x.user_id);const {data:p}=ids.length?await supabase.from("profiles").select("id,username").in("id",ids):{data:[]};const map=new Map((p??[]).map(x=>[x.id,x.username]));return (data??[]).map(x=>({...x,username:map.get(x.user_id)??"Player"}));}});
 return <div className="mt-3 space-y-2">{(results.data??[]).map(r=><div key={r.id} className="rounded-xl border border-border/60 bg-secondary/40 p-3"><div className="flex items-center justify-between"><span className="font-semibold">{r.username}</span><Badge>{r.claim}</Badge></div>{r.screenshot_url&&<Button size="sm" variant="outline" className="mt-2" onClick={async()=>{const {data,error}=await supabase.storage.from("result-screenshots").createSignedUrl(String(r.screenshot_url),600);if(error)toast.error(error.message);else window.open(data.signedUrl,"_blank","noopener,noreferrer");}}><Eye className="h-4 w-4"/>Proof</Button>}{r.claim==="won"&&<Button size="sm" className="ml-2 mt-2" disabled={busy} onClick={()=>onResolve(r.user_id)}><Check className="h-4 w-4"/>Approve winner</Button>}</div>)}</div>;
}
function Section({title,subtitle,children}:{title:string;subtitle:string;children:ReactNode}){return <section className="mt-4 space-y-3"><div><h2 className="font-display text-lg font-bold">{title}</h2><p className="text-xs text-muted-foreground">{subtitle}</p></div>{children}</section>}
function Card({children}:{children:React.ReactNode}){return <div className="rounded-2xl border border-border/60 bg-card p-4">{children}</div>}
function Empty({text}:{text:string}){return <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{text}</div>}
function Panel({title,text,onClick}:{title:string;text:string;onClick:()=>void}){return <button onClick={onClick} className="rounded-2xl border border-border/60 bg-card p-4 text-left transition hover:border-primary/50"><p className="font-semibold">{title}</p><p className="mt-1 text-xs text-muted-foreground">{text}</p></button>}
function Stat({label,value}:{label:string;value:number}){return <div className="rounded-xl border border-border/60 bg-background/40 p-3"><p className="text-[11px] text-muted-foreground">{label}</p><p className="mt-1 font-display text-xl font-bold">{value}</p></div>}
