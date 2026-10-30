# Support assistant

An opt-in chat assistant on the website answers plan, pricing and order
questions. It is disabled unless `ASSISTANT_ENABLED=true`, and checkout works
independently of it.

## What it can do

- Search destinations and plans, and explain fixed-size versus unlimited
  per-day options and validity.
- Quote dates, quantity and a promo code by calling the same
  `PaymentsService.quote` that checkout uses. Prices shown in chat are
  calculated by the application, never by the model.
- For a signed-in customer: list their own eSIMs and orders, show usage with
  its last-updated time, and suggest same-destination top-ups.
- Link to the normal checkout, order tracker or the right eSIM card.

It cannot buy, charge, top up, refund, change dates, or reveal QR codes and
activation details.

## Security model

- The OpenAI Responses API is called with explicit, read-only function tools
  and strict schemas. Every tool argument is validated on the server.
- Account ownership is enforced in code before any data is read. The assistant
  never looks accounts up by email, user ID, full ICCID or a role claimed in
  chat, and the same rules apply to administrators.
- Tool results omit contact details, payment data, EIDs, full ICCIDs and
  installation secrets. No supplier credentials are ever sent to the model.
- `OPENAI_API_KEY` is a server-side secret; worker instances run with the
  assistant disabled and without the key.
- Requests use `store: false`. The panel asks for consent before the first
  request, keeps no chat history in browser storage, and resets when the
  signed-in account changes.

## Limits

| Limit                                 | Value          |
| ------------------------------------- | -------------- |
| Requests per client                   | 6 per minute   |
| Concurrent requests per instance      | 3              |
| Model rounds per request              | 5              |
| Tool calls per request                | 8              |
| Requests per instance per day         | 200 (default)  |

## Tests

`apps/api/test/assistant.test.cjs` covers cross-account and guest denial,
expired tokens, argument tampering, credential-free tool output, quote
delegation, same-destination top-ups, provider errors and budget limits.
