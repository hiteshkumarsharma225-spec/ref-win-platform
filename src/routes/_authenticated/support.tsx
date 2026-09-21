import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle, Send } from "lucide-react";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/support")({
  component: SupportPage,
});

const FAQS: [string, string][] = [
  ["How do I report a problem?", "Open the battle in question and submit your result with a screenshot — a disputed match goes straight to our review team."],
  ["Why is my result under review?", "When two players claim different outcomes, an administrator checks the submitted evidence before settling the match."],
  ["When will my withdrawal arrive?", "Approved withdrawals are processed within 24 hours to your UPI ID or bank account."],
  ["How do I keep my account safe?", "Never share your password or OTP, and sign out on devices you do not control."],
];

function SupportPage() {
  return (
    <AppShell>
      <h1 className="mb-3 font-display text-xl font-bold">Help & support</h1>

      <div className="grid grid-cols-2 gap-2">
        <a
          href="https://wa.me/910000000000"
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-card p-4 text-sm font-semibold"
        >
          <MessageCircle className="h-4 w-4 text-primary" /> WhatsApp
        </a>
        <a
          href="https://t.me/funbattle"
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-card p-4 text-sm font-semibold"
        >
          <Send className="h-4 w-4 text-primary" /> Telegram
        </a>
      </div>

      <div className="mt-4 space-y-2">
        {FAQS.map(([q, a]) => (
          <div key={q} className="rounded-2xl border border-border/60 bg-card p-4">
            <h2 className="text-sm font-semibold">{q}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{a}</p>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
