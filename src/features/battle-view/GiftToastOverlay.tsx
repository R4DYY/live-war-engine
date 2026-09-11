import { useGiftToastStore, type GiftToast } from "@/live/giftToastStore";

const TEAM_COLOR: Record<string, string> = {
  A: "#ef4444",
  B: "#3b82f6",
};

function ToastCard({ toast }: { toast: GiftToast }) {
  const color = TEAM_COLOR[toast.team];
  return (
    <div
      className="gift-toast-enter flex items-center gap-1.5 rounded-lg px-2 py-1 max-w-[180px]"
      style={{
        background: `linear-gradient(135deg, ${color}22, rgba(15,12,20,0.92))`,
        border: `1px solid ${color}55`,
        boxShadow: `0 2px 8px rgba(0,0,0,0.4), 0 0 12px ${color}25`,
      }}
    >
      <div className="flex flex-col leading-tight">
        <span className="text-[9px] font-bold truncate" style={{ color }}>
          @{toast.username.toUpperCase()} JUST GIFTED {toast.giftName.toUpperCase()}
          {toast.quantity > 1 ? ` x${toast.quantity}` : ""}
        </span>
        <span className="text-[8px] font-black tracking-wider" style={{ color: `${color}cc` }}>
          {toast.quantity > 1 ? `${toast.quantity} ` : ""}
          {toast.actionLabel}
        </span>
      </div>
    </div>
  );
}

export function GiftToastOverlay() {
  const toasts = useGiftToastStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div className="absolute top-[12%] left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1 pointer-events-none">
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
