import { useEngineStore } from "@/state/engineStore";
import { formatEventTime } from "@/engine/events";
import { Trash2, Copy } from "lucide-react";

export default function EventLog() {
  const events = useEngineStore((s) => s.events);
  const clearEvents = useEngineStore((s) => s.clearEvents);

  const copyLog = () => {
    const text = events
      .map(
        (e) =>
          `${formatEventTime(e.timestamp)} ${e.type}${
            e.battleId ? ` [${e.battleId.slice(0, 8)}]` : ""
          }`
      )
      .join("\n");
    navigator.clipboard.writeText(text).catch(() => {});
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
          Event Log
        </h2>
        <div className="flex gap-2">
          <button
            onClick={copyLog}
            className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
            title="Copy log"
          >
            <Copy size={12} />
          </button>
          <button
            onClick={clearEvents}
            className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors"
            title="Clear log"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      <div className="max-h-48 overflow-y-auto rounded-lg bg-[var(--bg-root)] border border-[var(--border)] p-2 space-y-0.5">
        {events.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)] text-center py-2">
            No events yet
          </p>
        ) : (
          [...events].reverse().map((e) => (
            <div key={e.id} className="flex gap-2 text-xs font-mono">
              <span className="text-[var(--text-muted)] shrink-0">
                {formatEventTime(e.timestamp)}
              </span>
              <span
                className={
                  e.type.includes("ERROR")
                    ? "text-[var(--danger)]"
                    : e.type.includes("STARTED")
                    ? "text-[var(--accent)]"
                    : e.type.includes("ENDED") || e.type.includes("STOPPED")
                    ? "text-[var(--warning)]"
                    : "text-[var(--text-secondary)]"
                }
              >
                {e.type}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
