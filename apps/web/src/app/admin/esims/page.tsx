'use client';

import { useCallback, useState } from 'react';
import { Loader2, Search, Smartphone, CircleDot } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { formatMoney } from '@/lib/format';
import { AdminShell, Panel } from '@/components/admin/AdminShell';
import { statusTone, type AdminOrder, type EsimLookup } from '@/lib/admin';

type Mode = 'iccid' | 'contact';

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${statusTone(status)}`}
    >
      {status}
    </span>
  );
}

function gb(bytes: number): string {
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}

export default function AdminEsimLookup() {
  const [mode, setMode] = useState<Mode>('iccid');

  return (
    <AdminShell title="eSIM lookup">
      <div className="space-y-6">
        <div className="inline-flex rounded-lg border border-zinc-200 bg-white p-1 text-sm">
          <button
            onClick={() => setMode('iccid')}
            className={`rounded-md px-3 py-1.5 font-medium transition ${
              mode === 'iccid'
                ? 'bg-teal-50 text-teal-700'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            By ICCID
          </button>
          <button
            onClick={() => setMode('contact')}
            className={`rounded-md px-3 py-1.5 font-medium transition ${
              mode === 'contact'
                ? 'bg-teal-50 text-teal-700'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            By email or phone
          </button>
        </div>

        {mode === 'iccid' ? <IccidLookup /> : <ContactLookup />}
      </div>
    </AdminShell>
  );
}

function SearchForm({
  placeholder,
  onSubmit,
  loading,
}: {
  placeholder: string;
  onSubmit: (value: string) => void;
  loading: boolean;
}) {
  const [value, setValue] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onSubmit(value.trim());
      }}
      className="flex items-center gap-2"
    >
      <div className="relative flex-1 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm text-zinc-900 focus:border-teal-500 focus:outline-none"
        />
      </div>
      <button
        type="submit"
        disabled={loading || !value.trim()}
        className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-700 disabled:opacity-50"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        Search
      </button>
    </form>
  );
}

function IccidLookup() {
  const { authFetch } = useAuth();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(false);
  const [data, setData] = useState<EsimLookup | null>(null);

  const search = useCallback(
    (iccid: string) => {
      setLoading(true);
      setErr(false);
      setData(null);
      authFetch<EsimLookup>(`/admin/esims?iccid=${encodeURIComponent(iccid)}`)
        .then(setData)
        .catch(() => setErr(true))
        .finally(() => setLoading(false));
    },
    [authFetch],
  );

  return (
    <div className="space-y-4">
      <SearchForm
        placeholder="Enter ICCID"
        onSubmit={search}
        loading={loading}
      />
      {err && (
        <p className="text-sm text-red-600">Lookup failed. Please try again.</p>
      )}
      {data && !data.found && (
        <p className="text-sm text-zinc-500">No eSIM found.</p>
      )}
      {data?.found && data.esim && <EsimResult data={data} />}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-zinc-400">
        {label}
      </dt>
      <dd className="mt-0.5 break-words text-sm text-zinc-800">{value}</dd>
    </div>
  );
}

function EsimResult({ data }: { data: EsimLookup }) {
  const { authFetch } = useAuth();
  const esim = data.esim!;
  const order = data.order ?? null;
  const customer = data.customer ?? null;
  const device = data.device ?? null;
  const history = data.history ?? [];

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(
    null,
  );

  const resend = useCallback(async () => {
    if (!order) return;
    setBusy(true);
    setResult(null);
    try {
      await authFetch(`/admin/orders/${order.id}/resend`, { method: 'POST' });
      setResult({ ok: true, msg: 'eSIM resent to customer.' });
    } catch {
      setResult({ ok: false, msg: 'Could not resend.' });
    } finally {
      setBusy(false);
    }
  }, [authFetch, order]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel
        title="eSIM"
        action={
          order && (
            <button
              onClick={resend}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50"
            >
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Resend eSIM to customer
            </button>
          )
        }
      >
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
          <Field
            label="ICCID"
            value={<span className="font-mono text-xs">{esim.iccid}</span>}
          />
          <Field
            label="Profile status"
            value={<StatusBadge status={esim.profileStatus} />}
          />
          <Field
            label="SM-DP+ address"
            value={
              <span className="font-mono text-xs">{esim.smdpAddress}</span>
            }
          />
          <Field
            label="Matching ID"
            value={<span className="font-mono text-xs">{esim.matchingId}</span>}
          />
          <Field
            label="LPA"
            value={
              <span className="break-all font-mono text-xs">{esim.lpa}</span>
            }
          />
          <Field label="Validity" value={`${esim.validityDays} days`} />
          <Field
            label="Data"
            value={`${gb(esim.remainingBytes)} of ${gb(esim.initialBytes)} left`}
          />
          <Field
            label="Expires"
            value={
              esim.expiresAt ? new Date(esim.expiresAt).toLocaleString() : '—'
            }
          />
        </dl>
        {result && (
          <p
            className={`mt-3 text-sm ${result.ok ? 'text-teal-700' : 'text-red-600'}`}
          >
            {result.msg}
          </p>
        )}
      </Panel>

      <div className="space-y-6">
        <Panel title="Customer">
          {customer ? (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
              <Field label="Email" value={customer.email ?? '—'} />
              <Field label="Name" value={customer.name ?? '—'} />
              <Field label="Phone" value={customer.phone ?? '—'} />
            </dl>
          ) : (
            <p className="text-sm text-zinc-500">No customer linked.</p>
          )}
        </Panel>

        <Panel title="Order">
          {order ? (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
              <Field label="Title" value={order.title} />
              <Field
                label="Status"
                value={<StatusBadge status={order.status} />}
              />
              <Field label="Revenue" value={formatMoney(order.revenue)} />
              <Field
                label="Profit"
                value={
                  <span className="font-medium text-teal-700">
                    {formatMoney(order.profit)}
                  </span>
                }
              />
            </dl>
          ) : (
            <p className="text-sm text-zinc-500">No order linked.</p>
          )}
        </Panel>

        <Panel title="Device">
          <div className="flex items-center gap-2 text-sm text-zinc-800">
            <Smartphone className="h-4 w-4 text-zinc-400" />
            {device
              ? `${device.oem} ${device.hardwareModel || device.hardwareName}`
              : 'Not yet installed'}
          </div>
        </Panel>

        <Panel title="Status history">
          {history.length ? (
            <ol className="space-y-3">
              {history.map((h, i) => (
                <li key={i} className="flex items-start gap-3">
                  <CircleDot className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                  <div>
                    <p className="text-sm font-medium text-zinc-800">
                      {h.status}
                    </p>
                    <p className="text-xs text-zinc-400">
                      {new Date(h.statusDate).toLocaleString()}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-zinc-500">No history recorded.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}

function ContactLookup() {
  const { authFetch } = useAuth();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(false);
  const [rows, setRows] = useState<AdminOrder[] | null>(null);

  const search = useCallback(
    (value: string) => {
      setLoading(true);
      setErr(false);
      setRows(null);
      const key = value.includes('@') ? 'email' : 'phone';
      authFetch<AdminOrder[]>(
        `/admin/lookup/orders?${key}=${encodeURIComponent(value)}`,
      )
        .then(setRows)
        .catch(() => setErr(true))
        .finally(() => setLoading(false));
    },
    [authFetch],
  );

  return (
    <div className="space-y-4">
      <SearchForm
        placeholder="Enter email or phone"
        onSubmit={search}
        loading={loading}
      />
      {err && (
        <p className="text-sm text-red-600">Lookup failed. Please try again.</p>
      )}
      {rows && (
        <Panel>
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">
              No orders for this customer.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500">
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Title</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 text-right font-medium">
                      Revenue
                    </th>
                    <th className="px-3 py-2 text-right font-medium">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((o) => (
                    <tr key={o.id} className="border-b border-zinc-100">
                      <td className="px-3 py-2.5 whitespace-nowrap text-zinc-600">
                        {new Date(o.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-zinc-900">
                        {o.title}
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusBadge status={o.status} />
                      </td>
                      <td className="px-3 py-2.5 text-right text-zinc-900">
                        {formatMoney(o.revenue)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium text-teal-700">
                        {formatMoney(o.profit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}
