import Image from "next/image";

type Props = {
  size?: number;
  className?: string;
  /** 로고 옆 텍스트와 중복되면 빈 문자열 권장 */
  alt?: string;
  priority?: boolean;
};

export function AppIcon({ size = 28, className, alt = "SnapWord", priority }: Props) {
  return (
    <Image
      src="/icon.png"
      alt={alt}
      width={size}
      height={size}
      className={className}
      priority={priority}
    />
  );
}
