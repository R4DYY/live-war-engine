import { useLiveStore } from "@/live/useLiveStore";
import { chestManager } from "@/engine/chestManager";
import { Panel, PanelHeader, Metric } from "@/features/control-room/ui";
import { Gift, MessageSquare, Heart, UserPlus, Share2, Link2, Link2Off, Shield } from "lucide-react";

const TIER_META: Array<{ tier: string; role: string; simId: string; simName: string; price: number }> = [
  { tier: "T1", role: "BASIC", simId: "sim_t1", simName: "Sim T1 Basic", price: 0.01 },
  { tier: "T2", role: "SPECIALIST", simId: "sim_t2", simName: "Sim T2 Specialist", price: 0.10 },
  { tier: "T3", role: "HEALER", simId: "sim_t3", simName: "Sim T3 Healer", price: 0.50 },
  { tier: "T4", role: "BREAKER", simId: "sim_t4", simName: "Sim T4 Breaker", price: 2 },
  { tier: "T5", role: "BOSS", simId: "sim_t5", simName: "Sim T5 Boss", price: 5 },
  { tier: "T6", role: "ULTIMATE", simId: "sim_t6", simName: "Sim T6 Ultimate", price: 20 },
];

const COMMENT_KEYWORDS: Record<"A" | "B", string[]> = {
  A: ["RED", "A", "TEAM A"],
  B: ["BLUE", "B", "TEAM B"],
};

export function InputsTab() {
  const live = useLiveStore();
  const chestConfig = chestManager.getConfig();

  return (
    <div className="grid grid-cols-12 gap-4 max-w-[1400px]">
      {/* COMBAT GIFT MAPPING */}
      <div className="col-span-12 lg:col-span-8 space-y-4">
        <Panel>
          <PanelHeader icon={<Gift size={13} className="text-orange-400" />} title="Combat Gift Mapping" badge="T1–T6" badgeColor="var(--warning)" />
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] uppercase text-[var(--text-muted)] border-b border-[var(--border)]">
                  <th className="text-left py-2 px-2">Tier</th>
                  <th className="text-left py-2 px-2">Role</th>
                  <th className="text-left py-2 px-2">Sim Gift ID</th>
                  <th className="text-left py-2 px-2">Sim Gift Name</th>
                  <th className="text-right py-2 px-2">Target Price</th>
                  <th className="text-center py-2 px-2">Enabled</th>
                  <th className="text-center py-2 px-2">Test</th>
                </tr>
              </thead>
              <tbody>
                {TIER_META.map((t) => (
                  <tr key={t.tier} className="border-b border-[var(--border)]/50 hover:bg-[var(--bg-surface)]">
                    <td className="py-2 px-2 font-mono font-bold text-[var(--text-primary)]">{t.tier}</td>
                    <td className="py-2 px-2 text-[var(--text-secondary)]">{t.role}</td>
                    <td className="py-2 px-2 font-mono text-[var(--text-muted)]">{t.simId}</td>
                    <td className="py-2 px-2 text-[var(--text-secondary)]">{t.simName}</td>
                    <td className="py-2 px-2 text-right font-mono text-[var(--text-muted)]">€{t.price}</td>
                    <td className="py-2 px-2 text-center">
                      <span className="inline-flex items-center gap-1 text-[var(--accent)]">
                        <Shield size={10} /> ON
                      </span>
                    </td>
                    <td className="py-2 px-2 text-center">
                      <button onClick={() => live.sendGiftByTier(t.tier)} className="px-2 py-1 rounded text-[10px] font-bold bg-orange-950/30 text-orange-400 border border-orange-800/20 hover:bg-orange-950/50 transition-all">
                        Trigger
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-[var(--text-muted)] italic mt-2">sim_* IDs are placeholders. Real TikTok gift IDs will replace these when the TikTok adapter is connected.</p>
        </Panel>

        {/* TEAM TARGETING */}
        <Panel>
          <PanelHeader icon={<Link2 size={13} />} title="Team Targeting" />
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] p-3">
                <p className="text-[10px] uppercase text-[var(--text-muted)] mb-1">Default Rule</p>
                <p className="text-xs text-[var(--text-secondary)]">Viewer's assigned team</p>
                <p className="text-[10px] text-[var(--text-muted)] mt-1">Gifts spawn units for the viewer's team. Unassigned viewers use the test team.</p>
              </div>
              <div className="rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] p-3">
                <p className="text-[10px] uppercase text-[var(--text-muted)] mb-1">Test Team</p>
                <div className="flex gap-2 mt-1">
                  {(["NONE", "A", "B"] as const).map((t) => (
                    <button key={t} onClick={() => live.setTeam(t)} className={`px-2 py-1 rounded text-[10px] font-bold border transition-all ${live.team === t ? (t === "A" ? "bg-red-900/50 text-red-400 border-red-700/40" : t === "B" ? "bg-blue-900/50 text-blue-400 border-blue-700/40" : "bg-zinc-700/50 text-zinc-300 border-zinc-600/40") : "bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border)]"}`}>
                      {t === "NONE" ? "No Team" : `Team ${t}`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Panel>

        {/* CHEST GIFT MAPPING */}
        <Panel>
          <PanelHeader icon={<Gift size={13} className="text-amber-400" />} title="Chest Gift Mapping" badge="Separate from T1–T6" badgeColor="var(--warning)" />
          <div className="grid grid-cols-2 gap-3">
            {([
              { key: "red", label: "RED CHEST GIFT", name: chestConfig?.chestGiftMappings.red.giftName ?? "Cheer You Up", coins: chestConfig?.chestGiftMappings.red.coinValue ?? 9, pts: chestConfig?.chestGiftMappings.red.points ?? 1, color: "var(--team-a)" },
              { key: "blue", label: "BLUE CHEST GIFT", name: chestConfig?.chestGiftMappings.blue.giftName ?? "Club Power", coins: chestConfig?.chestGiftMappings.blue.coinValue ?? 9, pts: chestConfig?.chestGiftMappings.blue.points ?? 1, color: "var(--team-b)" },
            ] as const).map((g) => (
              <div key={g.key} className="rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] p-3 space-y-2">
                <p className="text-[10px] font-bold uppercase" style={{ color: g.color }}>{g.label}</p>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-[var(--text-muted)]">Gift Name</span>
                    <span className="text-[var(--text-secondary)]">{g.name}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[var(--text-muted)]">Coin Value</span>
                    <span className="font-mono text-[var(--text-secondary)]">{g.coins} coins</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[var(--text-muted)]">Chest Points</span>
                    <span className="font-mono font-bold" style={{ color: g.color }}>+{g.pts}</span>
                  </div>
                </div>
                <button onClick={() => live.sendChestContribution(g.key === "red" ? "A" : "B", 1)} className="w-full px-2 py-1.5 rounded text-[11px] font-medium border transition-all" style={{ background: `color-mix(in srgb, ${g.color} 15%, transparent)`, borderColor: `color-mix(in srgb, ${g.color} 30%, transparent)`, color: g.color }}>
                  Test +1 Point
                </button>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-[var(--text-muted)] italic mt-2">1 valid chest gift = +1 chest point. These mappings are separate from combat T1–T6 gifts.</p>
        </Panel>
      </div>

      {/* RIGHT COLUMN: Comments + Likes + Follow/Share */}
      <div className="col-span-12 lg:col-span-4 space-y-4">
        {/* COMMENT MAPPING */}
        <Panel>
          <PanelHeader icon={<MessageSquare size={13} className="text-blue-400" />} title="Comment / Team Join" />
          <div className="space-y-3">
            {(["A", "B"] as const).map((team) => (
              <div key={team} className="rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] p-2.5">
                <p className="text-[10px] font-bold uppercase mb-1.5" style={{ color: team === "A" ? "var(--team-a)" : "var(--team-b)" }}>
                  Team {team}
                </p>
                <div className="flex flex-wrap gap-1">
                  {COMMENT_KEYWORDS[team].map((kw) => (
                    <span key={kw} className="px-2 py-0.5 rounded text-[10px] font-mono bg-[var(--bg-elevated)] text-[var(--text-secondary)] border border-[var(--border)]">{kw}</span>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex gap-2">
              <input
                value={live.commentText}
                onChange={(e) => live.setCommentText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && live.sendComment()}
                placeholder="Test comment..."
                className="flex-1 px-2 py-1.5 rounded text-xs bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              />
              <button onClick={() => live.sendComment()} className="px-3 py-1.5 rounded text-xs font-medium bg-blue-950/40 text-blue-400 border border-blue-800/30 hover:bg-blue-950/60 transition-all">Send</button>
            </div>
          </div>
        </Panel>

        {/* LIKE CONFIGURATION */}
        <Panel>
          <PanelHeader icon={<Heart size={13} className="text-pink-400" />} title="Like Configuration" />
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Metric label="Threshold" value={chestConfig?.likeThreshold.toLocaleString() ?? "—"} />
              <Metric label="Likes Enabled" value={chestConfig?.enabled ? "ON" : "OFF"} color={chestConfig?.enabled ? "var(--accent)" : "var(--text-muted)"} />
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {[1, 100, 1000, 10000].map((n) => (
                <button key={n} onClick={() => live.sendLike(n)} className="px-1 py-1.5 rounded text-[10px] font-medium bg-pink-950/30 text-pink-400 border border-pink-800/20 hover:bg-pink-950/50 transition-all">
                  {n >= 1000 ? `+${n / 1000}K` : `+${n}`}
                </button>
              ))}
            </div>
          </div>
        </Panel>

        {/* FOLLOW / SHARE */}
        <Panel>
          <PanelHeader icon={<UserPlus size={13} className="text-emerald-400" />} title="Follow / Share" />
          <div className="space-y-2">
            <div className="rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] p-2.5">
              <p className="text-[10px] uppercase text-[var(--text-muted)] mb-1">Current Effect</p>
              <p className="text-xs text-[var(--text-muted)]">No gameplay effect</p>
              <p className="text-[10px] text-[var(--text-muted)] mt-1">Slots available for future bonus configuration.</p>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button onClick={() => live.sendFollow()} className="flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-medium bg-emerald-950/40 text-emerald-400 border border-emerald-800/30 hover:bg-emerald-950/60 transition-all">
                <UserPlus size={11} /> Follow
              </button>
              <button onClick={() => live.sendShare()} className="flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-medium bg-cyan-950/40 text-cyan-400 border border-cyan-800/30 hover:bg-cyan-950/60 transition-all">
                <Share2 size={11} /> Share
              </button>
            </div>
          </div>
        </Panel>

        {/* GIFT BRIDGE */}
        <Panel>
          <PanelHeader icon={live.giftBridgeActive ? <Link2 size={13} className="text-emerald-400" /> : <Link2Off size={13} className="text-zinc-500" />} title="Gift → Engine Bridge" badge={live.giftBridgeActive ? "ACTIVE" : "INACTIVE"} badgeColor={live.giftBridgeActive ? "var(--accent)" : "var(--text-muted)"} />
          <button onClick={() => live.toggleGiftBridge()} className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border transition-all ${live.giftBridgeActive ? "bg-emerald-950/40 text-emerald-400 border-emerald-800/30 hover:bg-emerald-950/60" : "bg-zinc-800/40 text-zinc-400 border-zinc-700/30 hover:bg-zinc-800/60"}`}>
            {live.giftBridgeActive ? <><Link2 size={12} /> Bridge ON</> : <><Link2Off size={12} /> Bridge OFF</>}
          </button>
          {live.giftBridgeActive && (
            <div className="grid grid-cols-2 gap-2 mt-2">
              <Metric label="Gifts Processed" value={live.giftsProcessed} />
              <Metric label="Units Spawned" value={live.unitsSpawned} />
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
