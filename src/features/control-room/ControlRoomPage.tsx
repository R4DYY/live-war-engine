import { useState, useEffect } from "react";
import { useLiveStore } from "@/live/useLiveStore";
import { LiveOpsTab } from "@/features/control-room/tabs/LiveOpsTab";
import { InputsTab } from "@/features/control-room/tabs/InputsTab";
import { SimulatorTab } from "@/features/control-room/tabs/SimulatorTab";
import { DebugTab } from "@/features/control-room/tabs/DebugTab";
import { BattlePreviewOverlay } from "@/features/control-room/BattlePreviewOverlay";
import { ExternalLink, Eye, Zap, Radio, Settings, FlaskConical, Bug } from "lucide-react";

type TabId = "LIVE_OPS" | "INPUTS" | "SIMULATOR" | "DEBUG";

const TABS: Array<{ id: TabId; label: string; icon: typeof Radio }> = [
  { id: "LIVE_OPS", label: "LIVE OPS", icon: Radio },
  { id: "INPUTS", label: "INPUTS", icon: Settings },
  { id: "SIMULATOR", label: "SIMULATOR", icon: FlaskConical },
  { id: "DEBUG", label: "DEBUG", icon: Bug },
];

export default function ControlRoomPage() {
  const [activeTab, setActiveTab] = useState<TabId>("LIVE_OPS");
  const [previewOpen, setPreviewOpen] = useState(false);
  const init = useLiveStore((s) => s.init);

  useEffect(() => { init(); }, [init]);

  const openBattleView = () => window.open("/battle", "_blank");

  return (
    <div className="min-h-screen bg-[var(--bg-root)]">
      <header className="sticky top-0 z-40 flex items-center justify-between px-4 md:px-6 py-3 bg-[var(--bg-panel)] border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--accent)] flex items-center justify-center shrink-0">
            <Zap size={18} className="text-black" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight leading-none">LIVE WAR ENGINE</h1>
            <p className="text-[10px] text-[var(--text-muted)] leading-tight mt-0.5">Control Room V2</p>
          </div>
        </div>

        <nav className="flex items-center gap-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 md:px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                  active
                    ? "bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/30"
                    : "text-[var(--text-muted)] border border-transparent hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
                }`}
              >
                <Icon size={13} />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setPreviewOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--bg-elevated)] text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--border-light)] transition-all"
          >
            <Eye size={13} />
            <span className="hidden md:inline">Preview</span>
          </button>
          <button
            onClick={openBattleView}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--bg-elevated)] text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--border-light)] transition-all"
          >
            <ExternalLink size={13} />
            <span className="hidden md:inline">Battle View</span>
          </button>
        </div>
      </header>

      <main className="p-4 md:p-6">
        {activeTab === "LIVE_OPS" && <LiveOpsTab />}
        {activeTab === "INPUTS" && <InputsTab />}
        {activeTab === "SIMULATOR" && <SimulatorTab />}
        {activeTab === "DEBUG" && <DebugTab />}
      </main>

      <BattlePreviewOverlay open={previewOpen} onClose={() => setPreviewOpen(false)} />
    </div>
  );
}
