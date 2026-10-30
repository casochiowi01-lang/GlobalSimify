/**
 * Where to send a user after login: the `?next=` path when it is a safe
 * same-origin path, otherwise the admin panel for admins and the eSIM list for
 * everyone else.
 *
 * Only paths beginning with a single `/` are accepted. `//host` and `/\host`
 * are rejected because browsers treat both as protocol-relative URLs, which
 * would turn the login page into an open redirect.
 */
export function postLoginPath(
  search: string,
  role: string | undefined,
): string {
  const next = new URLSearchParams(search).get('next');
  if (next && /^\/(?![/\\])/.test(next)) return next;
  return role === 'ADMIN' ? '/admin' : '/account/esims';
}
