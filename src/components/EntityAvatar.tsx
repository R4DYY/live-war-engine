import { useEffect, useState } from "react";
import type { CommanderDefinition } from "@/domain/types";
import PlaceholderAsset from "./PlaceholderAsset";

interface EntityAvatarProps {
  entity: CommanderDefinition | undefined;
  label: string;
  size?: number;
  className?: string;
  imageClassName?: string;
  fallbackColor?: string;
}

export default function EntityAvatar({
  entity,
  label,
  size = 48,
  className = "",
  imageClassName = "",
  fallbackColor,
}: EntityAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const icon = entity?.iconAsset;

  useEffect(() => {
    setImageFailed(false);
  }, [icon]);

  if (!icon || imageFailed) {
    return <PlaceholderAsset label={label} size={size} color={fallbackColor} className={className} />;
  }

  return (
    <div
      className={`shrink-0 overflow-hidden rounded-full ${className}`}
      style={{ width: size, height: size }}
    >
      <img
        src={icon}
        alt={label}
        width={size}
        height={size}
        onError={() => setImageFailed(true)}
        className={`block h-full w-full object-cover object-center ${imageClassName}`}
      />
    </div>
  );
}
