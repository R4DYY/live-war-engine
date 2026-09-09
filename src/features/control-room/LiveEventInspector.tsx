import { useLiveStore } from "@/live/useLiveStore";
import type { NormalizedLiveEvent, PipelineStep } from "@/live/types";
import { X } from "lucide-react";

function buildPipeline(event: NormalizedLiveEvent): PipelineStep[] {
  return [
    { stage: "RAW", label: "Raw / Simulator", status: "done", detail: event.source },
    { stage: "NORMALIZED", label: "Normalized Live Event", status: "done", detail: event.type },
    { stage: "VIEWER_TEAM", label: "Viewer / Team", status: event.userId ? "done" : "pending", detail: event.team && event.team !== "NONE" ? `Team ${event.team}` : undefined },
    { stage: "GIFT_MAPPING", label: "Gift Mapping", status: "skipped", detail: "Prompt 13" },
    { stage: "GAME_COMMAND", label: "Game Command", status: "skipped", detail: "Prompt 13" },
    { stage: "ENGINE_RESULT", label: "Engine Result", status: "skipped", detail: "Future" },
  ];
}

function Field({ label, value }: { label: string; value: string | number | undefined }) {
  return (
    <div className="flex justify-between gap-2 text-[11px]">
      <span className="text-[var(--text-muted)] shrink-0">{label}</span>
      <span className="text-[var(--text-secondary)] font-mono text-right truncate">{value ?? "—"}</span>
    </div>
  );
}

export default function LiveEventInspector() {
  const selectedEvent = useLiveStore((s) => s.selectedEvent);
  const selectEvent = useLiveStore((s) => s.selectEvent);

  if (!selectedEvent) {
    return (
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
          Event Inspector
        </h3>
        <p className="text-[var(--text-muted)] italic text-[11px] py-4 text-center">
          Click an event in the stream to inspect its full payload.
        </p>
      </div>
    );
  }

  const e = selectedEvent;
  const pipeline = buildPipeline(e);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
          Event Inspector
        </h3>
        <button onClick={() => selectEvent(null)} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
          <X size={14} />
        </button>
      </div>

      {/* Pipeline */}
      <div className="space-y-1">
        {pipeline.map((step) => (
          <div key={step.stage} className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 flex-1 px-2 py-1 rounded text-[10px] ${
              step.status === "done" ? "bg-emerald-950/20 text-emerald-400"
              : step.status === "active" ? "bg-amber-950/20 text-amber-400"
              : step.status === "skipped" ? "bg-zinc-800/30 text-zinc-500"
              : "bg-[var(--bg-surface)] text-[var(--text-muted)]"
            }`}>
              {step.status === "done" && <span className="text-emerald-400">&#10003;</span>}
              {step.status === "skipped" && <span className="text-zinc-600">-</span>}
              {step.status === "pending" && <span className="text-zinc-600">o</span>}
              <span className="font-medium">{step.label}</span>
              {step.detail && <span className="opacity-60 ml-auto">{step.detail}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Payload */}
      <div className="space-y-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] p-2.5">
        <Field label="Event ID" value={e.eventId} />
        <Field label="Type" value={e.type} />
        <Field label="Timestamp" value={new Date(e.timestamp).toISOString()} />
        <Field label="Sequence" value={e.sequenceNumber} />
        <Field label="Source" value={e.source} />
        <Field label="User ID" value={e.userId} />
        <Field label="Username" value={e.username} />
        <Field label="Team" value={e.team} />
        {e.type === "LIKE" && <Field label="Like Count" value={e.likeCount} />}
        {e.type === "COMMENT" && <Field label="Comment" value={e.text} />}
        {e.type === "GIFT" && (
          <>
            <Field label="Gift ID" value={e.giftId} />
            <Field label="Gift Name" value={e.giftName} />
            <Field label="Repeat Count" value={e.repeatCount} />
            <Field label="Combo ID" value={e.comboId} />
            <Field label="Combo State" value={e.comboState} />
            <Field label="Value (EUR)" value={e.valueMetadata} />
          </>
        )}
        {e.type === "CONNECTION" && (
          <>
            <Field label="Status" value={e.status} />
            <Field label="Message" value={e.message} />
          </>
        )}
      </div>
    </div>
  );
}
