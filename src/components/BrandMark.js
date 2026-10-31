import Image from 'next/image';

export default function BrandMark({ size = 24, alt = '' }) {
  return (
    <Image
      src="/seulgirok-mark.svg"
      width={size}
      height={size}
      alt={alt}
      unoptimized
      style={{ flexShrink: 0 }}
    />
  );
}
