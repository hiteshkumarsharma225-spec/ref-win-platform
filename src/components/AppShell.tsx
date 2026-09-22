import { Link, useRouterState } from "@tanstack/react-router";
import { Gamepad2, Home, Users, User, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { rupees } from "@/lib/game";
import { useUser, useWallet, walletTotal } from "@/lib/account";

const TABS = [
  { to: "/", label: "Home", icon: Home },
  { to: "/battles", label: "Battles", icon: Gamepad2 },
  { to: "/wallet", label: "Wallet", icon: Wallet },
  { to: "/refer", label: "Refer", icon: Users },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function AppShell({
  title,
  children,
  showBalance = true,
}: {
  title?: string;
  children: ReactNode;
  showBalance?: boolean;
}) {
  const { user } = useUser();
  const { data: wallet } = useWallet(user?.id);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen w-full bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border/60 bg-card/95 backdrop-blur lg:flex">
        <div className="flex h-16 items-center border-b border-border/60 px-5">
          <Link to="/" className="flex items-center gap-3">
            <span className="gold-gradient flex h-9 w-9 items-center justify-center rounded-xl text-base font-bold text-primary-foreground">
              म
            </span>
            <span className="font-display text-lg font-bold tracking-tight">
              {title ?? "REAL LUDO PLAYER"}
            </span>
          </Link>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {TABS.map((tab) => {
            const active = tab.to === "/" ? pathname === "/" : pathname.startsWith(tab.to);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
                {tab.label}
              </Link>
            );
          })}
        </nav>

        {showBalance && user ? (
          <Link
            to="/wallet"
            className="m-3 flex items-center justify-between rounded-xl border border-primary/30 bg-primary/10 px-4 py-3"
          >
            <span className="text-xs text-muted-foreground">Virtual Credits</span>
            <span className="font-semibold text-primary">{walletTotal(wallet)} Credits</span>
          </Link>
        ) : null}
      </aside>

      {/* Desktop header */}
      <header className="fixed inset-x-0 top-0 z-30 hidden h-16 border-b border-border/60 bg-background/95 backdrop-blur lg:block lg:pl-64">
        <div className="flex h-full items-center justify-between px-6 xl:px-8">
          <div className="text-sm text-muted-foreground">
            {title ?? "REAL LUDO PLAYER"}
          </div>
          {showBalance && user ? (
            <Link
              to="/wallet"
              className="flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary"
            >
              <Wallet className="h-4 w-4" />
              {rupees(walletTotal(wallet))}
            </Link>
          ) : null}
        </div>
      </header>

      {/* Mobile layout */}
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background lg:hidden">
        <header className="sticky top-0 z-30 border-b border-border/60 bg-background/95 backdrop-blur">
          <div className="flex items-center justify-between px-4 py-3">
            <Link to="/" className="flex items-center gap-2">
              <span className="gold-gradient flex h-8 w-8 items-center justify-center rounded-lg text-base font-bold text-primary-foreground">
                म
              </span>
              <span className="font-display text-lg font-bold tracking-tight">
                {title ?? "REAL LUDO PLAYER"}
              </span>
            </Link>
            {showBalance && user ? (
              <Link
                to="/wallet"
                className="flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary"
              >
                <Wallet className="h-4 w-4" />
                {rupees(walletTotal(wallet))}
              </Link>
            ) : null}
          </div>
        </header>

        <main className="flex-1 px-4 pb-28 pt-4">{children}</main>

        <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-md border-t border-border/60 bg-card/95 backdrop-blur">
          <div className="grid grid-cols-5">
            {TABS.map((tab) => {
              const active = tab.to === "/" ? pathname === "/" : pathname.startsWith(tab.to);
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.to}
                  to={tab.to}
                  className={cn(
                    "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <Icon className={cn("h-5 w-5", active && "drop-shadow-[0_0_6px_currentColor]")} />
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>

      {/* Desktop content */}
      <main className="hidden min-h-screen pt-20 lg:block lg:pl-64">
        <div className="mx-auto w-full max-w-[1440px] px-6 pb-10 xl:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
