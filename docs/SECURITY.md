# Security

How the platform protects accounts, money and customer data, and how each
control is tested. Please report suspected vulnerabilities privately to
support@globalsimify.com rather than in a public issue.

## Authentication and sessions

- **Email one-time codes**: six digits from `crypto.randomInt`, stored only as
  bcrypt hashes, valid for five minutes, and single use. Issuing a new code
  invalidates the previous one.
- **Brute-force resistance**: every guess claims an attempt atomically before
  the comparison (five per code, so parallel requests cannot exceed it), and
  failures are capped at ten per inbox per hour across codes. Code requests are
  limited to five per minute per client, which also blocks using the endpoint
  to flood arbitrary inboxes.
- **Sessions**: short-lived HS256 access tokens (algorithm pinned on
  verification) plus opaque refresh tokens stored as SHA-256 hashes in an
  `httpOnly`, `SameSite=Lax`, `Secure` cookie scoped to `/api/v1/auth`.
  Refresh tokens rotate on every use; replaying a rotated token revokes every
  session for the account.
- **Account identity**: the sign-in email cannot be changed through the profile
  API. It is the key that links guest orders and grants admin access, so it is
  only ever established by proving control of the inbox.
- **Roles** are re-read from the database on every request, so blocking or
  demoting a user takes effect immediately. Google and Apple sign-in tokens are
  verified for issuer, audience and expiry.

## Payments and webhooks

- Paystack webhooks are verified with HMAC-SHA512 over the raw body using a
  constant-time comparison, then the transaction is re-fetched and checked for
  amount, currency, reference and environment before an order is marked paid.
- Celitech usage webhooks are verified with Svix signatures (timestamp window,
  constant-time comparison) and de-duplicated by message id.
- Order creation, supplier purchases, refunds and partner payouts are all
  claimed with conditional database updates, so retries and concurrent
  requests cannot charge, buy or pay twice.

## Authorization

- Admin endpoints require an authenticated `ADMIN` role at the controller level.
- Orders, eSIMs, QR codes and installation PDFs require ownership or a
  constant-time match on the order's private access token.
- Support tickets only attach eSIM diagnostics for an eSIM the caller owns.
- Internal worker endpoints are unreachable from the public API and run on a
  private Cloud Run service that only Cloud Tasks can invoke; the deploy fails
  if the service is ever made public.

## Platform hardening

- **API**: `helmet`, CORS restricted to configured origins, global validation
  with unknown fields rejected, error responses that never expose internals,
  Swagger disabled in production, and `trust proxy` set to one hop so rate
  limits apply to the real client behind Cloud Run.
- **Web**: HSTS, `X-Content-Type-Options`, `X-Frame-Options: DENY`, a CSP
  limiting framing, plugins and `<base>`, a restrictive `Permissions-Policy`,
  and `no-store`, `noindex`, `no-referrer` on account, order and admin pages.
  Post-login redirects only accept same-origin paths (`//host` and `/\host` are
  rejected), and JSON-LD is serialised so data can never close its script tag.
- **Configuration** is validated at startup. An unset `NODE_ENV` is treated as
  production, and production refuses to boot with development secrets or
  with test payment keys while live sales are enabled.
- **Push subscriptions** only accept browser push-service endpoints, so the
  server cannot be pointed at arbitrary URLs.

## Dependencies

`npm audit` reports no known vulnerabilities in either app's production
dependencies. Patched transitive versions are pinned with npm `overrides` where
a parent package lags behind. The remaining advisories affect development
tooling only (Jest, the Nest CLI, and the Prisma CLI's config merger), which
never ships in the runtime image and processes no untrusted input.

## Tests

`apps/api/test/security.test.cjs` covers parallel code guessing, per-inbox
failure caps, single-use and superseded codes, refresh-token replay, email
takeover attempts, concurrent payouts and cross-account diagnostics. Web tests
cover open-redirect attempts and script-breaking JSON-LD payloads.
