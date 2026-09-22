export const GAMES = [
  {
    id: "ludo-classic",
    name: "Ludo Classic",
    tagline: "Play with 1 token · Classic rules",
    emoji: "🎲",
  },
] as const;

export const BATTLE_AMOUNTS = [50, 100, 250, 500, 1000, 2000];
export const DEPOSIT_AMOUNTS = [50, 100, 200, 500, 1000, 2000];

export const COMMISSION_RATE = 0;
export const MIN_WITHDRAWAL = 100;
export const MIN_BATTLE = 10;
export const REFERRAL_RATE = 0.02;
export const UPI_ID = "funbattle@upi";

export function prizeFor(amount: number) {
  return Math.round(amount * 1.9 * 100) / 100;
}

export function gameName(id: string) {
  return GAMES.find((g) => g.id === id)?.name ?? id;
}

export function rupees(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export function statusLabel(status: string) {
  const map: Record<string, string> = {
    open: "Waiting for opponent",
    running: "Match in progress",
    result_pending: "Result pending",
    disputed: "Under review",
    completed: "Completed",
    cancelled: "Cancelled",
  };
  return map[status] ?? status;
}
