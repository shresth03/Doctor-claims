import { useCallback, useState } from "react";
import { CheckCircle2, FileUp, Paperclip, Send, UploadCloud } from "lucide-react";
import { Drawer } from "../../components/ui/Drawer";
import { Button } from "../../components/ui/Button";
import { Countdown } from "../../components/ui/Countdown";
import { StatusPill } from "../../components/ui/StatusPill";
import { useAppStore } from "../../lib/store";
import { formatTimestamp } from "../../lib/utils";
import type { DocRequest } from "../../types";

export function RequestDetailDrawer({ request, onClose }: { request: DocRequest | null; onClose: () => void }) {
  const updateStatus = useAppStore((s) => s.updateDocRequestStatus);
  const [dragOver, setDragOver] = useState(false);
  const [uploaded, setUploaded] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const files = Array.from(e.dataTransfer.files).map((f) => f.name);
      if (files.length === 0) return;
      setUploading(true);
      setTimeout(() => {
        setUploaded((prev) => [...prev, ...files]);
        setUploading(false);
        if (request) updateStatus(request.id, "ready_to_send", `Attached ${files.join(", ")}`);
      }, 900);
    },
    [request, updateStatus],
  );

  if (!request) return null;

  return (
    <Drawer open={!!request} onClose={onClose} title={`Request ${request.id}`} subtitle={`Claim ${request.claimId} · ${request.insurer}`} width={620}>
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <StatusPill tone={request.status === "sla_breach" ? "danger" : request.status === "submitted" ? "success" : "info"}>{request.status.replace(/_/g, " ")}</StatusPill>
          <Countdown dueAt={request.dueAt} />
        </div>

        <section>
          <p className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">Requested documentation</p>
          <ul className="mt-2 space-y-1.5">
            {request.requestedDocs.map((d, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                <Paperclip size={13} className="text-[var(--color-text-tertiary)]" /> {d}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <p className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">Request timeline</p>
          <div className="mt-2 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--color-text-secondary)]">Received</span>
              <span className="text-[var(--color-text-tertiary)]">{formatTimestamp(request.receivedAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--color-text-secondary)]">Due</span>
              <span className="text-[var(--color-text-tertiary)]">{formatTimestamp(request.dueAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--color-text-secondary)]">Assigned owner</span>
              <span className="text-[var(--color-text-tertiary)]">{request.owner}</span>
            </div>
          </div>
        </section>

        <section>
          <p className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">Upload document</p>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`mt-2 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
              dragOver ? "border-[var(--color-accent)] bg-[var(--color-accent)]/5" : "border-[var(--color-border)]"
            }`}
          >
            <UploadCloud size={22} className="text-[var(--color-text-tertiary)]" />
            <p className="text-xs text-[var(--color-text-secondary)]">Drag and drop a file, or</p>
            <label className="cursor-pointer text-xs font-medium text-[var(--color-accent)]">
              browse files
              <input
                type="file"
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []).map((f) => f.name);
                  if (files.length === 0) return;
                  setUploading(true);
                  setTimeout(() => {
                    setUploaded((prev) => [...prev, ...files]);
                    setUploading(false);
                    updateStatus(request.id, "ready_to_send", `Attached ${files.join(", ")}`);
                  }, 900);
                }}
              />
            </label>
          </div>
          {uploading && <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--color-text-tertiary)]"><FileUp size={12} className="animate-pulse" /> Uploading…</p>}
          {uploaded.length > 0 && (
            <ul className="mt-2 space-y-1">
              {uploaded.map((f, i) => (
                <li key={i} className="flex items-center gap-1.5 text-xs text-[var(--color-success)]">
                  <CheckCircle2 size={12} /> {f}
                </li>
              ))}
            </ul>
          )}
        </section>

        {request.responseHistory.length > 0 && (
          <section>
            <p className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">Response history</p>
            <div className="mt-2 space-y-2">
              {request.responseHistory.map((r, i) => (
                <div key={i} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs">
                  <p className="text-[var(--color-text-secondary)]">{r.summary}</p>
                  <p className="mt-1 text-[var(--color-text-tertiary)]">{formatTimestamp(r.at)}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="flex gap-2 border-t border-[var(--color-border)] pt-4">
          <Button variant="secondary" size="sm" onClick={() => updateStatus(request.id, "ready_to_send")}>
            Prepare response
          </Button>
          <Button
            size="sm"
            icon={<Send size={13} />}
            disabled={request.status === "submitted"}
            onClick={() => updateStatus(request.id, "submitted", "Response package submitted to insurer.")}
          >
            Submit response
          </Button>
        </div>
      </div>
    </Drawer>
  );
}
