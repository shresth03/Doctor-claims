import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect } from "react";

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  width = 560,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  width?: number;
  children: React.ReactNode;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed right-0 top-0 z-50 h-full overflow-y-auto border-l border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-2xl"
            style={{ width: "min(100vw, " + width + "px)" }}
            initial={{ x: "100%", opacity: 0.6 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0.6 }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)]/95 px-6 py-5 backdrop-blur">
              <div>
                <h2 className="font-[family-name:var(--font-display)] text-lg font-medium text-[var(--color-text)]">{title}</h2>
                {subtitle && <p className="mt-0.5 text-sm text-[var(--color-text-tertiary)]">{subtitle}</p>}
              </div>
              <button
                onClick={onClose}
                className="rounded-full p-1.5 text-[var(--color-text-tertiary)] transition hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-5">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
