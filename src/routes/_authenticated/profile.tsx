import { Link } from "@tanstack/react-router";
import { User, ShieldCheck, BookOpen, HelpCircle, LogOut } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useProfile } from "@/hooks/use-profile";

export default function ProfilePage() {
  const { profile, loading } = useProfile();

  return (
    <AppShell>
      <div className="space-y-4 pb-24">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-amber-400/15 text-amber-300">
              <User size={28} />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold">{loading ? "Loading..." : profile?.username || "Player"}</h1>
              <p className="truncate text-sm text-white/50">{profile?.email || "Account"}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-2">
          <Link to="/kyc" className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <ShieldCheck className="text-emerald-300" size={20} /><span>KYC Status</span>
          </Link>
          <Link to="/rules" className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <BookOpen className="text-amber-300" size={20} /><span>Rules & Fair Play</span>
          </Link>
          <Link to="/support" className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <HelpCircle className="text-sky-300" size={20} /><span>Help & Support</span>
          </Link>
        </div>

        <button
          onClick={() => window.location.assign("/auth")}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-red-200"
        >
          <LogOut size={18} /> Sign out
        </button>
      </div>
    </AppShell>
  );
}