import LiveSimulatorPanel from "@/features/control-room/LiveSimulatorPanel";
import LiveEventStream from "@/features/control-room/LiveEventStream";
import { Panel, PanelHeader } from "@/features/control-room/ui";
import { FlaskConical, Radio } from "lucide-react";

export function SimulatorTab() {
  return (
    <div className="grid grid-cols-12 gap-4 max-w-[1600px]">
      <div className="col-span-12 lg:col-span-7 space-y-4">
        <Panel>
          <PanelHeader icon={<FlaskConical size={13} />} title="Live Simulator" badge="DEV TOOL" badgeColor="var(--warning)" />
          <LiveSimulatorPanel />
        </Panel>
      </div>
      <div className="col-span-12 lg:col-span-5 space-y-4">
        <Panel>
          <PanelHeader icon={<Radio size={13} />} title="Live Event Stream" />
          <LiveEventStream />
        </Panel>
      </div>
    </div>
  );
}
