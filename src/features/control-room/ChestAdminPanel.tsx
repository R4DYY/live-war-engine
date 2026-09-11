import { useEffect, useState } from "react";
import { chestManager } from "@/engine/chestManager";
import type { ChestRewardChoice, ChestVisualState } from "@/engine/chestManager";
import { useEngineStore } from "@/state/engineStore";
import { Gift, Play } from "lucide-react";

const REWARD_OPTIONS: Array<{ value: ChestRewardChoice; label: string }> = [
  { value: "BASE_REPAIR", label: "BASE HEAL" },
  { value: "SPAWN_MULTIPLIER", label: "MEGA ARMY" },
  { value: "GIANT", label: "GIANT TROOP" },
  { value: "SHIELD", label: "WAR SHIELD" },
  { value: "RAGE", label: "RAGE MODE" },
];

export default function ChestAdminPanel() {
  const engineStatus = useEngineStore((state) => state.engineStatus);
  const forceOpenChest = useEngineStore((state) => state.forceOpenChest);
  const [cycle, setCycle] = useState(chestManager.getCycle());
  const [state, setState] = useState<ChestVisualState>(chestManager.getVisualState());
  const [reward, setReward] = useState<ChestRewardChoice>("SPAWN_MULTIPLIER");
  const [multiplier, setMultiplier] = useState(2);
  const [recipient, setRecipient] = useState<"AUTO" | "A" | "B">("AUTO");

  useEffect(() => {
    const update = (): void => {
      setCycle(chestManager.getCycle());
      setState(chestManager.getVisualState());
    };
    const unsubscribe = chestManager.subscribe(() => update());
    const timer = setInterval(update, 500);
    update();
    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, []);

  const config = chestManager.getConfig();
  const isRunning = engineStatus === "RUNNING" || engineStatus === "PAUSED";
  const isLocked = !cycle || cycle.unlocked || state === "REWARD_ACTIVE";

  const open = (): void => {
    forceOpenChest({
      rewardType: reward,
      multiplier: reward === "SPAWN_MULTIPLIER" ? multiplier : undefined,
      team: recipient,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
          <Gift size={14} className="text-[var(--warning)]" />
          Chest Admin
        </h2>
        <span className={`text-[10px] font-bold uppercase ${isRunning ? "text-emerald-400" : "text-zinc-500"}`}>
          {isRunning ? "LIVE" : "OFFLINE"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <Metric label="Current Likes" value={`${cycle?.currentLikes ?? 0}`} />
        <Metric label="Threshold" value={`${config?.likeThreshold ?? 0}`} />
        <Metric label="Team A" value={`${cycle?.teamAContributions ?? 0}`} color="var(--team-a)" />
        <Metric label="Team B" value={`${cycle?.teamBContributions ?? 0}`} color="var(--team-b)" />
      </div>

      <div className="flex items-center justify-between rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] px-3 py-2">
        <span className="text-xs text-[var(--text-muted)]">State</span>
        <span className="text-xs font-mono font-bold text-[var(--warning)]">{state}</span>
      </div>

      <label className="block space-y-1">
        <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Reward</span>
        <select value={reward} onChange={(event) => setReward(event.target.value as ChestRewardChoice)} className="input-field">
          {REWARD_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>

      {reward === "SPAWN_MULTIPLIER" && (
        <div className="flex gap-2">
          {[2, 3].map((value) => (
            <button
              key={value}
              onClick={() => setMultiplier(value)}
              className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-bold transition-all ${multiplier === value ? "border-amber-400/60 bg-amber-400/15 text-amber-300" : "border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-muted)]"}`}
            >
              x{value}
            </button>
          ))}
        </div>
      )}

      <label className="block space-y-1">
        <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Recipient</span>
        <select value={recipient} onChange={(event) => setRecipient(event.target.value as "AUTO" | "A" | "B")} className="input-field">
          <option value="AUTO">AUTO / CURRENT WINNER</option>
          <option value="A">TEAM A</option>
          <option value="B">TEAM B</option>
        </select>
      </label>

      <button
        onClick={open}
        disabled={!isRunning || isLocked}
        className="w-full flex items-center justify-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-2 text-xs font-bold uppercase tracking-wide text-amber-300 transition-all hover:bg-amber-500/25 disabled:cursor-not-allowed disabled:opacity-35"
      >
        <Play size={12} />
        Open Chest Now
      </button>
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] p-2">
      <div className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">{label}</div>
      <div className="mt-0.5 text-sm font-mono font-bold" style={{ color: color ?? "var(--text-primary)" }}>{value}</div>
    </div>
  );
}
