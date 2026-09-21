import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/rules")({
  component: RulesPage,
});

const RULES = [
  "Use only one account and never share your login details with anyone.",
  "Bots, automation, collusion and edited results lead to a permanent ban.",
  "Submit a result only after the match has actually finished.",
  "Keep your winning screenshot — it is required to claim a win.",
  "A wrong result claim can cost you a penalty deducted from your wallet.",
  "Room codes must be shared within 5 minutes or the match is cancelled.",
];

const TERMS = [
  "Entry fees are deducted the moment a battle is created or accepted.",
  "Winnings are credited after both players submit matching results.",
  "Disputed matches are reviewed manually and settled by an administrator.",
  "Withdrawals require approved KYC and a minimum balance of ₹100.",
  "This platform is for skill-based gaming only and is void where prohibited.",
];

function RulesPage() {
  return (
    <AppShell>
      <h1 className="mb-3 font-display text-xl font-bold">Rules & fair play</h1>

      <div className="rounded-2xl border border-border/60 bg-card p-5">
        <ul className="space-y-4">
          {RULES.map((r, i) => (
            <li key={r} className="flex gap-3 text-sm leading-6 text-muted-foreground">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                {i + 1}
              </span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 flex gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4">
        <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
        <p className="text-sm leading-6 text-muted-foreground">
          False win claims, fake screenshots or repeated disputes result in penalties and can get your
          account suspended without refund.
        </p>
      </div>

      <h2 className="mb-2 mt-6 font-display text-base font-bold">Terms & conditions</h2>
      <div className="rounded-2xl border border-border/60 bg-card p-5">
        <ul className="space-y-3">
          {TERMS.map((t) => (
            <li key={t} className="text-sm leading-6 text-muted-foreground">
              • {t}
            </li>
          ))}
        </ul>
      </div>
    </AppShell>
  );
}
