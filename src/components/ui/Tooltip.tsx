import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cx } from "../../lib/utils";

export function Tooltip({ content, children, className }: { content: React.ReactNode; children: React.ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className={cx("relative inline-flex", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      <AnimatePresence>
        {open && (
          <motion.span
            initial={{ opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-pre rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface-3)] px-3 py-2 text-xs text-[var(--color-text-secondary)] shadow-xl font-[family-name:var(--font-mono)]"
          >
            {content}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

export function ModelMetaTooltip({ model }: { model: { model_provider: string; model_name: string; model_version: string; workflow_version: string; ruleset_version: string } }) {
  return (
    <Tooltip
      content={
        <span className="block space-y-0.5">
          <span className="block">provider: {model.model_provider}</span>
          <span className="block">model: {model.model_name}</span>
          <span className="block">version: {model.model_version}</span>
          <span className="block">workflow: {model.workflow_version}</span>
          <span className="block">ruleset: {model.ruleset_version}</span>
        </span>
      }
    >
      <button
        type="button"
        className="rounded border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)] transition hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-secondary)]"
      >
        model info
      </button>
    </Tooltip>
  );
}
