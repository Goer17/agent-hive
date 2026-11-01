import { avatarUrl } from "../lib/format";

interface AvatarProps {
  avatar: number;
  size?: number;
  className?: string;
  alt?: string;
}

export function Avatar({ avatar, size = 40, className = "", alt = "" }: AvatarProps): React.JSX.Element {
  return (
    <img
      className={`avatar ${className}`.trim()}
      src={avatarUrl(avatar)}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      alt={alt}
      draggable={false}
    />
  );
}