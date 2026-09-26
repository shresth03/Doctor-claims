import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import { useAppStore } from "../../lib/store";
import { NAV_ITEMS } from "./nav";
import { cx } from "../../lib/utils";
import { Waves } from "lucide-react";

export function Sidebar() {
  const role = useAppStore((s) => s.user.role);
  const items = NAV_ITEMS.filter((item) => item.roles.includes(role));

  return (
    <aside className="flex h-full w-60 flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-elevated)]/60 backdrop-blur-xl">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-accent)]/12 text-[var(--color-accent)]">
          <Waves size={17} strokeWidth={2.25} />
        </div>
        <div>
          <p className="font-[family-name:var(--font-display)] text-sm font-semibold leading-none text-[var(--color-text)]">Meridian</p>
          <p className="mt-0.5 text-[10px] uppercase tracking-widest text-[var(--color-text-tertiary)]">Claims Platform</p>
        </div>
      </div>

      <nav className="mt-2 flex-1 space-y-0.5 px-3">
        {items.map((item) => (
          <NavLink key={item.to} to={item.to} className="relative block">
            {({ isActive }) => (
              <div
                className={cx(
                  "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  isActive ? "text-[var(--color-text)]" : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]",
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-lg bg-black/[0.055]"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <item.icon size={16} strokeWidth={2} className="relative z-10 shrink-0" />
                <span className="relative z-10 font-medium">{item.label}</span>
                {isActive && <span className="relative z-10 ml-auto h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />}
              </div>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mx-3 mb-4 rounded-lg border border-[var(--color-border)] bg-black/[0.035] px-3.5 py-3">
        <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]">Orchestration</p>
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">n8n workflow layer connected</p>
      </div>
    </aside>
  );
}
