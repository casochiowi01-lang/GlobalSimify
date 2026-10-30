# GlobalSimify Web

Next.js (App Router) progressive web app for browsing plans, checking out,
and managing eSIMs, plus the partner portal and admin console.

## Structure

- `src/app`: routes. Storefront, checkout and order status, account area
  (`/account`), partner portal (`/partner`) and admin console (`/admin`).
- `src/components`: UI, including the purchase widget, checkout forms, eSIM
  cards with QR and PDF downloads, and admin charts.
- `src/lib`: API client, auth context, formatting and shared hooks such as
  `useCheckoutQuote` and `useClientValue`.

State that depends on a request is keyed by the input it was fetched for
(destination, search term, filter, signed-in account), so a slow response can
never overwrite newer data and stale results are never shown.

## Scripts

```bash
npm run dev            # http://localhost:3001, expects the API on :3000
npm run typecheck
npm run lint           # lint:fix to apply fixes
npm run format:check   # format to apply
npm test               # Vitest unit tests
npm run build
```

Set `NEXT_PUBLIC_API_BASE_URL` to point at a different API
(default `http://localhost:3000/api/v1`).
