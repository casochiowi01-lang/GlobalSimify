'use client';

import { useState } from 'react';
import { History, Loader2, Smartphone } from 'lucide-react';
import { API_BASE } from '@/lib/api';

interface HistoryEntry {
  status: string;
  statusDate: string;
}
interface Device {
  oem: string;
  hardwareName: string;
  hardwareModel: string;
  eid: string;
}

export function EsimHistory({ esimId }: { esimId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [device, setDevice] = useState<Device | null>(null);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !loaded) {
      setLoading(true);
      try {
        const [h, d] = await Promise.all([
          fetch(`${API_BASE}/esims/${esimId}/history`, {
            credentials: 'include',
          }).then((r) => (r.ok ? (r.json() as Promise<HistoryEntry[]>) : [])),
          fetch(`${API_BASE}/esims/${esimId}/device`, {
            credentials: 'include',
          }).then((r) => (r.ok ? (r.json() as Promise<Device | null>) : null)),
        ]);
        setHistory(Array.isArray(h) ? h : []);
        setDevice(d);
      } catch {
        /* leave empty */
      } finally {
        setLoading(false);
        setLoaded(true);
      }
    }
  }

  return (
    <div className="mt-3 border-t border-zinc-100 pt-3">
      <button
        onClick={toggle}
        className="flex items-center gap-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900"
      >
        <History className="h-4 w-4" /> Device &amp; status history
      </button>
      {open && (
        <div className="mt-3 space-y-3 text-sm">
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
          ) : (
            <>
              {device ? (
                <div className="flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2 text-zinc-700">
                  <Smartphone className="h-4 w-4 text-teal-600" />
                  <span>
                    Installed on {device.oem}{' '}
                    {device.hardwareModel || device.hardwareName}
                  </span>
                </div>
              ) : (
                <p className="text-zinc-500">Not yet installed on a device.</p>
              )}

              {history.length === 0 ? (
                <p className="text-zinc-500">No status history yet.</p>
              ) : (
                <ol className="space-y-2">
                  {history.map((h, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-teal-500" />
                      <span className="font-medium text-zinc-800">
                        {h.status}
                      </span>
                      <span className="ml-auto text-xs text-zinc-400">
                        {new Date(h.statusDate).toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
