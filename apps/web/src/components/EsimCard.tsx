'use client';

import { useState } from 'react';
import { Mail, Check, Loader2 } from 'lucide-react';
import { QrCode } from './QrCode';
import { EsimDownloads } from './EsimDownloads';
import { CopyField } from './CopyField';
import { UsageBar } from './UsageBar';
import { TopUpSheet } from './TopUpSheet';
import { EsimHistory } from './EsimHistory';
import { useAuth } from '@/lib/auth';
import type { EsimView } from '@/lib/api';

export function EsimCard({
  esim,
  title,
  showUsage = false,
  orderId,
  orderToken,
}: {
  esim: EsimView;
  title?: string;
  showUsage?: boolean;
  orderId?: string;
  orderToken?: string;
}) {
  const { authFetch } = useAuth();
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>(
    'idle',
  );
  const [resendError, setResendError] = useState('');

  async function resend() {
    if (!orderId) return;
    setResendState('sending');
    setResendError('');
    try {
      await authFetch(`/orders/${orderId}/resend`, { method: 'POST' });
      setResendState('sent');
      setTimeout(() => setResendState('idle'), 2500);
    } catch {
      setResendState('idle');
      setResendError(
        'Could not resend the email. Please try again shortly. Your QR remains available here.',
      );
    }
  }

  return (
    <div
      id={`esim-${esim.id}`}
      className="scroll-mt-24 rounded-2xl border border-zinc-200 bg-white p-6"
    >
      {title && <h3 className="font-semibold text-zinc-900">{title}</h3>}
      {showUsage && (
        <div className="mt-4">
          <UsageBar esimId={esim.id} />
        </div>
      )}
      <div className="mt-4 flex flex-col items-center gap-6 sm:flex-row sm:items-start">
        <div className="flex shrink-0 flex-col items-center">
          <QrCode value={esim.lpa} />
          <span className="mt-2 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-600">
            {esim.profileStatus}
          </span>
        </div>
        <div className="min-w-0 w-full space-y-3">
          <p className="text-sm text-zinc-600">
            Scan this QR on Wi-Fi <strong>before you travel</strong>. Setting up
            on the same phone? Copy the details below instead.
          </p>
          <CopyField label="SM-DP+ Address" value={esim.smdpAddress} />
          <CopyField label="Activation Code" value={esim.matchingId} />
          <CopyField label="ICCID" value={esim.iccid} />
        </div>
      </div>
      <EsimDownloads esimId={esim.id} lpa={esim.lpa} orderToken={orderToken} />
      {resendError && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {resendError}
        </p>
      )}
      {showUsage && (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <TopUpSheet esimId={esim.id} destIso={esim.destIso} />
          {orderId && (
            <button
              onClick={resend}
              disabled={resendState !== 'idle'}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-70"
            >
              {resendState === 'sending' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : resendState === 'sent' ? (
                <Check className="h-4 w-4 text-teal-600" />
              ) : (
                <Mail className="h-4 w-4 text-zinc-400" />
              )}
              {resendState === 'sent' ? 'Sent ✓' : 'Resend to email'}
            </button>
          )}
        </div>
      )}
      {showUsage && <EsimHistory esimId={esim.id} />}
    </div>
  );
}
