/** Renders a country flag reliably across platforms (regional-indicator emoji
 * flags don't render on Windows/desktop). Uses the flag-icons SVG sprite.
 * Falls back to a globe for non-country scopes (e.g. GX = global).
 * `size` is a Tailwind text-* class; the flag scales to 1.5em of it. */
export function Flag({
  iso,
  className = '',
  size = 'text-2xl',
}: {
  iso: string;
  className?: string;
  size?: string;
}) {
  const code = iso.toLowerCase();
  if (iso === 'GX' || code.length !== 2) {
    return <span className={`${size} ${className}`}>🌍</span>;
  }
  return (
    <span
      className={`fi fis fi-${code} ${size} inline-block shrink-0 rounded-md ${className}`}
      style={{ width: '1.5em', height: '1.5em' }}
      role="img"
      aria-label={`${iso} flag`}
    />
  );
}
