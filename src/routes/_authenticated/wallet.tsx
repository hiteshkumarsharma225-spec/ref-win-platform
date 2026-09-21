import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDownToLine, ArrowUpFromLine, Loader2, Receipt, QrCode, Copy } from "lucide-react";
import QRCode from "qrcode";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { DEPOSIT_AMOUNTS, rupees } from "@/lib/game";
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
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [method, setMethod] = useState<"upi" | "bank">("upi");

  const paymentSettings = useQuery({
    queryKey: ["payment-settings"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_settings")
        .select("merchant_upi,merchant_name,currency")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const creditRequests = useQuery({
    queryKey: ["credit-payment-requests", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_payment_requests")
        .select("id,amount,utr,status,created_at,processed_at,admin_note")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    let cancelled = false;
    const upi = paymentSettings.data?.merchant_upi;
    if (!upi || depositAmount <= 0) {
      setQrDataUrl("");
      return;
    }

    const params = new URLSearchParams({
      pa: upi,
      pn: paymentSettings.data?.merchant_name ?? "Maja Muqablo",
      am: depositAmount.toFixed(2),
      cu: paymentSettings.data?.currency ?? "INR",
      tn: `Virtual Credits ${depositAmount}`,
    });

    QRCode.toDataURL(`upi://pay?${params.toString()}`, {
      width: 320,
      margin: 2,
      errorCorrectionLevel: "M",
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl("");
      });

    return () => {
      cancelled = true;
    };
  }, [paymentSettings.data, depositAmount]);

  const submitCreditRequest = useMutation({
    mutationFn: async () => {
      if (!paymentSettings.data?.merchant_upi) {
        throw new Error("Payment settings are not configured.");
      }
      const cleanUtr = utr.trim();
      if (cleanUtr.length < 6) {
        throw new Error("Please enter the UTR / transaction reference.");
      }

      const { error } = await supabase.from("credit_payment_requests").insert({
        user_id: user!.id,
        amount: depositAmount,
        utr: cleanUtr,
        merchant_upi: paymentSettings.data.merchant_upi,
        qr_reference: `upi://pay?pa=${encodeURIComponent(paymentSettings.data.merchant_upi)}&am=${depositAmount.toFixed(2)}&cu=INR`,
        payment_note: "Payment made for non-cashable virtual credits.",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setUtr("");
      qc.invalidateQueries({ queryKey: ["credit-payment-requests", user?.id] });
      toast.success("Payment reference submitted", {
        description: "Admin will verify the UTR before adding virtual credits.",
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell>
      <div className="glow-gold rounded-2xl bg-card p-5">
        <p className="text-xs text-muted-foreground">Virtual credit balance</p>
        <p className="font-display text-3xl font-bold gold-text">{rupees(wallet?.bonus_cash ?? walletTotal(wallet))}</p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Bucket label="Deposit" value={wallet?.deposit_cash ?? 0} />
          <Bucket label="Winnings" value={wallet?.winning_cash ?? 0} />
          <Bucket label="Credits" value={wallet?.bonus_cash ?? 0} />
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
            <ArrowDownToLine className="mr-1 h-4 w-4" /> Add Credits
          </TabsTrigger>
          <TabsTrigger value="withdraw">
            <ArrowUpFromLine className="mr-1 h-4 w-4" /> Wallet
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
            value={depositAmount || ""}
            onChange={(e) => setDepositAmount(Number(e.target.value.replace(/\D/g, "")) || 0)}
            placeholder="Enter amount"
          />

          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-primary" />
              <p className="font-display font-bold">Pay by UPI</p>
            </div>

            {paymentSettings.isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : paymentSettings.data?.merchant_upi && qrDataUrl ? (
              <>
                <div className="mt-3 rounded-xl border border-border/60 bg-white p-4 text-center">
                  <img src={qrDataUrl} alt="UPI payment QR code" className="mx-auto h-64 w-64 max-w-full" />
                  <p className="mt-3 text-sm font-semibold">Pay {rupees(depositAmount)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{paymentSettings.data.merchant_upi}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    This payment is for non-cashable virtual credits only.
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="mt-3 w-full"
                  onClick={() => {
                    void navigator.clipboard.writeText(paymentSettings.data!.merchant_upi);
                    toast.success("UPI ID copied");
                  }}
                >
                  <Copy className="h-4 w-4" /> Copy UPI ID
                </Button>
              </>
            ) : (
              <div className="mt-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
                Payment settings are not configured.
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="utr">UTR / Transaction Reference</Label>
            <Input
              id="utr"
              value={utr}
              onChange={(e) => setUtr(e.target.value.replace(/\s/g, ""))}
              placeholder="Enter UTR after successful payment"
              autoCapitalize="characters"
            />
            <p className="text-xs text-muted-foreground">
              Submit the UTR only after your payment is completed. Admin verification is required.
            </p>
          </div>

          <Button
            className="w-full"
            size="lg"
            onClick={() => submitCreditRequest.mutate()}
            disabled={submitCreditRequest.isPending || depositAmount < 1 || !paymentSettings.data?.merchant_upi || utr.trim().length < 6}
          >
            {submitCreditRequest.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Submit UTR for verification
          </Button>

          <div className="rounded-xl border border-border/60 bg-card p-3 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">How it works</p>
            <p className="mt-1">1. Select amount → 2. Pay using the QR → 3. Enter UTR → 4. Admin verifies → 5. Virtual credits are added.</p>
            <p className="mt-1">These credits are non-cashable and cannot be withdrawn as money.</p>
          </div>

          <RequestList
            title="Recent payment requests"
            rows={creditRequests.data ?? []}
          />
        </TabsContent>

        <TabsContent value="withdraw" className="space-y-4 pt-4">
          <div className="rounded-2xl border border-border/60 bg-card p-5">
            <p className="font-display font-bold">Virtual wallet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Your credits can be used inside the supported virtual-credit experience. Cash withdrawal and payout features are not available here.
            </p>
            <div className="mt-4 rounded-xl bg-secondary/60 p-4">
              <p className="text-xs text-muted-foreground">Current virtual credits</p>
              <p className="font-display text-2xl font-bold">{rupees(wallet?.bonus_cash ?? 0)}</p>
            </div>
          </div>
          <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">
            No cash withdrawal is available for these virtual credits.
          </div>
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
  rows: { id: string; amount: number | string; utr: string; status: string; created_at: string }[];
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
              <p className="font-semibold">{rupees(r.amount)} · UTR {r.utr}</p>
              <p className="text-[11px] text-muted-foreground">
                {new Date(r.created_at).toLocaleString("en-IN")}
              </p>
            </div>
            <Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}>
              {r.status}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
