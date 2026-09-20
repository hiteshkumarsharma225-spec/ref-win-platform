import { AppShell } from "@/components/AppShell";
import { useProfile } from "@/hooks/use-profile";
import { ShieldCheck } from "lucide-react";

export default function KycPage() {
  const { profile, loading } = useProfile();
  const status = profile?.kyc_status || "pending";
  return <AppShell><div className="space-y-4 pb-24">
    <h1 className="text-xl font-bold">KYC Status</h1>
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div className="mb-3 flex items-center gap-3"><ShieldCheck className="text-emerald-300" /><span className="font-semibold">Verification</span></div>
      <div className="rounded-xl bg-black/20 p-4"><p className="text-sm text-white/50">Current status</p><p className="mt-1 text-lg font-bold capitalize">{loading ? "Loading..." : status}</p></div>
      <p className="mt-4 text-sm leading-6 text-white/55">This screen shows the verification status stored on your account. Verification decisions are handled by the platform administrator.</p>
    </div>
  </div></AppShell>;
}