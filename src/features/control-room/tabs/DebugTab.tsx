import DevControls from "@/features/control-room/DevControls";
import EventLog from "@/features/control-room/EventLog";
import LiveEventInspector from "@/features/control-room/LiveEventInspector";
import BattleConfigPanel from "@/features/control-room/BattleConfigPanel";
import { Panel, PanelHeader } from "@/features/control-room/ui";
import { Bug, Terminal, Eye, Settings } from "lucide-react";

export function DebugTab() {
  return (
    <div className="grid grid-cols-12 gap-4 max-w-[1600px]">
      <div className="col-span-12 lg:col-span-4 space-y-4">
        <Panel>
          <PanelHeader icon={<Bug size={13} />} title="Dev Controls" badge="DENSE" badgeColor="var(--danger)" />
          <DevControls />
        </Panel>
        <Panel>
          <PanelHeader icon={<Settings size={13} />} title="Advanced Battle Config" />
          <BattleConfigPanel />
        </Panel>
      </div>

      <div className="col-span-12 lg:col-span-4 space-y-4">
        <Panel>
          <PanelHeader icon={<Terminal size={13} />} title="Engine Event Log" />
          <EventLog />
        </Panel>
      </div>

      <div className="col-span-12 lg:col-span-4 space-y-4">
        <Panel>
          <PanelHeader icon={<Eye size={13} />} title="Event Inspector" />
          <LiveEventInspector />
        </Panel>
      </div>
    </div>
  );
}
