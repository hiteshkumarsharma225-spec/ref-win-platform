import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDownToLine, ArrowUpFromLine, Loader2, Receipt, QrCode, Copy } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { DEPOSIT_AMOUNTS, MIN_WITHDRAWAL, rupees } from "@/lib/game";
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
        p_utr: `DEMO-CREDIT-${Date.now()}`,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setUtr("");
      qc.invalidateQueries();
      toast.success("Deposit request submitted", {
        description: "An admin will review your demo-credit request and add virtual credits after approval.",
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const withdraw = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("request_withdrawal", {
        p_amount: wdAmount,
        p_method: method,
        p_upi: method === "upi" ? upi : "",
        p_name: method === "bank" ? accName : "",
        p_account: method === "bank" ? accNo : "",
        p_ifsc: method === "bank" ? ifsc : "",
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
          <Bucket label="Deposit" value={wallet?.deposit_cash ?? 0} />
          <Bucket label="Winnings" value={wallet?.winning_cash ?? 0} />
          <Bucket label="Bonus" value={wallet?.bonus_cash ?? 0} />
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

          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-primary" />
              <p className="font-display font-bold">Demo QR Credit Screen</p>
            </div>
            <div className="mt-3 rounded-xl border border-border/60 bg-background p-4 text-center">
              <div className="mx-auto grid h-36 w-36 grid-cols-8 gap-1 rounded-lg bg-white p-3">
                {Array.from({ length: 64 }, (_, i) => (
                  <span key={i} className={((i * 17 + 7) % 5 < 2 || i % 9 === 0) ? "rounded-sm bg-foreground" : "rounded-sm bg-transparent"} />
                ))}
              </div>
              <p className="mt-3 text-sm font-semibold">DEMO-CREDIT · {depositAmount}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Visual-only QR. It does not initiate a payment or transfer money.
              </p>
            </div>
            <button
              type="button"
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card py-2 text-sm font-semibold"
              onClick={() => {
                void navigator.clipboard.writeText("DEMO-CREDIT-" + depositAmount);
                toast.success("Demo credit code copied");
              }}
            >
              <Copy className="h-4 w-4" /> Copy demo code
            </button>
            <div className="mt-3 text-sm">
              <p className="font-display font-bold">Request virtual demo credits</p>
              <p className="mt-1 text-xs text-muted-foreground">
                This is a demo wallet. No real payment is required and no money is transferred.
                Submit the amount you want credited; an admin will approve or reject the request.
              </p>
            </div>
          </div>

          <Button
            className="w-full"
            size="lg"
            onClick={() => deposit.mutate()}
            disabled={deposit.isPending || depositAmount < 10}
          >
            {deposit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Submit deposit
          </Button>

          <RequestList
            title="Recent demo-credit requests"
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
