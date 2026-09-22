import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { App as CapacitorApp } from "@capacitor/app";
import { ArrowLeft, Gamepad2, Home, Users, User, Wallet } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useUser, useWallet, walletTotal } from "@/lib/account";
import { useQueryClient } from "@tanstack/react-query";
import { rupees } from "@/lib/game";

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
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const touchStart = useRef<number | null>(null);
  const refreshingRef = useRef(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    let remove: (() => void) | undefined;
    void CapacitorApp.addListener("backButton", ({ canGoBack }) => {
      if (window.history.length > 1 && canGoBack) {
        router.history.back();
      } else if (pathname !== "/") {
        router.navigate({ to: "/" });
      } else {
        void CapacitorApp.exitApp();
      }
    }).then((handle) => { remove = () => handle.remove(); });
    return () => remove?.();
  }, [router, pathname]);

  const goBack = () => {
    if (window.history.length > 1) router.history.back();
    else router.navigate({ to: "/" });
  };

  const refreshPage = async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    try {
      await Promise.all([
        router.invalidate(),
        queryClient.invalidateQueries(),
      ]);
    } finally {
      setPullDistance(0);
      setRefreshing(false);
      refreshingRef.current = false;
    }
  };

  const onTouchStart = (event: React.TouchEvent<HTMLElement>) => {
    if (window.scrollY <= 2 && !refreshingRef.current) {
      touchStart.current = event.touches[0]?.clientY ?? null;
    }
  };
  const onTouchMove = (event: React.TouchEvent<HTMLElement>) => {
    if (touchStart.current === null || window.scrollY > 2 || refreshingRef.current) return;
    const distance = Math.max(0, Math.min(110, (event.touches[0]?.clientY ?? 0) - touchStart.current));
    if (distance > 0) {
      setPullDistance(distance);
      if (distance > 8) event.preventDefault();
    }
  };
  const onTouchEnd = () => {
    if (touchStart.current !== null && pullDistance >= 70) void refreshPage();
    touchStart.current = null;
    if (!refreshingRef.current) setPullDistance(0);
  };

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
        {pathname !== "/" ? (
          <button
            type="button"
            onClick={goBack}
            aria-label="Go back"
            className="fixed left-3 top-3 z-50 flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-card/95 text-foreground shadow-sm backdrop-blur"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        ) : null}
        {pullDistance > 0 || refreshing ? (
          <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center pt-2">
            <div className="rounded-full border border-primary/30 bg-card/95 px-3 py-1 text-xs font-semibold text-primary shadow-sm backdrop-blur">
              {refreshing ? "Refreshing…" : pullDistance >= 70 ? "Release to refresh" : "Pull to refresh"}
            </div>
          </div>
        ) : null}
        <header
          className="sticky top-0 z-30 border-b border-border/60 bg-background/95 backdrop-blur"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="flex items-center justify-between px-4 py-3 pl-14">
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

        <main className="flex-1 px-4 pb-28 pt-4" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} style={{ overscrollBehaviorY: "contain" }}>{children}</main>

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
