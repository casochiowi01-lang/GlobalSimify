import { ImageResponse } from 'next/og';

// Branded social-share image, rendered on the fly (no binary asset needed).
// Used for og:image and, by fallback, the Twitter card across the whole site.
export const alt =
  'GlobalSimify - Travel eSIMs for African & Global Travellers Worldwide';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '80px',
        background:
          'linear-gradient(135deg, #0f766e 0%, #0d9488 55%, #059669 100%)',
        color: 'white',
        fontFamily: 'sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          fontSize: 40,
          fontWeight: 700,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 64,
            height: 64,
            borderRadius: 18,
            background: 'rgba(255,255,255,0.15)',
          }}
        >
          🌍
        </div>
        GlobalSimify
      </div>
      <div
        style={{
          marginTop: 40,
          fontSize: 76,
          fontWeight: 800,
          lineHeight: 1.05,
          maxWidth: 900,
        }}
      >
        Land abroad, already connected.
      </div>
      <div
        style={{
          marginTop: 28,
          fontSize: 34,
          color: 'rgba(255,255,255,0.9)',
          maxWidth: 880,
        }}
      >
        Travel data eSIMs for African travellers — pay with mobile money or
        card, scan one QR, skip the airport SIM queues.
      </div>
      <div
        style={{
          marginTop: 44,
          display: 'flex',
          gap: 28,
          fontSize: 26,
          color: 'rgba(255,255,255,0.95)',
        }}
      >
        <span>⚡ Instant delivery</span>
        <span>📱 Keep your number</span>
        <span>🌐 120+ destinations</span>
      </div>
    </div>,
    { ...size },
  );
}
