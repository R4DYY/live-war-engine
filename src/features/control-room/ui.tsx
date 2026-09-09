export function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] p-4 ${className}`}>
      {children}
    </div>
  );
}

export function PanelHeader({
  icon,
  title,
  badge,
  badgeColor,
}: {
  icon?: React.ReactNode;
  title: string;
  badge?: string;
  badgeColor?: string;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
        {icon}
        {title}
      </h2>
      {badge && (
        <span
          className="text-[10px] font-bold uppercase px-2 py-0.5 rounded"
          style={{
            color: badgeColor ?? "var(--text-muted)",
            background: badgeColor ? `color-mix(in srgb, ${badgeColor} 15%, transparent)` : "var(--bg-elevated)",
          }}
        >
          {badge}
        </span>
      )}
    </div>
  );
}

export function StatRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-[var(--text-muted)]">{label}</span>
      <span className="text-xs font-mono font-medium text-[var(--text-primary)]">{children}</span>
    </div>
  );
}

export function StatusDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
      <span className="text-xs font-medium" style={{ color }}>{label}</span>
    </span>
  );
}

export function Metric({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] p-2">
      <div className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">{label}</div>
      <div className="mt-0.5 text-sm font-mono font-bold" style={{ color: color ?? "var(--text-primary)" }}>{value}</div>
    </div>
  );
}

const SEVERITY_COLORS: Record<string, string> = {
  INFO: "var(--accent)",
  WARNING: "var(--warning)",
  CRITICAL: "var(--danger)",
};

export function AlertPill({ severity, message }: { severity: "INFO" | "WARNING" | "CRITICAL"; message: string }) {
  const color = SEVERITY_COLORS[severity];
  return (
    <div
      className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs"
      style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 30%, transparent)` }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
      <span style={{ color }}>{message}</span>
    </div>
  );
}

export function ConfirmButton({
  onConfirm,
  children,
  className = "",
  confirmLabel = "Confirm",
  disabled,
}: {
  onConfirm: () => void;
  children: React.ReactNode;
  className?: string;
  confirmLabel?: string;
  disabled?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), 3000);
    return () => clearTimeout(timer);
  }, [confirming]);

  return (
    <button
      onClick={() => {
        if (confirming) {
          onConfirm();
          setConfirming(false);
        } else {
          setConfirming(true);
        }
      }}
      disabled={disabled}
      className={`${className} transition-all`}
    >
      {confirming ? confirmLabel : children}
    </button>
  );
}

import { useState, useEffect } from "react";
