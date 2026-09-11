import { useEffect, useState } from "react";
import { useLiveStore } from "@/live/useLiveStore";
import type { GiftSlot } from "@/live/types";
import {
  Heart,
  MessageSquare,
  Gift,
  UserPlus,
  Share2,
  LogIn,
  LogOut,
  WifiOff,
  Wifi,
  Circle,
  Disc,
  Play,
  Zap,
  ChevronDown,
  ChevronRight,
  Users,
  AlertTriangle,
  Copy,
  RotateCcw,
  Trash2,
  Square,
  Radio,
  Bug,
  Gauge,
  Link2,
  Link2Off,
  Gift as GiftIcon,
} from "lucide-react";

const TIER_COLORS: Record<string, string> = {
  T1: "text-zinc-300 border-zinc-600/40 bg-zinc-800/30",
  T2: "text-green-400 border-green-700/40 bg-green-950/30",
  T3: "text-sky-400 border-sky-700/40 bg-sky-950/30",
  T4: "text-orange-400 border-orange-700/40 bg-orange-950/30",
  T5: "text-red-400 border-red-700/40 bg-red-950/30",
  T6: "text-amber-400 border-amber-600/50 bg-amber-950/30",
};

function Collapsible({
  title,
  icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="space-y-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 w-full text-left group"
      >
        {open ? <ChevronDown size={12} className="text-[var(--text-muted)]" /> : <ChevronRight size={12} className="text-[var(--text-muted)]" />}
        {icon}
        <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide group-hover:text-[var(--text-secondary)] transition-colors">
          {title}
        </span>
      </button>
      {open && <div className="space-y-2">{children}</div>}
    </div>
  );
}

function GiftCard({
  slot,
  onTrigger,
}: {
  slot: GiftSlot;
  onTrigger: () => void;
}) {
  return (
    <div className={`rounded-lg border p-2.5 space-y-1.5 ${TIER_COLORS[slot.tier]}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold">{slot.tier}</span>
        <span className="text-[10px] text-[var(--text-muted)]">~&euro;{slot.targetPriceEuro}</span>
      </div>
      <p className="text-[10px] font-medium opacity-80">{slot.role}</p>
      <p className="text-[9px] text-[var(--text-muted)] font-mono">{slot.simulatorGiftId}</p>
      <button
        onClick={onTrigger}
        className="w-full px-2 py-1 rounded text-[11px] font-bold border border-current/30 hover:brightness-125 transition-all"
      >
        TRIGGER
      </button>
    </div>
  );
}

export default function LiveSimulatorPanel() {
  const s = useLiveStore();

  useEffect(() => {
    s.init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const statusColor =
    s.status === "CONNECTED" ? "text-emerald-400"
    : s.status === "RECONNECTING" ? "text-amber-400"
    : s.status === "ERROR" ? "text-red-400"
    : "text-zinc-500";

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
        TikTok Control Lab
      </h2>

      {/* ─── LIVE SOURCE ─────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] px-3 py-2">
          <div className="flex items-center gap-2">
            <Circle size={8} className={`fill-current ${statusColor}`} />
            <span className="text-xs font-medium text-[var(--text-secondary)]">{s.status}</span>
          </div>
          <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">SIMULATOR</span>
        </div>
        {/* Diagnostics */}
        <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono text-[var(--text-muted)]">
          <div className="rounded bg-[var(--bg-surface)] border border-[var(--border)] px-2 py-1">
            Total: <span className="text-[var(--text-secondary)]">{s.metrics.eventsTotal}</span>
          </div>
          <div className="rounded bg-[var(--bg-surface)] border border-[var(--border)] px-2 py-1">
            Viewers: <span className="text-[var(--text-secondary)]">{s.metrics.uniqueViewers}</span>
          </div>
          <div className="rounded bg-[var(--bg-surface)] border border-[var(--border)] px-2 py-1">
            Evts/s: <span className="text-[var(--text-secondary)]">{s.metrics.eventsPerSec}</span>
          </div>
          <div className="rounded bg-[var(--bg-surface)] border border-[var(--border)] px-2 py-1">
            Gifts: <span className="text-[var(--text-secondary)]">{s.metrics.gifts}</span>
          </div>
        </div>
      </div>

      {/* ─── TEST VIEWER ────────────────────────────────────────── */}
      <Collapsible title="Test Viewer" icon={<Users size={11} />} defaultOpen>
        <div className="grid grid-cols-2 gap-2">
          <input
            value={s.username}
            onChange={(e) => s.setUsername(e.target.value)}
            placeholder="@username"
            className="px-2 py-1.5 rounded text-xs bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
          />
          <input
            value={s.userId}
            onChange={(e) => s.setUserId(e.target.value)}
            placeholder="user-id"
            className="px-2 py-1.5 rounded text-xs bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
          />
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {(["NONE", "A", "B"] as const).map((t) => (
            <button
              key={t}
              onClick={() => s.setTeam(t)}
              className={`px-2 py-1.5 rounded text-[11px] font-medium border transition-all ${
                s.team === t
                  ? t === "A" ? "bg-blue-900/50 text-blue-400 border-blue-700/40"
                    : t === "B" ? "bg-red-900/50 text-red-400 border-red-700/40"
                    : "bg-zinc-700/50 text-zinc-300 border-zinc-600/40"
                  : "bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border)]"
              }`}
            >
              {t === "NONE" ? "No Team" : `Team ${t}`}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          <button onClick={() => s.selectPreset(0)} className="px-1 py-1 rounded text-[10px] bg-[var(--bg-surface)] text-[var(--text-muted)] border border-[var(--border)] hover:border-[var(--border-light)] transition-all">V1</button>
          <button onClick={() => s.selectPreset(1)} className="px-1 py-1 rounded text-[10px] bg-[var(--bg-surface)] text-[var(--text-muted)] border border-[var(--border)] hover:border-[var(--border-light)] transition-all">V2</button>
          <button onClick={() => s.selectPreset(2)} className="px-1 py-1 rounded text-[10px] bg-[var(--bg-surface)] text-[var(--text-muted)] border border-[var(--border)] hover:border-[var(--border-light)] transition-all">V3</button>
          <button onClick={() => s.selectRandomViewer()} className="px-1 py-1 rounded text-[10px] bg-[var(--bg-surface)] text-[var(--text-muted)] border border-[var(--border)] hover:border-[var(--border-light)] transition-all">Rand</button>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <button onClick={() => s.sendJoin()} className="flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-medium bg-lime-950/40 text-lime-400 border border-lime-800/30 hover:bg-lime-950/60 transition-all">
            <LogIn size={11} /> Join
          </button>
          <button onClick={() => s.sendLeave()} className="flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-medium bg-zinc-800/40 text-zinc-400 border border-zinc-700/30 hover:bg-zinc-800/60 transition-all">
            <LogOut size={11} /> Leave
          </button>
        </div>
        <div className="text-[10px] text-[var(--text-muted)] text-center">
          @{s.username} {s.team !== "NONE" && <span style={{ color: s.team === "A" ? "var(--team-a)" : "var(--team-b)" }}>supporting Team {s.team}</span>}
        </div>
      </Collapsible>

      {/* ─── SIX CORE GIFT CARDS ─────────────────────────────────── */}
      <Collapsible title="Core Live War Gifts" icon={<Gift size={11} />} defaultOpen>
        {/* Support team selector */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[var(--text-muted)] uppercase">Support:</span>
          <div className="flex gap-1">
            <button onClick={() => s.setTeam("A")} className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${s.team === "A" ? "bg-blue-900/50 text-blue-400 border-blue-700/40" : "bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border)]"}`}>A</button>
            <button onClick={() => s.setTeam("B")} className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${s.team === "B" ? "bg-red-900/50 text-red-400 border-red-700/40" : "bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border)]"}`}>B</button>
          </div>
        </div>
        {/* Quantity */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-[var(--text-muted)] uppercase">Qty:</span>
          {[1, 2, 5, 10].map((n) => (
            <button key={n} onClick={() => s.setGiftQuantity(n)} className={`px-1.5 py-0.5 rounded text-[10px] font-mono border transition-all ${s.giftQuantity === n ? "bg-[var(--accent)]/20 text-[var(--accent)] border-[var(--accent)]/40" : "bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border)]"}`}>x{n}</button>
          ))}
          <input
            type="number"
            value={s.customQuantity}
            onChange={(e) => s.setCustomQuantity(e.target.value)}
            placeholder="custom"
            className="w-14 px-1 py-0.5 rounded text-[10px] font-mono bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] outline-none"
          />
        </div>
        {/* Cards */}
        <div className="grid grid-cols-3 gap-2">
          {s.giftSlots.map((slot) => (
            <GiftCard
              key={slot.tier}
              slot={slot}
              onTrigger={() => {
                const custom = s.customQuantity ? Math.max(1, Number(s.customQuantity)) : s.giftQuantity;
                s.setGiftQuantity(custom);
                s.sendGiftByTier(slot.tier);
              }}
            />
          ))}
        </div>
        <p className="text-[9px] text-[var(--text-muted)] italic">sim_* IDs are placeholders, not real TikTok gifts</p>
      </Collapsible>

      {/* ─── GIFT COMBO / STREAK ────────────────────────────────── */}
      <Collapsible title="Gift Combo / Streak" icon={<Zap size={11} />}>
        {s.comboActive && (
          <div className="rounded bg-amber-950/20 border border-amber-800/20 px-2 py-1.5 text-[10px] font-mono text-amber-400 space-y-0.5">
            <div>Combo ID: {s.comboId?.slice(0, 8)}...</div>
            <div>Count: {s.comboCount}</div>
            <div>State: IN_PROGRESS</div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-1.5">
          <button onClick={() => s.startCombo()} disabled={s.comboActive} className="px-2 py-1.5 rounded text-[11px] font-medium bg-amber-950/40 text-amber-400 border border-amber-800/30 hover:bg-amber-950/60 transition-all disabled:opacity-30">Start Combo</button>
          <button onClick={() => s.finishCombo()} disabled={!s.comboActive} className="px-2 py-1.5 rounded text-[11px] font-medium bg-amber-950/40 text-amber-400 border border-amber-800/30 hover:bg-amber-950/60 transition-all disabled:opacity-30">Finish Combo</button>
          <button onClick={() => s.addComboRepeat(1)} disabled={!s.comboActive} className="px-2 py-1.5 rounded text-[11px] font-medium bg-amber-950/30 text-amber-400 border border-amber-800/20 hover:bg-amber-950/50 transition-all disabled:opacity-30">+1 Repeat</button>
          <button onClick={() => s.addComboRepeat(5)} disabled={!s.comboActive} className="px-2 py-1.5 rounded text-[11px] font-medium bg-amber-950/30 text-amber-400 border border-amber-800/20 hover:bg-amber-950/50 transition-all disabled:opacity-30">+5 Repeats</button>
        </div>
      </Collapsible>

      {/* ─── LIKES ──────────────────────────────────────────────── */}
      <Collapsible title="Likes" icon={<Heart size={11} />} defaultOpen>
        <div className="grid grid-cols-5 gap-1.5">
          {[1, 10, 100, 1000, 10000].map((n) => (
            <button key={n} onClick={() => s.sendLike(n)} className="px-1 py-1.5 rounded text-[11px] font-medium bg-pink-950/40 text-pink-400 border border-pink-800/30 hover:bg-pink-950/60 transition-all">
              {n >= 1000 ? `+${n / 1000}K` : `+${n}`}
            </button>
          ))}
        </div>
        {/* Likes/sec */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-[var(--text-muted)] uppercase">Likes/s:</span>
          {[10, 100, 500].map((n) => (
            <button key={n} onClick={() => s.startLikesPerSec(n)} disabled={s.likesPerSecActive} className="px-1.5 py-0.5 rounded text-[10px] font-mono border bg-pink-950/30 text-pink-400 border-pink-800/20 hover:bg-pink-950/50 transition-all disabled:opacity-30">{n}/s</button>
          ))}
        </div>
        {s.likesPerSecActive && (
          <button onClick={() => s.stopLikesPerSec()} className="flex items-center justify-center gap-1 w-full px-2 py-1.5 rounded text-[11px] font-medium bg-red-950/40 text-red-400 border border-red-800/30 hover:bg-red-950/60 transition-all">
            <Square size={10} /> Stop Likes/s ({s.likesPerSec}/s)
          </button>
        )}
        {/* Chest presets */}
        <div className="space-y-1">
          <p className="text-[10px] text-[var(--text-muted)] uppercase">Chest Presets:</p>
          <div className="grid grid-cols-3 gap-1.5">
            <button onClick={() => s.sendLike(1000)} className="px-1 py-1 rounded text-[10px] bg-pink-950/30 text-pink-400 border border-pink-800/20 hover:bg-pink-950/50 transition-all">+1K</button>
            <button onClick={() => s.sendLike(5000)} className="px-1 py-1 rounded text-[10px] bg-pink-950/30 text-pink-400 border border-pink-800/20 hover:bg-pink-950/50 transition-all">+5K</button>
            <button onClick={() => s.sendLike(10000)} className="px-1 py-1 rounded text-[10px] bg-pink-950/30 text-pink-400 border border-pink-800/20 hover:bg-pink-950/50 transition-all">+10K</button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {["LOW ACTIVITY", "ACTIVE LIVE", "LIKE STORM"].map((label, i) => (
              <button key={label} onClick={() => s.sendLike([100, 1000, 10000][i])} className="px-1 py-1 rounded text-[9px] bg-pink-950/20 text-pink-400/70 border border-pink-800/10 hover:bg-pink-950/40 transition-all">{label}</button>
            ))}
          </div>
        </div>
      </Collapsible>

      {/* ─── COMMENTS ──────────────────────────────────────────── */}
      <Collapsible title="Comments" icon={<MessageSquare size={11} />} defaultOpen>
        <div className="flex gap-2">
          <input
            value={s.commentText}
            onChange={(e) => s.setCommentText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && s.sendComment()}
            placeholder="RED, BLUE, TEAM A..."
            className="flex-1 px-2 py-1.5 rounded text-xs bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
          />
          <button onClick={() => s.sendComment()} className="px-3 py-1.5 rounded text-xs font-medium bg-blue-950/40 text-blue-400 border border-blue-800/30 hover:bg-blue-950/60 transition-all">Send</button>
        </div>
        <div className="grid grid-cols-6 gap-1">
          {["RED", "BLUE", "TEAM A", "TEAM B", "A", "B"].map((preset) => (
            <button key={preset} onClick={() => s.sendComment(preset)} className="px-1 py-1 rounded text-[10px] bg-blue-950/30 text-blue-400 border border-blue-800/20 hover:bg-blue-950/50 transition-all">{preset}</button>
          ))}
        </div>
        <button onClick={() => { for (let i = 0; i < 10; i++) s.sendComment(["RED", "BLUE", "TEAM A", "TEAM B"][i % 4]); }} className="w-full px-2 py-1.5 rounded text-[11px] font-medium bg-blue-950/30 text-blue-400 border border-blue-800/20 hover:bg-blue-950/50 transition-all">Send x10</button>
      </Collapsible>

      {/* ─── CHEST TEST ──────────────────────────────────────────── */}
      <Collapsible title="Chest Test" icon={<GiftIcon size={11} />} defaultOpen>
        {/* Likes to fill chest */}
        <p className="text-[10px] text-[var(--text-muted)] uppercase">Likes:</p>
        <div className="grid grid-cols-5 gap-1">
          {[100, 1000, 5000, 10000, 50000].map((n) => (
            <button key={n} onClick={() => s.sendLike(n)} className="px-1 py-1 rounded text-[10px] font-mono bg-pink-950/30 text-pink-400 border border-pink-800/20 hover:bg-pink-950/50 transition-all">
              {n >= 1000 ? `+${n / 1000}K` : `+${n}`}
            </button>
          ))}
        </div>

        {/* Set chest progress */}
        <p className="text-[10px] text-[var(--text-muted)] uppercase">Set Chest:</p>
        <div className="grid grid-cols-5 gap-1">
          {[25, 50, 75, 90, 99].map((n) => (
            <button key={n} onClick={() => s.setChestProgress(n)} className="px-1 py-1 rounded text-[10px] font-mono bg-amber-950/30 text-amber-400 border border-amber-800/20 hover:bg-amber-950/50 transition-all">
              {n}%
            </button>
          ))}
        </div>

        {/* Team A contributions */}
        <p className="text-[10px] text-[var(--text-muted)] uppercase">Team A Chest Contribution:</p>
        <div className="grid grid-cols-3 gap-1">
          {[1, 5, 10].map((n) => (
            <button key={n} onClick={() => s.sendChestContribution("A", n)} className="px-1 py-1 rounded text-[10px] font-mono bg-blue-950/40 text-blue-400 border border-blue-800/30 hover:bg-blue-950/60 transition-all">
              A +{n}
            </button>
          ))}
        </div>

        {/* Team B contributions */}
        <p className="text-[10px] text-[var(--text-muted)] uppercase">Team B Chest Contribution:</p>
        <div className="grid grid-cols-3 gap-1">
          {[1, 5, 10].map((n) => (
            <button key={n} onClick={() => s.sendChestContribution("B", n)} className="px-1 py-1 rounded text-[10px] font-mono bg-red-950/40 text-red-400 border border-red-800/30 hover:bg-red-950/60 transition-all">
              B +{n}
            </button>
          ))}
        </div>

        {/* Unlock / Reset */}
        <div className="grid grid-cols-2 gap-1.5">
          <button onClick={() => s.forceUnlockChest()} className="flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[11px] font-medium bg-amber-950/40 text-amber-400 border border-amber-800/30 hover:bg-amber-950/60 transition-all">
            <GiftIcon size={11} /> Unlock
          </button>
          <button onClick={() => s.resetChest()} className="flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[11px] font-medium bg-zinc-800/40 text-zinc-400 border border-zinc-700/30 hover:bg-zinc-800/60 transition-all">
            Reset Chest
          </button>
        </div>

        {/* Chest scenarios */}
        <p className="text-[10px] text-[var(--text-muted)] uppercase">Chest Scenarios:</p>
        <div className="grid grid-cols-2 gap-1">
          <button onClick={() => { s.setChestProgress(99); s.sendChestContribution("A", 10); s.sendChestContribution("B", 8); s.sendLike(200); }} className="px-1 py-1 rounded text-[9px] bg-[var(--bg-surface)] text-[var(--text-muted)] border border-[var(--border)] hover:border-[var(--border-light)] transition-all">A Close Win</button>
          <button onClick={() => { s.setChestProgress(99); s.sendChestContribution("B", 10); s.sendChestContribution("A", 8); s.sendLike(200); }} className="px-1 py-1 rounded text-[9px] bg-[var(--bg-surface)] text-[var(--text-muted)] border border-[var(--border)] hover:border-[var(--border-light)] transition-all">B Close Win</button>
          <button onClick={() => { s.setChestProgress(99); s.sendChestContribution("A", 10); s.sendChestContribution("B", 10); s.sendLike(200); }} className="px-1 py-1 rounded text-[9px] bg-[var(--bg-surface)] text-[var(--text-muted)] border border-[var(--border)] hover:border-[var(--border-light)] transition-all">Chest Tie</button>
          <button onClick={() => { s.setChestProgress(99); }} className="px-1 py-1 rounded text-[9px] bg-[var(--bg-surface)] text-[var(--text-muted)] border border-[var(--border)] hover:border-[var(--border-light)] transition-all">Chest 99%</button>
          <button onClick={() => { s.sendLike(10000); }} className="px-1 py-1 rounded text-[9px] bg-pink-950/30 text-pink-400/70 border border-pink-800/10 hover:bg-pink-950/40 transition-all">Like Storm</button>
          <button onClick={() => { s.setChestProgress(99); s.sendChestContribution("A", 10); s.sendChestContribution("B", 8); s.sendChestContribution("B", 5); s.sendLike(200); }} className="px-1 py-1 rounded text-[9px] bg-[var(--bg-surface)] text-[var(--text-muted)] border border-[var(--border)] hover:border-[var(--border-light)] transition-all">Last-Sec Swing</button>
        </div>
      </Collapsible>

      {/* ─── GIFT BRIDGE STATUS ────────────────────────────────── */}
      <Collapsible title="Gift → Engine Bridge" icon={<Link2 size={11} />} defaultOpen>
        <div className="flex items-center justify-between rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] px-3 py-2">
          <span className="text-xs font-medium text-[var(--text-secondary)]">
            {s.giftBridgeActive ? "Bridge Active" : "Bridge Inactive"}
          </span>
          <button
            onClick={() => s.toggleGiftBridge()}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border transition-all ${
              s.giftBridgeActive
                ? "bg-emerald-950/40 text-emerald-400 border-emerald-800/30 hover:bg-emerald-950/60"
                : "bg-zinc-800/40 text-zinc-400 border-zinc-700/30 hover:bg-zinc-800/60"
            }`}>
            {s.giftBridgeActive ? <Link2 size={11} /> : <Link2Off size={11} />}
            {s.giftBridgeActive ? "ON" : "OFF"}
          </button>
        </div>
        {s.giftBridgeActive && (
          <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono text-[var(--text-muted)]">
            <div className="rounded bg-[var(--bg-surface)] border border-[var(--border)] px-2 py-1">
              Gifts: <span className="text-[var(--text-secondary)]">{s.giftsProcessed}</span>
            </div>
            <div className="rounded bg-[var(--bg-surface)] border border-[var(--border)] px-2 py-1">
              Units: <span className="text-[var(--text-secondary)]">{s.unitsSpawned}</span>
            </div>
          </div>
        )}
        <p className="text-[9px] text-[var(--text-muted)] italic">
          When active, sim_t1–sim_t6 gifts spawn units in the arena. T6 triggers Ultimate.
        </p>
      </Collapsible>

      {/* ─── CROWD SIMULATION ────────────────────────────────────── */}
      <Collapsible title="Crowd Simulation" icon={<Users size={11} />} defaultOpen>
        <p className="text-[10px] text-[var(--text-muted)]">
          Simulates audience affluence: random viewers sending likes, comments, and T1–T6 gifts at varying frequency.
        </p>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-[var(--text-muted)] uppercase">Intensity:</span>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => s.setCrowdIntensity(n)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-all ${
                s.crowdIntensity === n
                  ? "bg-[var(--accent)]/20 text-[var(--accent)] border-[var(--accent)]/40"
                  : "bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border)]"
              }`}>
              {n}
            </button>
          ))}
        </div>
        <div className="text-[10px] text-[var(--text-muted)]">
          Level 1 = calm live, Level 5 = intense viral stream
        </div>
        {s.crowdActive ? (
          <button
            onClick={() => s.stopCrowdSimulation()}
            className="flex items-center justify-center gap-1 w-full px-2 py-1.5 rounded text-xs font-medium bg-red-950/40 text-red-400 border border-red-800/30 hover:bg-red-950/60 transition-all">
            <Square size={10} /> Stop Crowd
          </button>
        ) : (
          <button
            onClick={() => s.startCrowdSimulation()}
            disabled={s.scenarioRunning}
            className="flex items-center justify-center gap-1 w-full px-2 py-1.5 rounded text-xs font-medium bg-emerald-950/40 text-emerald-400 border border-emerald-800/30 hover:bg-emerald-950/60 transition-all disabled:opacity-30">
            <Play size={11} /> Start Crowd
          </button>
        )}
      </Collapsible>

      {/* ─── SCENARIOS ──────────────────────────────────────────── */}
      <Collapsible title="Scenarios" icon={<Radio size={11} />} defaultOpen>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            ["T1_SPAM", "T1 Spam"],
            ["T2_FIRE_SUPPORT", "T2 Fire Support"],
            ["HEALER_SUPPORT", "Healer Support"],
            ["BREAKER_PUSH", "Breaker Push"],
            ["BOSS_SUMMON", "Boss Summon"],
            ["ULTIMATE_EVENT", "Ultimate Event"],
            ["TEAM_A_PUSH", "Team A Push"],
            ["TEAM_B_PUSH", "Team B Push"],
            ["MASS_GIFT_BURST", "Mass Gift Burst"],
            ["LIKE_STORM", "Like Storm"],
          ].map(([id, label]) => (
            <button key={id} onClick={() => s.runScenario(id)} disabled={s.scenarioRunning} className="px-2 py-1.5 rounded text-[11px] font-medium bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--border-light)] transition-all disabled:opacity-30">
              {label}
            </button>
          ))}
        </div>
        {/* Realistic Live */}
        <div className="space-y-1.5 pt-1">
          <p className="text-[10px] text-[var(--text-muted)] uppercase">Realistic Live:</p>
          <button onClick={() => s.runRealisticLive(60, 100, 10, 20, 5)} disabled={s.scenarioRunning} className="w-full px-2 py-1.5 rounded text-[11px] font-medium bg-emerald-950/30 text-emerald-400 border border-emerald-800/20 hover:bg-emerald-950/50 transition-all disabled:opacity-30">
            100 viewers, 60s, high likes
          </button>
        </div>
        {/* Chaos */}
        <div className="space-y-1.5">
          <p className="text-[10px] text-[var(--text-muted)] uppercase">Chaos Mode:</p>
          <div className="grid grid-cols-3 gap-1.5">
            <button onClick={() => s.runChaos(30)} disabled={s.scenarioRunning} className="px-1 py-1.5 rounded text-[10px] font-medium bg-red-950/30 text-red-400 border border-red-800/20 hover:bg-red-950/50 transition-all disabled:opacity-30">30s</button>
            <button onClick={() => s.runChaos(300)} disabled={s.scenarioRunning} className="px-1 py-1.5 rounded text-[10px] font-medium bg-red-950/30 text-red-400 border border-red-800/20 hover:bg-red-950/50 transition-all disabled:opacity-30">5min</button>
            <button onClick={() => s.runChaos(1800)} disabled={s.scenarioRunning} className="px-1 py-1.5 rounded text-[10px] font-medium bg-red-950/30 text-red-400 border border-red-800/20 hover:bg-red-950/50 transition-all disabled:opacity-30">30min</button>
          </div>
        </div>
        {s.scenarioRunning && (
          <button onClick={() => s.stopAllScenarios()} className="flex items-center justify-center gap-1 w-full px-2 py-1.5 rounded text-[11px] font-medium bg-red-900/50 text-red-400 border border-red-700/40 hover:bg-red-900/70 transition-all">
            <Square size={10} /> Stop All Scenarios
          </button>
        )}
      </Collapsible>

      {/* ─── FOLLOW / SHARE / JOIN ──────────────────────────────── */}
      <Collapsible title="Follow / Share / Join" icon={<UserPlus size={11} />}>
        <div className="grid grid-cols-3 gap-1.5">
          <button onClick={() => s.sendFollow()} className="flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-medium bg-emerald-950/40 text-emerald-400 border border-emerald-800/30 hover:bg-emerald-950/60 transition-all">
            <UserPlus size={11} /> Follow
          </button>
          <button onClick={() => s.sendShare()} className="flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-medium bg-cyan-950/40 text-cyan-400 border border-cyan-800/30 hover:bg-cyan-950/60 transition-all">
            <Share2 size={11} /> Share
          </button>
          <button onClick={() => s.sendJoin()} className="flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-medium bg-lime-950/40 text-lime-400 border border-lime-800/30 hover:bg-lime-950/60 transition-all">
            <LogIn size={11} /> Join
          </button>
        </div>
      </Collapsible>

      {/* ─── MULTI-VIEWER GENERATOR ──────────────────────────────── */}
      <Collapsible title="Multi-Viewer Generator" icon={<Users size={11} />}>
        <div className="grid grid-cols-4 gap-1.5">
          {[10, 50, 100, 500].map((n) => (
            <button key={n} onClick={() => s.generateViewers(n)} className="px-1 py-1.5 rounded text-[11px] font-medium bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--border-light)] transition-all">{n}</button>
          ))}
        </div>
        {s.generatedViewers.length > 0 && (
          <div className="text-[10px] text-[var(--text-muted)]">
            Generated: {s.generatedViewers.length} viewers
            <button onClick={() => s.resetViewers()} className="ml-2 text-red-400 hover:underline">reset</button>
          </div>
        )}
        {s.generatedViewers.length > 0 && (
          <div className="max-h-24 overflow-y-auto space-y-0.5">
            {s.generatedViewers.slice(-10).map((v) => (
              <button key={v.userId} onClick={() => s.selectViewer(v)} className="block w-full text-left px-2 py-0.5 rounded text-[10px] font-mono hover:bg-[var(--bg-surface)] transition-colors">
                <span className={v.team === "A" ? "text-blue-400" : v.team === "B" ? "text-red-400" : "text-[var(--text-muted)]"}>{v.team}</span> {v.username}
              </button>
            ))}
          </div>
        )}
      </Collapsible>

      {/* ─── RECORD / REPLAY ────────────────────────────────────── */}
      <Collapsible title="Record / Replay" icon={<Disc size={11} />}>
        <div className="grid grid-cols-3 gap-1.5">
          <button onClick={() => (s.recording ? s.stopRecording() : s.startRecording())} className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-medium border transition-all ${s.recording ? "bg-red-900/50 text-red-400 border-red-700/40" : "bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--border-light)]"}`}>
            <Disc size={11} className={s.recording ? "fill-current" : ""} />
            {s.recording ? "Stop" : "Rec"}
          </button>
          <button onClick={() => s.replay()} disabled={!s.lastRecording || s.lastRecording.events.length === 0} className="flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-medium bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--border-light)] transition-all disabled:opacity-30">
            <Play size={11} /> Replay
          </button>
          <button onClick={() => s.clearEventLog()} className="flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-medium bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--border-light)] transition-all">
            <Trash2 size={11} /> Clear
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-[var(--text-muted)] uppercase">Speed:</span>
          {[0.25, 1, 2, 10].map((sp) => (
            <button key={sp} onClick={() => s.setReplaySpeed(sp)} className={`px-1.5 py-0.5 rounded text-[10px] font-mono border transition-all ${s.replaySpeed === sp ? "bg-[var(--accent)]/20 text-[var(--accent)] border-[var(--accent)]/40" : "bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border)]"}`}>{sp}x</button>
          ))}
          <button onClick={() => s.setReplaySpeed(0)} className={`px-1.5 py-0.5 rounded text-[10px] font-mono border transition-all ${s.replaySpeed === 0 ? "bg-[var(--accent)]/20 text-[var(--accent)] border-[var(--accent)]/40" : "bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border)]"}`}>Instant</button>
        </div>
        <div className="text-[10px] text-[var(--text-muted)] font-mono">
          {s.recording ? `Recording: ${s.recordedCount} events` : s.lastRecording ? `Last: ${s.lastRecording.events.length} events` : "No recording"}
        </div>
      </Collapsible>

      {/* ─── STRESS TESTS ───────────────────────────────────────── */}
      <Collapsible title="Stress Tests" icon={<Gauge size={11} />}>
        <div className="grid grid-cols-2 gap-1.5">
          <button onClick={() => { for (let i = 0; i < 10000; i++) s.sendLike(1); }} className="px-2 py-1.5 rounded text-[11px] font-medium bg-pink-950/30 text-pink-400 border border-pink-800/20 hover:bg-pink-950/50 transition-all">10K Likes Burst</button>
          <button onClick={() => { for (let i = 0; i < 100; i++) s.sendGiftByTier("T1"); }} className="px-2 py-1.5 rounded text-[11px] font-medium bg-orange-950/30 text-orange-400 border border-orange-800/20 hover:bg-orange-950/50 transition-all">100 Gifts Burst</button>
          <button onClick={() => { for (let i = 0; i < 500; i++) s.sendComment(["RED", "BLUE"][i % 2]); }} className="px-2 py-1.5 rounded text-[11px] font-medium bg-blue-950/30 text-blue-400 border border-blue-800/20 hover:bg-blue-950/50 transition-all">500 Comments</button>
          <button onClick={() => s.startLikesPerSec(1000)} disabled={s.likesPerSecActive} className="px-2 py-1.5 rounded text-[11px] font-medium bg-amber-950/30 text-amber-400 border border-amber-800/20 hover:bg-amber-950/50 transition-all disabled:opacity-30">1000 evts/s</button>
        </div>
        <div className="text-[10px] font-mono text-[var(--text-muted)] space-y-0.5">
          <div>Sent: {s.metrics.eventsTotal} | Dropped: {s.metrics.droppedEvents} | Errors: {s.metrics.errors}</div>
          <div>Rate: {s.metrics.eventsPerSec}/s</div>
        </div>
      </Collapsible>

      {/* ─── NETWORK / ADAPTER TESTS ─────────────────────────────── */}
      <Collapsible title="Network / Adapter Tests" icon={<Wifi size={11} />}>
        <div className="grid grid-cols-2 gap-1.5">
          <button onClick={() => s.simulateDisconnect()} className="flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-medium bg-red-950/40 text-red-400 border border-red-800/30 hover:bg-red-950/60 transition-all">
            <WifiOff size={11} /> Disconnect
          </button>
          <button onClick={() => s.simulateReconnect()} className="flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-medium bg-emerald-950/40 text-emerald-400 border border-emerald-800/30 hover:bg-emerald-950/60 transition-all">
            <Wifi size={11} /> Reconnect
          </button>
          <button onClick={() => s.simulateError()} className="flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-medium bg-red-950/30 text-red-400 border border-red-800/20 hover:bg-red-950/50 transition-all">
            <AlertTriangle size={11} /> Error
          </button>
          <button onClick={() => s.dropNextEvent()} className="flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-medium bg-amber-950/30 text-amber-400 border border-amber-800/20 hover:bg-amber-950/50 transition-all">
            Drop Next
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-[var(--text-muted)] uppercase">Latency:</span>
          {[0, 100, 500, 2000, 5000].map((ms) => (
            <button key={ms} onClick={() => s.setLatency(ms)} className={`px-1.5 py-0.5 rounded text-[10px] font-mono border transition-all ${s.latencyMs === ms ? "bg-[var(--accent)]/20 text-[var(--accent)] border-[var(--accent)]/40" : "bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border)]"}`}>{ms}ms</button>
          ))}
        </div>
      </Collapsible>

      {/* ─── ADVANCED ───────────────────────────────────────────── */}
      <Collapsible title="Advanced / Debug" icon={<Bug size={11} />}>
        {/* Raw gift */}
        <p className="text-[10px] text-[var(--text-muted)] uppercase">Raw Gift Event:</p>
        <div className="grid grid-cols-3 gap-1.5">
          <input value={s.rawGiftId} onChange={(e) => s.setRawGiftId(e.target.value)} placeholder="gift id" className="px-1.5 py-1.5 rounded text-[11px] bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] outline-none" />
          <input value={s.rawGiftName} onChange={(e) => s.setRawGiftName(e.target.value)} placeholder="gift name" className="px-1.5 py-1.5 rounded text-[11px] bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] outline-none" />
          <input type="number" min={1} value={s.rawGiftRepeat} onChange={(e) => s.setRawGiftRepeat(Math.max(1, Number(e.target.value)))} className="px-1.5 py-1.5 rounded text-[11px] bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] outline-none" />
        </div>
        <button onClick={() => s.sendRawGift()} className="w-full px-2 py-1.5 rounded text-xs font-medium bg-orange-950/40 text-orange-400 border border-orange-800/30 hover:bg-orange-950/60 transition-all">Send Raw Gift</button>

        {/* Duplicate / out-of-order */}
        <p className="text-[10px] text-[var(--text-muted)] uppercase pt-1">Edge Cases:</p>
        <div className="grid grid-cols-2 gap-1.5">
          <button onClick={() => s.duplicateLastEvent()} className="flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[11px] font-medium bg-zinc-800/40 text-zinc-400 border border-zinc-700/30 hover:bg-zinc-800/60 transition-all">
            <Copy size={11} /> Dup Last Event
          </button>
          <button onClick={() => s.dropNextEvent()} className="flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[11px] font-medium bg-zinc-800/40 text-zinc-400 border border-zinc-700/30 hover:bg-zinc-800/60 transition-all">
            Drop Next
          </button>
        </div>

        {/* Malformed */}
        <p className="text-[10px] text-[var(--text-muted)] uppercase pt-1">Malformed Events:</p>
        <div className="grid grid-cols-1 gap-1">
          {[
            ["UNKNOWN_GIFT", "Unknown Gift"],
            ["MISSING_USER", "Missing User"],
            ["INVALID_REPEAT", "Invalid Repeat Count"],
            ["EMPTY_COMMENT", "Empty Comment"],
            ["MISSING_GIFT_NAME", "Missing Gift Name"],
          ].map(([id, label]) => (
            <button key={id} onClick={() => s.sendMalformed(id)} className="px-2 py-1 rounded text-[10px] font-medium bg-red-950/20 text-red-400/70 border border-red-800/10 hover:bg-red-950/40 transition-all">
              {label}
            </button>
          ))}
        </div>
      </Collapsible>

      {/* ─── RESET CONTROLS ─────────────────────────────────────── */}
      <Collapsible title="Reset Controls" icon={<RotateCcw size={11} />}>
        <div className="grid grid-cols-2 gap-1.5">
          <button onClick={() => s.clearEventLog()} className="px-2 py-1.5 rounded text-[11px] font-medium bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--border-light)] transition-all">Clear Event Log</button>
          <button onClick={() => s.resetSimulator()} className="px-2 py-1.5 rounded text-[11px] font-medium bg-red-950/30 text-red-400 border border-red-800/20 hover:bg-red-950/50 transition-all">Reset Simulator</button>
          <button onClick={() => s.resetViewers()} className="px-2 py-1.5 rounded text-[11px] font-medium bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--border-light)] transition-all">Reset Viewers</button>
          <button onClick={() => s.stopAllScenarios()} className="px-2 py-1.5 rounded text-[11px] font-medium bg-amber-950/30 text-amber-400 border border-amber-800/20 hover:bg-amber-950/50 transition-all">Stop Scenarios</button>
        </div>
      </Collapsible>
    </div>
  );
}
