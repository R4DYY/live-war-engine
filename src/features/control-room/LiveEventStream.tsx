import { useLiveStore } from "@/live/useLiveStore";
import type { NormalizedLiveEvent } from "@/live/types";
import {
  Heart,
  MessageSquare,
  Gift,
  UserPlus,
  Share2,
  LogIn,
  LogOut,
  Wifi,
} from "lucide-react";

const TYPE_META: Record<string, { icon: typeof Heart; color: string; label: string }> = {
  LIKE: { icon: Heart, color: "text-pink-400", label: "LIKE" },
  COMMENT: { icon: MessageSquare, color: "text-blue-400", label: "COMMENT" },
  GIFT: { icon: Gift, color: "text-orange-400", label: "GIFT" },
  FOLLOW: { icon: UserPlus, color: "text-emerald-400", label: "FOLLOW" },
  SHARE: { icon: Share2, color: "text-cyan-400", label: "SHARE" },
  JOIN: { icon: LogIn, color: "text-lime-400", label: "JOIN" },
  LEAVE: { icon: LogOut, color: "text-zinc-400", label: "LEAVE" },
  CONNECTION: { icon: Wifi, color: "text-amber-400", label: "CONN" },
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatEvent(event: NormalizedLiveEvent): string {
  switch (event.type) {
    case "LIKE":
      return `+${event.likeCount}`;
    case "COMMENT":
      return event.text || "(empty)";
    case "GIFT": {
      const coins = event.coinValue ?? event.valueMetadata;
      return `${event.giftName || "(unnamed)"} x${event.repeatCount}${coins != null ? ` (${coins} coins)` : ""}`;
    }
    case "FOLLOW":
      return "followed";
    case "SHARE":
      return "shared";
    case "JOIN":
      return "joined";
    case "LEAVE":
      return "left";
    case "CONNECTION":
      return event.message ?? event.status;
    default:
      return "";
  }
}

function teamColor(team?: string): string {
  if (team === "A") return "text-blue-400";
  if (team === "B") return "text-red-400";
  return "text-zinc-600";
}

export default function LiveEventStream() {
  const eventStream = useLiveStore((s) => s.eventStream);
  const selectEvent = useLiveStore((s) => s.selectEvent);
  const selectedEventId = useLiveStore((s) => s.selectedEvent?.eventId);
  const reversed = [...eventStream].reverse().slice(0, 100);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
          Live Event Stream
        </h2>
        <span className="text-[10px] text-[var(--text-muted)] font-mono">
          {eventStream.length} events
        </span>
      </div>

      <div className="space-y-0.5 max-h-[400px] overflow-y-auto font-mono text-[11px]">
        {reversed.length === 0 && (
          <p className="text-[var(--text-muted)] italic py-4 text-center">
            No events yet. Use the simulator panel to send events.
          </p>
        )}
        {reversed.map((event) => {
          const meta = TYPE_META[event.type] ?? TYPE_META.CONNECTION;
          const Icon = meta.icon;
          const isSelected = event.eventId === selectedEventId;
          return (
            <button
              key={event.eventId}
              onClick={() => selectEvent(event)}
              className={`flex items-center gap-2 w-full text-left px-2 py-1 rounded transition-colors ${
                isSelected ? "bg-[var(--accent)]/10 ring-1 ring-[var(--accent)]/20" : "hover:bg-[var(--bg-surface)]"
              }`}
            >
              <span className="text-[var(--text-muted)] tabular-nums shrink-0">
                {formatTime(event.timestamp)}
              </span>
              <Icon size={11} className={`${meta.color} shrink-0`} />
              <span className={`${meta.color} font-medium shrink-0 w-14`}>
                {meta.label}
              </span>
              <span className="text-[var(--text-secondary)] shrink-0 truncate max-w-[70px]">
                {event.username ?? event.userId ?? "—"}
              </span>
              <span className={`shrink-0 w-4 text-center ${teamColor(event.team)}`}>
                {event.team && event.team !== "NONE" ? event.team : ""}
              </span>
              <span className="text-[var(--text-primary)] truncate flex-1">
                {formatEvent(event)}
              </span>
              <span className="text-[var(--text-muted)] shrink-0 text-[9px]">
                {event.source === "SIMULATOR" ? "SIM" : event.source.slice(0, 3)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
