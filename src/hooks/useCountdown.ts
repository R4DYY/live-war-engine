import { useEffect, useState } from "react";
import { useEngineStore } from "@/state/engineStore";
import { getRemainingMs } from "@/engine/battleEngine";

export function useCountdown() {
  const session = useEngineStore((s) => s.session);
  const loop = useEngineStore((s) => s.loop);
  const nextRoundAt = loop?.nextRoundAt;
  const phase = loop?.phase;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);

  const remainingMs = session?.status === "RUNNING" ? getRemainingMs(session, now) : 0;
  const intermissionMs = phase === "INTERMISSION" && nextRoundAt ? Math.max(0, nextRoundAt - now) : 0;

  return {
    remainingMs,
    intermissionMs,
    isInIntermission: phase === "INTERMISSION",
  };
}

export function formatTime(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
