import { Suspense } from "react";
import { AnimatePresence } from "framer-motion";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Lock } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { PageTransition } from "../PageTransition";
import { NAV_ITEMS, ROLE_LABEL } from "./nav";
import { useAppStore } from "../../lib/store";

/**
 * Client-side route guard. This is a UX layer only: in production the same rules must be enforced by
 * the backend (RBAC on every API/webhook), never by hiding UI.
 */
function AccessRestricted({ label, role }: { label: string; role: string }) {
  return (
    <div className="flex h-full items-center justify-center p-10">
      <div className="max-w-sm text-center">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border-strong)] text-[var(--color-text-tertiary)]">
          <Lock size={16} />
        </div>
        <h1 className="mt-4 font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--color-text)]">{label} is restricted</h1>
        <p className="mt-1.5 text-sm text-[var(--color-text-tertiary)]">The {role} role doesn't have access to this area. Switch roles from the profile menu to preview it.</p>
        <Link to="/overview" className="mt-4 inline-block text-sm text-[var(--color-accent)] hover:underline">
          Back to overview
        </Link>
      </div>
    </div>
  );
}

export function AppShell() {
  const location = useLocation();
  const role = useAppStore((s) => s.user.role);
  const item = NAV_ITEMS.find((n) => location.pathname === n.to || location.pathname.startsWith(`${n.to}/`));
  const allowed = !item || item.roles.includes(role);

  return (
    <div className="grid-bg flex h-screen w-screen overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="min-h-0 flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <PageTransition key={location.pathname}>{allowed ? (
                <Suspense fallback={<div className="p-8" role="status" aria-label="Loading"><div className="h-7 w-56 animate-pulse rounded bg-white/[0.05]" /><div className="mt-6 h-64 animate-pulse rounded-xl bg-white/[0.03]" /></div>}>
                  <Outlet />
                </Suspense>
              ) : (
                <AccessRestricted label={item!.label} role={ROLE_LABEL[role]} />
              )}</PageTransition>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
