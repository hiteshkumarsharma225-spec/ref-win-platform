import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDownToLine, ArrowUpFromLine, Copy, Loader2, Receipt } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { DEPOSIT_AMOUNTS, MIN_WITHDRAWAL, UPI_ID, rupees } from "@/lib/game";
import { useProfile, useUser, useWallet, walletTotal } from "@/lib/account";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/wallet")({
  component: WalletPage,
});

function WalletPage() {
  const { user } = useUser();
  const { data: wallet } = useWallet(user?.id);
  const { data: profile } = useProfile(user?.id);
  const qc = useQueryClient();

  const [depositAmount, setDepositAmount] = useState(100);
  const [utr, setUtr] = useState("");
  const [wdAmount, setWdAmount] = useState(MIN_WITHDRAWAL);
  const [method, setMethod] = useState<"upi" | "bank">("upi");
  const [upi, setUpi] = useState("");
  const [accName, setAccName] = useState("");
  const [accNo, setAccNo] = useState("");
  const [ifsc, setIfsc] = useState("");

  const requests = useQuery({
    queryKey: ["wallet-requests", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [dep, wd] = await Promise.all([
        supabase
          .from("deposit_requests")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(10),
        supabase.from("withdrawals").select("*").order("created_at", { ascending: false }).limit(10),
      ]);
      return { deposits: dep.data ?? [], withdrawals: wd.data ?? [] };
    },
  });

  const deposit = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("create_deposit_request", {
        p_amount: depositAmount,
        p_utr: utr,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setUtr("");
      qc.invalidateQueries();
      toast.success("Deposit request submitted", {
        description: "Money is added once our team confirms the payment.",
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const withdraw = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("request_withdrawal", {
        p_amount: wdAmount,
        p_method: method,
        p_upi: method === "upi" ? upi : null,
        p_name: method === "bank" ? accName : null,
        p_account: method === "bank" ? accNo : null,
        p_ifsc: method === "bank" ? ifsc : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success("Withdrawal requested", { description: "Payouts are processed within 24 hours." });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell>
      <div className="glow-gold rounded-2xl bg-card p-5">
        <p className="text-xs text-muted-foreground">Total balance</p>
        <p className="font-display text-3xl font-bold gold-text">{rupees(walletTotal(wallet))}</p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Bucket label="Deposit" value={wallet?.deposit_cash} />
          <Bucket label="Winnings" value={wallet?.winning_cash} />
          <Bucket label="Bonus" value={wallet?.bonus_cash} />
        </div>
      </div>

      <Link
        to="/transactions"
        className="mt-3 flex items-center gap-2 rounded-xl border border-border/60 bg-card p-3 text-sm"
      >
        <Receipt className="h-4 w-4 text-primary" /> Transaction history
      </Link>

      <Tabs defaultValue="add" className="mt-5">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="add">
            <ArrowDownToLine className="mr-1 h-4 w-4" /> Add Money
          </TabsTrigger>
          <TabsTrigger value="withdraw">
            <ArrowUpFromLine className="mr-1 h-4 w-4" /> Withdraw
          </TabsTrigger>
        </TabsList>

        <TabsContent value="add" className="space-y-4 pt-4">
          <div className="grid grid-cols-3 gap-2">
            {DEPOSIT_AMOUNTS.map((a) => (
              <button
                key={a}
                onClick={() => setDepositAmount(a)}
                className={cn(
                  "rounded-lg border py-2 text-sm font-semibold",
                  depositAmount === a
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
            value={depositAmount}
            onChange={(e) => setDepositAmount(Number(e.target.value.replace(/\D/g, "")) || 0)}
            placeholder="Enter amount"
          />

          <div className="rounded-xl border border-border/60 bg-card p-4 text-sm">
            <p className="mb-2 font-display font-bold">Pay via UPI</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md bg-secondary px-3 py-2 text-primary">{UPI_ID}</code>
              <Button
                size="icon"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(UPI_ID);
                  toast.success("UPI ID copied");
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <ol className="mt-3 list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
              <li>Send {rupees(depositAmount)} to the UPI ID above.</li>
              <li>Copy the 12-digit UTR / reference number from your payment app.</li>
              <li>Paste it below and submit — balance is credited after verification.</li>
            </ol>
          </div>

          <div className="space-y-2">
            <Label htmlFor="utr">UTR / Reference number</Label>
            <Input id="utr" value={utr} onChange={(e) => setUtr(e.target.value)} placeholder="e.g. 402512345678" />
          </div>

          <Button
            className="w-full"
            size="lg"
            onClick={() => deposit.mutate()}
            disabled={deposit.isPending || depositAmount < 10 || utr.length < 6}
          >
            {deposit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Submit deposit
          </Button>

          <RequestList
            title="Recent deposits"
            rows={(requests.data?.deposits ?? []).map((d) => ({
              id: d.id,
              amount: d.amount,
              status: d.status,
              created_at: d.created_at,
            }))}
          />
        </TabsContent>

        <TabsContent value="withdraw" className="space-y-4 pt-4">
          {profile?.kyc_status !== "approved" ? (
            <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">
              KYC verification is required before withdrawing.{" "}
              <Link to="/kyc" className="font-semibold text-warning underline">
                Complete KYC
              </Link>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>Amount (from winnings only)</Label>
            <Input
              inputMode="numeric"
              value={wdAmount}
              onChange={(e) => setWdAmount(Number(e.target.value.replace(/\D/g, "")) || 0)}
            />
            <p className="text-xs text-muted-foreground">
              Minimum {rupees(MIN_WITHDRAWAL)} · Available {rupees(wallet?.winning_cash ?? 0)}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {(["upi", "bank"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMethod(m)}
                className={cn(
                  "rounded-lg border py-2 text-sm font-semibold uppercase",
                  method === m ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card",
                )}
              >
                {m}
              </button>
            ))}
          </div>

          {method === "upi" ? (
            <div className="space-y-2">
              <Label htmlFor="upi">Your UPI ID</Label>
              <Input id="upi" value={upi} onChange={(e) => setUpi(e.target.value)} placeholder="name@bank" />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Account holder name</Label>
                <Input value={accName} onChange={(e) => setAccName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Account number</Label>
                <Input value={accNo} onChange={(e) => setAccNo(e.target.value)} inputMode="numeric" />
              </div>
              <div className="space-y-2">
                <Label>IFSC code</Label>
                <Input value={ifsc} onChange={(e) => setIfsc(e.target.value.toUpperCase())} />
              </div>
            </div>
          )}

          <Button
            className="w-full"
            size="lg"
            onClick={() => withdraw.mutate()}
            disabled={withdraw.isPending || wdAmount < MIN_WITHDRAWAL}
          >
            {withdraw.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Request withdrawal
          </Button>

          <RequestList
            title="Withdrawal status"
            rows={(requests.data?.withdrawals ?? []).map((d) => ({
              id: d.id,
              amount: d.amount,
              status: d.status,
              created_at: d.created_at,
            }))}
          />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function Bucket({ label, value }: { label: string; value?: number | string | null }) {
  return (
    <div className="rounded-xl bg-secondary/60 p-2">
      <p className="font-display text-sm font-bold">{rupees(value ?? 0)}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function RequestList({
  title,
  rows,
}: {
  title: string;
  rows: { id: string; amount: number | string; status: string; created_at: string }[];
}) {
  if (rows.length === 0) return null;
  return (
    <div className="pt-2">
      <p className="mb-2 text-sm font-semibold">{title}</p>
      <div className="space-y-2">
        {rows.map((r) => (
          <div
            key={r.id}
            className="flex items-center justify-between rounded-xl border border-border/60 bg-card px-3 py-2 text-sm"
          >
            <div>
              <p className="font-semibold">{rupees(r.amount)}</p>
              <p className="text-[11px] text-muted-foreground">
                {new Date(r.created_at).toLocaleString("en-IN")}
              </p>
            </div>
            <Badge
              variant={
                r.status === "completed" ? "default" : r.status === "rejected" ? "destructive" : "secondary"
              }
            >
              {r.status}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
