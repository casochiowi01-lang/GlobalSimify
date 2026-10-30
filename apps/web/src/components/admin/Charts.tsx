'use client';

// Lightweight, dependency-free SVG charts for the admin console.

interface Series {
  label: string;
  color: string;
  points: number[];
}

/** Multi-series line chart with an x-axis of labels. */
export function LineChart({
  labels,
  series,
  height = 220,
  format = (n: number) => `${n}`,
}: {
  labels: string[];
  series: Series[];
  height?: number;
  format?: (n: number) => string;
}) {
  const w = 720;
  const h = height;
  const padL = 48;
  const padB = 26;
  const padT = 12;
  const padR = 12;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const all = series.flatMap((s) => s.points);
  const max = Math.max(1, ...all);
  const n = labels.length;
  const x = (i: number) =>
    padL + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => padT + innerH - (v / max) * innerH;

  const ticks = 4;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img">
      {Array.from({ length: ticks + 1 }, (_, i) => {
        const v = (max / ticks) * i;
        const yy = y(v);
        return (
          <g key={i}>
            <line
              x1={padL}
              y1={yy}
              x2={w - padR}
              y2={yy}
              stroke="#e4e4e7"
              strokeWidth={1}
            />
            <text
              x={padL - 6}
              y={yy + 3}
              textAnchor="end"
              fontSize={10}
              fill="#a1a1aa"
            >
              {format(Math.round(v))}
            </text>
          </g>
        );
      })}
      {series.map((s) => {
        const d = s.points
          .map(
            (v, i) =>
              `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`,
          )
          .join(' ');
        return (
          <g key={s.label}>
            <path
              d={d}
              fill="none"
              stroke={s.color}
              strokeWidth={2.5}
              strokeLinejoin="round"
            />
            {s.points.map((v, i) => (
              <circle key={i} cx={x(i)} cy={y(v)} r={2.5} fill={s.color} />
            ))}
          </g>
        );
      })}
      {labels.map((l, i) =>
        n <= 12 || i % Math.ceil(n / 12) === 0 ? (
          <text
            key={i}
            x={x(i)}
            y={h - 8}
            textAnchor="middle"
            fontSize={10}
            fill="#a1a1aa"
          >
            {l}
          </text>
        ) : null,
      )}
    </svg>
  );
}

/** Simple vertical bar chart. */
export function BarChart({
  data,
  height = 200,
  format = (n: number) => `${n}`,
}: {
  data: { label: string; value: number; color?: string }[];
  height?: number;
  format?: (n: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-3" style={{ height }}>
      {data.map((d) => (
        <div key={d.label} className="flex flex-1 flex-col items-center gap-1">
          <span className="text-xs font-medium text-zinc-700">
            {format(d.value)}
          </span>
          <div className="flex w-full flex-1 items-end">
            <div
              className="w-full rounded-t-md"
              style={{
                height: `${(d.value / max) * 100}%`,
                minHeight: 2,
                background: d.color ?? '#0d9488',
              }}
            />
          </div>
          <span
            className="max-w-full truncate text-[11px] text-zinc-500"
            title={d.label}
          >
            {d.label}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Donut chart with a legend, for categorical breakdowns. */
export function Donut({
  data,
  size = 160,
}: {
  data: { label: string; value: number; color: string }[];
  size?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = size / 2;
  const stroke = size * 0.18;
  const rr = r - stroke / 2;
  const circ = 2 * Math.PI * rr;
  // Each segment starts where the previous ones end.
  const dashes = data.map((d) => (d.value / total) * circ);
  const offsets = dashes.map((_, i) =>
    dashes.slice(0, i).reduce((sum, dash) => sum + dash, 0),
  );
  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g transform={`rotate(-90 ${r} ${r})`}>
          {data.map((d, i) => (
            <circle
              key={d.label}
              cx={r}
              cy={r}
              r={rr}
              fill="none"
              stroke={d.color}
              strokeWidth={stroke}
              strokeDasharray={`${dashes[i]} ${circ - dashes[i]}`}
              strokeDashoffset={-offsets[i]}
            />
          ))}
        </g>
        <text
          x={r}
          y={r - 2}
          textAnchor="middle"
          fontSize={22}
          fontWeight={700}
          fill="#18181b"
        >
          {total}
        </text>
        <text x={r} y={r + 16} textAnchor="middle" fontSize={10} fill="#a1a1aa">
          total
        </text>
      </svg>
      <ul className="space-y-1.5 text-sm">
        {data.map((d) => (
          <li key={d.label} className="flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-sm"
              style={{ background: d.color }}
            />
            <span className="text-zinc-600">{d.label}</span>
            <span className="ml-auto font-medium text-zinc-900">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
