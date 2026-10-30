# GlobalSimify API

NestJS service that prices plans, takes payments, provisions eSIMs and runs
the background worker. One image serves both roles, selected by
`BACKGROUND_ROLE` (`api` or `worker`).

## Modules

| Module                         | Responsibility                                                    |
| ------------------------------ | ----------------------------------------------------------------- |
| `orders`                       | Quotes, idempotent order creation, the provisioning saga, refunds |
| `payments`                     | Paystack checkout, webhook verification, payment reconciliation   |
| `pricing`                      | FX snapshots and the retail price formula                         |
| `catalog`                      | Supplier catalogue loading, caching and search                    |
| `tasks`                        | Cloud Tasks dispatch and the private worker endpoints             |
| `usage`                        | Data-usage polling, supplier webhooks and threshold alerts        |
| `notifications`                | eSIM delivery email, receipts, QR and installation PDFs, web push |
| `auth`, `users`                | Email one-time codes, JWT sessions, Google and Apple sign-in      |
| `partners`, `promotions`       | Referral commission, payouts and promo codes                      |
| `admin`, `support`, `settings` | Admin console endpoints, tickets and runtime pricing settings     |
| `assistant`                    | Opt-in AI support assistant with server-side keys                 |

Provider adapters live in `src/integrations` (Celitech, Paystack, email, SMS,
WhatsApp). Each has a mock mode so the whole service runs locally without
external accounts.

## Scripts

```bash
npm run start:dev        # watch mode on http://localhost:3000
npm run typecheck        # strict TypeScript
npm run lint             # ESLint (lint:fix to apply fixes)
npm run format:check     # Prettier (format to apply)
npm test                 # Jest unit tests
npm run test:readiness   # build, then contract and order-lifecycle tests
```

## Tests

- `src/**/*.spec.ts`: Jest unit tests.
- `test/orders.test.cjs`: order lifecycle against an in-memory database
  (checkout idempotency, exactly-once provisioning, recovery, refunds, queue).
- `test/live-readiness.test.cjs`: supplier, payment, pricing and launch-gate
  contracts.
- `test/tasks.test.cjs`, `test/delivery.test.cjs`, `test/assistant.test.cjs`:
  worker dispatch, eSIM delivery and assistant safety.
- `test/fulfilment-db.test.cjs`: concurrent provisioning, top-ups and recovery
  against a real PostgreSQL database. CI provides one; locally it runs when
  `READINESS_DATABASE_URL` points at `127.0.0.1:54339/rollout` and is skipped
  otherwise.

Configuration is validated at startup with Zod (`src/config/env.validation.ts`);
see `.env.example` for every variable.
