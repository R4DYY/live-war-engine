import { Vote } from "lucide-react";

interface NextDuelPlaceholderProps {
  visible: boolean;
}

export function NextDuelPlaceholder({ visible }: NextDuelPlaceholderProps) {
  if (!visible) return null;

  return (
    <div
      className="flex items-center justify-center gap-1.5 py-1 px-2.5 rounded-full"
      style={{
        background: "rgba(20,184,166,0.1)",
        border: "1.5px solid rgba(20,184,166,0.25)",
        boxShadow: "0 0 8px rgba(20,184,166,0.1)",
      }}
    >
      <div
        className="w-4 h-4 rounded flex items-center justify-center shrink-0"
        style={{ background: "rgba(20,184,166,0.15)", border: "1.5px solid rgba(20,184,166,0.3)" }}
      >
        <Vote size={9} style={{ color: "#14b8a6" }} />
      </div>
      <span
        className="text-[8px] font-black uppercase tracking-wider"
        style={{ color: "rgba(20,184,166,0.7)", textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
      >
        Next Duel Vote After This Battle
      </span>
    </div>
  );
}
