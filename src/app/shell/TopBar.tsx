import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Search, UserCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../../lib/store";
import { NotificationCenter } from "./NotificationCenter";
import { ROLE_LABEL } from "./nav";
import type { Role } from "../../types";
import { cx } from "../../lib/utils";

const ROLES: Role[] = ["doctor", "billing", "compliance", "admin"];

export function TopBar() {
  const user = useAppStore((s) => s.user);
  const setRole = useAppStore((s) => s.setRole);
  const health = useAppStore((s) => s.workflowHealth);
  const claims = useAppStore((s) => s.claims);
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  const results = query.trim()
    ? claims
        .filter(
          (c) =>
            c.id.toLowerCase().includes(query.toLowerCase()) ||
            c.patientName.toLowerCase().includes(query.toLowerCase()) ||
            c.doctorName.toLowerCase().includes(query.toLowerCase()),
        )
        .slice(0, 6)
    : [];

  return (
    <header className="flex h-16 items-center gap-4 border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)]/60 px-6 backdrop-blur-xl">
      <div className="relative w-full max-w-md">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
          placeholder="Search claims, patients, doctors…"
          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-2 pl-9 pr-3 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)] outline-none transition focus:border-[var(--color-accent)]/50 focus:ring-1 focus:ring-[var(--color-accent)]/30"
        />
        <AnimatePresence>
          {searchFocused && results.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface-2)] shadow-2xl"
            >
              {results.map((c) => (
                <button
                  key={c.id}
                  onMouseDown={() => {
                    navigate("/doctor-review");
                    useAppStore.getState().selectClaim(c.id);
                    setQuery("");
                  }}
                  className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition hover:bg-white/[0.04]"
                >
                  <span className="text-[var(--color-text)]">{c.patientName}</span>
                  <span className="font-[family-name:var(--font-mono)] text-xs text-[var(--color-text-tertiary)]">{c.id}</span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div className="hidden items-center gap-1.5 rounded-full border border-[var(--color-border)] px-2.5 py-1 text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)] md:flex">
          {health.environment}
        </div>

        <div className="hidden items-center gap-1.5 rounded-full border border-[var(--color-border)] px-2.5 py-1 text-xs text-[var(--color-text-secondary)] md:flex">
          <span
            className={cx(
              "h-1.5 w-1.5 rounded-full",
              health.status === "healthy" && "bg-[var(--color-success)] shadow-[0_0_6px_var(--color-success)]",
              health.status === "degraded" && "bg-[var(--color-warning)]",
              health.status === "down" && "bg-[var(--color-danger)]",
            )}
          />
          Workflow {health.status}
        </div>

        <NotificationCenter />

        <div className="relative">
          <button
            onClick={() => setProfileOpen((v) => !v)}
            className="flex items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 transition hover:border-[var(--color-border)] hover:bg-white/[0.03]"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-surface-3)] text-[var(--color-text-secondary)]">
              <UserCircle2 size={16} />
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-xs font-medium leading-none text-[var(--color-text)]">{user.name}</p>
              <p className="mt-0.5 text-[10px] text-[var(--color-text-tertiary)]">{ROLE_LABEL[user.role]}</p>
            </div>
            <ChevronDown size={13} className="text-[var(--color-text-tertiary)]" />
          </button>

          <AnimatePresence>
            {profileOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface-2)] p-1.5 shadow-2xl"
                >
                  <div className="px-3 py-2">
                    <p className="text-xs font-medium text-[var(--color-text)]">{user.name}</p>
                    <p className="text-[10px] text-[var(--color-text-tertiary)]">{user.facility}</p>
                  </div>
                  <div className="my-1 h-px bg-[var(--color-border)]" />
                  <p className="px-3 py-1 text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]">Demo role switcher</p>
                  {ROLES.map((r) => (
                    <button
                      key={r}
                      onClick={() => {
                        setRole(r);
                        setProfileOpen(false);
                        navigate("/overview");
                      }}
                      className={cx(
                        "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition hover:bg-white/[0.05]",
                        user.role === r ? "text-[var(--color-accent)]" : "text-[var(--color-text-secondary)]",
                      )}
                    >
                      {ROLE_LABEL[r]}
                      {user.role === r && <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />}
                    </button>
                  ))}
                  <p className="px-3 pt-2 text-[10px] leading-relaxed text-[var(--color-text-tertiary)]">
                    Production builds map roles to RBAC, not client-side switching.
                  </p>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
