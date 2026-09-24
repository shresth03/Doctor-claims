import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertOctagon, Bell, CheckCheck, Lock, ShieldAlert } from "lucide-react";
import { useAppStore } from "../../lib/store";
import { relativeTime, cx } from "../../lib/utils";
import type { AppNotification } from "../../types";

const ICON_BY_KIND: Record<AppNotification["kind"], typeof Bell> = {
  stuck_draft: Bell,
  sla_breach: AlertOctagon,
  quarantine: Lock,
  system: ShieldAlert,
};

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const notifications = useAppStore((s) => s.notifications);
  const markNotification = useAppStore((s) => s.markNotification);
  const markAllRead = useAppStore((s) => s.markAllNotificationsRead);
  const unreadCount = notifications.filter((n) => n.state === "unread").length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-lg p-2 text-[var(--color-text-secondary)] transition hover:bg-white/5 hover:text-[var(--color-text)]"
        aria-label="Notifications"
      >
        <Bell size={17} />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-danger)] px-1 text-[9px] font-semibold text-white">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.16 }}
              className="absolute right-0 z-50 mt-2 w-96 overflow-hidden rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface-2)] shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
                <p className="text-sm font-medium text-[var(--color-text)]">Notifications</p>
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-xs text-[var(--color-text-tertiary)] transition hover:text-[var(--color-text)]"
                >
                  <CheckCheck size={13} /> Mark all read
                </button>
              </div>
              <div className="max-h-[26rem] overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="px-4 py-10 text-center text-xs text-[var(--color-text-tertiary)]">You're all caught up.</p>
                ) : (
                  notifications.map((n) => {
                    const Icon = ICON_BY_KIND[n.kind];
                    return (
                      <button
                        key={n.id}
                        onClick={() => markNotification(n.id, n.state === "unread" ? "read" : "acknowledged")}
                        className={cx(
                          "flex w-full items-start gap-3 border-b border-[var(--color-border)] px-4 py-3 text-left transition hover:bg-white/[0.03]",
                          n.state === "unread" && "bg-white/[0.02]",
                        )}
                      >
                        <span
                          className={cx(
                            "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                            n.severity === "critical"
                              ? "bg-[var(--color-danger-dim)] text-[var(--color-danger)]"
                              : n.severity === "warning"
                                ? "bg-[var(--color-warning-dim)] text-[var(--color-warning)]"
                                : "bg-white/5 text-[var(--color-text-tertiary)]",
                          )}
                        >
                          <Icon size={13} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="truncate text-xs font-medium text-[var(--color-text)]">{n.title}</span>
                            {n.state === "unread" && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-accent)]" />}
                          </span>
                          <span className="mt-0.5 block text-xs leading-relaxed text-[var(--color-text-secondary)]">{n.message}</span>
                          <span className="mt-1 block text-[10px] uppercase tracking-wide text-[var(--color-text-tertiary)]">
                            {relativeTime(n.createdAt)} · {n.state}
                          </span>
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
