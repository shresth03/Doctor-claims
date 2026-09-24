import type { LucideIcon } from "lucide-react";

export function EmptyState({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--color-border)] px-6 py-16 text-center">
      <Icon size={28} className="text-[var(--color-text-tertiary)]" />
      <div>
        <p className="text-sm font-medium text-[var(--color-text-secondary)]">{title}</p>
        {description && <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">{description}</p>}
      </div>
    </div>
  );
}
