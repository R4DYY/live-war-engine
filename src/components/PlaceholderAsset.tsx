interface PlaceholderAssetProps {
  label: string;
  sublabel?: string;
  size?: number;
  color?: string;
  className?: string;
}

export default function PlaceholderAsset({
  label,
  sublabel,
  size = 48,
  color = "#636778",
  className = "",
}: PlaceholderAssetProps) {
  const initials = label
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-lg shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${color}33, ${color}11)`,
        border: `1px solid ${color}44`,
      }}
    >
      <span
        className="font-bold leading-none"
        style={{ fontSize: size * 0.3, color }}
      >
        {initials}
      </span>
      {sublabel && (
        <span
          className="leading-none mt-0.5 text-center px-0.5"
          style={{
            fontSize: Math.max(8, size * 0.14),
            color: `${color}cc`,
          }}
        >
          {sublabel}
        </span>
      )}
    </div>
  );
}
