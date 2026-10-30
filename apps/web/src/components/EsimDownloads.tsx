'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Download, FileDown, Share2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function EsimDownloads({
  esimId,
  lpa,
  orderToken,
}: {
  esimId: string;
  lpa: string;
  orderToken?: string;
}) {
  const { authFetchBlob } = useAuth();
  const [prepared, setPrepared] = useState<{ key: string; file: File } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const filename = `globalsimify-esim-${esimId.slice(-6)}`;
  // A prepared image only counts for the activation code it was generated from.
  const qrKey = `${lpa}|${filename}`;
  const qr = prepared?.key === qrKey ? prepared.file : null;
  // Prepare before the click: native file sharing must retain user activation.
  useEffect(() => {
    let active = true;
    void QRCode.toDataURL(lpa, {
      width: 900,
      margin: 4,
      errorCorrectionLevel: 'M',
    })
      .then((data) => {
        const bytes = Uint8Array.from(atob(data.split(',')[1]), (char) =>
          char.charCodeAt(0),
        );
        if (active)
          setPrepared({
            key: `${lpa}|${filename}`,
            file: new File([bytes], `${filename}.png`, { type: 'image/png' }),
          });
      })
      .catch(() => {
        if (active)
          setError(
            'Could not prepare the QR image. Please refresh and try again.',
          );
      });
    return () => {
      active = false;
    };
  }, [lpa, filename]);

  async function pdf() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const blob = await authFetchBlob(
        `/esims/${encodeURIComponent(esimId)}/installation.pdf`,
        {
          cache: 'no-store',
          headers: orderToken ? { 'x-order-token': orderToken } : {},
        },
      );
      if (!blob.type.includes('application/pdf'))
        throw new Error('Invalid download');
      save(blob, `${filename}.pdf`);
    } catch {
      setError(
        'Could not download your PDF. Please try again, or sign in with your purchase email.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    if (!qr) return;
    setError('');
    setMessage('');
    if (!navigator.share || !navigator.canShare?.({ files: [qr] })) {
      save(qr, qr.name);
      setMessage(
        'QR image downloaded. Open WhatsApp and attach it to your own chat or the intended traveller.',
      );
      return;
    }
    try {
      await navigator.share({ files: [qr], title: 'My GlobalSimify eSIM' });
      setMessage(
        'Use your device’s share menu to select WhatsApp and the intended recipient.',
      );
    } catch (e) {
      if (!(e instanceof Error && e.name === 'AbortError'))
        setError(
          'Sharing was unavailable. Download the QR image and attach it in WhatsApp.',
        );
    }
  }

  const button =
    'inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50';
  return (
    <div className="mt-5 space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          className={button}
          disabled={!qr}
          onClick={() => qr && save(qr, qr.name)}
        >
          <Download className="h-4 w-4" />
          Download QR image
        </button>
        <button className={button} disabled={busy} onClick={pdf}>
          <FileDown className="h-4 w-4" />
          {busy ? 'Preparing PDF…' : 'Download PDF guide'}
        </button>
        <button className={button} disabled={!qr} onClick={share}>
          <Share2 className="h-4 w-4" />
          Share via WhatsApp
        </button>
      </div>
      <p className="text-xs text-zinc-500">
        Keep your QR private: anyone with it may be able to install your eSIM.
        Share only with yourself or the intended traveller. WhatsApp
        availability depends on your device.
      </p>
      {message && (
        <p role="status" className="text-sm text-teal-800">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
