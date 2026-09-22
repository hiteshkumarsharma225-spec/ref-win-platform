import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, ShieldCheck, CheckCircle2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useUser } from "@/lib/account";

export const Route = createFileRoute("/_authenticated/kyc")({
  component: KycPage,
});

function KycPage() {
  const { user } = useUser();
  const { data: profile } = useProfile(user?.id);
  const qc = useQueryClient();

  const [docType, setDocType] = useState("aadhaar");
  const [fullName, setFullName] = useState("");
  const [docNumber, setDocNumber] = useState("");
  const [mobile, setMobile] = useState(profile?.phone ?? "");
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const submissions = useQuery({
    queryKey: ["kyc", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kyc_submissions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Please sign in again.");
      if (!fullName.trim()) throw new Error("Enter your full name as on the document.");
      if (!mobile.match(/^[6-9]\\d{9}$/)) throw new Error("Enter a valid 10-digit mobile number.");
      if (docType === "aadhaar" && (!/^\\d{12}$/.test(docNumber.replace(/\\D/g, "")) || !frontFile || !backFile)) throw new Error("Aadhaar number and front/back photos are required.");

      let docUrl: string | null = null;
      if (file) {
        const path = `${user.id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "")}`;
        const { error: upErr } = await supabase.storage.from("kyc-docs").upload(path, file);
        if (upErr) throw upErr;
        docUrl = path;
      }

      const { error } = await supabase.from("kyc_submissions").insert({
        user_id: user.id,
        doc_type: docType,
        doc_number: docNumber.trim(),
        full_name: fullName.trim(),
        doc_url: docUrl,
        mobile_number: mobile,
        document_front_url: docUrl,
        document_back_url: backFile ? backFile.name : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setDocNumber("");
      setFrontFile(null); setBackFile(null);
      qc.invalidateQueries();
      toast.success("KYC submitted", { description: "We review documents within 24 hours." });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const status = profile?.kyc_status ?? "not_submitted";

  return (
    <AppShell>
      <h1 className="mb-3 font-display text-xl font-bold">KYC verification</h1>

      <div className="glow-gold rounded-2xl bg-card p-5">
        <div className="flex items-center gap-3">
          {status === "approved" ? <CheckCircle2 className="h-6 w-6 text-success" /> : <ShieldCheck className="h-6 w-6 text-primary" />}
          <div>
            <p className="text-xs text-muted-foreground">Current status</p>
            <p className="font-display text-lg font-bold capitalize">{status.replace("_", " ")}</p>
          </div>
        </div>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Verification is required before you can withdraw winnings. Submit an Aadhaar or PAN document
          matching your account details.
        </p>
      </div>

      {status !== "approved" ? (
        <div className="mt-5 space-y-4 rounded-2xl border border-border/60 bg-card p-5">
          <Tabs value={docType} onValueChange={setDocType}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="aadhaar">Aadhaar</TabsTrigger>
              <TabsTrigger value="pan">PAN</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="space-y-2">
            <Label htmlFor="kyc-name">Full name (as on document)</Label>
            <Input id="kyc-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="kyc-number">{docType === "pan" ? "PAN number" : "Aadhaar number"}</Label>
            <Input
              id="kyc-number"
              value={docNumber}
              onChange={(e) => setDocNumber(e.target.value.toUpperCase())}
              placeholder={docType === "pan" ? "ABCDE1234F" : "1234 5678 9012"}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="kyc-file">Aadhaar front photo</Label>
            <Input
              id="kyc-file"
              type="file"
              accept="image/*"
              onChange={(e) => setFrontFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <Button className="w-full" disabled={submit.isPending} onClick={() => submit.mutate()}>
            {submit.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Submit for verification
          </Button>
        </div>
      ) : null}

      <h2 className="mb-2 mt-6 font-display text-sm font-semibold text-muted-foreground">
        Submission history
      </h2>
      <div className="space-y-2">
        {(submissions.data ?? []).map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between rounded-xl border border-border/60 bg-card p-4"
          >
            <div>
              <p className="text-sm font-semibold uppercase">{s.doc_type}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(s.created_at).toLocaleString("en-IN")}
              </p>
            </div>
            <Badge variant="secondary" className="capitalize">
              {s.status.replace("_", " ")}
            </Badge>
          </div>
        ))}
        {submissions.data && submissions.data.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
            No documents submitted yet.
          </p>
        ) : null}
      </div>
    </AppShell>
  );
}
