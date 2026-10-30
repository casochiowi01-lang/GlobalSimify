'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/** Render locally; private eSIM pages and API responses must not be cached. */
export function QrCode({
  value,
  size = 220,
}: {
  value: string;
  size?: number;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    QRCode.toDataURL(value, { width: size, margin: 4 })
      .then(setSrc)
      .catch(() => setSrc(null));
  }, [value, size]);

  if (!src) {
    return (
      <div
        className="animate-pulse rounded-xl bg-zinc-100"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    // A locally generated data: URL gains nothing from next/image optimisation.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="eSIM activation QR code"
      width={size}
      height={size}
      className="rounded-xl border border-zinc-200 bg-white"
    />
  );
}
