import { motion } from "framer-motion";
import { AlertCircle, Check } from "lucide-react";
import type { ClaimStage } from "../../types";
import { cx } from "../../lib/utils";

const STAGES: { key: ClaimStage; label: string }[] = [
  { key: "draft_generated", label: "Draft Generated" },
  { key: "doctor_review", label: "Doctor Review" },
  { key: "approved", label: "Approved" },
  { key: "submission", label: "Submission" },
  { key: "submitted", label: "Submitted" },
];

export function LifecycleIndicator({ stage }: { stage: ClaimStage }) {
  const failed = stage === "failed";
  const currentIndex = failed ? 3 : STAGES.findIndex((s) => s.key === stage);

  return (
    <div className="flex items-center gap-0.5">
      {STAGES.map((s, i) => {
        const done = i < currentIndex || (i === currentIndex && !failed && stage === "submitted");
        const active = i === currentIndex;
        const isFailedStep = failed && i === 3;
        return (
          <div key={s.key} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <motion.div
                animate={{
                  scale: active ? 1.15 : 1,
                }}
                className={cx(
                  "flex h-5 w-5 items-center justify-center rounded-full border text-[10px]",
                  isFailedStep && "border-[var(--color-danger)] bg-[var(--color-danger-dim)] text-[var(--color-danger)]",
                  !isFailedStep && done && "border-[var(--color-success)] bg-[var(--color-success-dim)] text-[var(--color-success)]",
                  !isFailedStep && active && !done && "border-[var(--color-accent)] bg-[var(--color-accent)]/15 text-[var(--color-accent)]",
                  !isFailedStep && !active && !done && "border-[var(--color-border)] text-[var(--color-text-tertiary)]",
                )}
              >
                {isFailedStep ? <AlertCircle size={11} /> : done ? <Check size={11} /> : i + 1}
              </motion.div>
              <span
                className={cx(
                  "whitespace-nowrap text-[10px]",
                  isFailedStep ? "text-[var(--color-danger)]" : active ? "text-[var(--color-text)]" : "text-[var(--color-text-tertiary)]",
                )}
              >
                {isFailedStep ? "Failed" : s.label}
              </span>
            </div>
            {i < STAGES.length - 1 && (
              <div className={cx("mx-1.5 mb-4 h-px w-8", i < currentIndex ? "bg-[var(--color-success)]/50" : "bg-[var(--color-border)]")} />
            )}
          </div>
        );
      })}
    </div>
  );
}
