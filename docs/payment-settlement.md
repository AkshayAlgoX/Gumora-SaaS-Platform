# Payment settlement

This page describes how Gumora turns a Cashfree payment into a paid order.
The code lives in `backend/src/services/settlement.ts` and
`backend/src/routes/checkout.ts`.

## Flow

1. `POST /api/checkout/create-session` (authenticated). The buyer supplies
   `productId` and `customerPhone`. The server validates the phone as a
   10-digit Indian mobile number (Cashfree requires `customer_phone`), creates
   a `pending` order whose provider id is `gum_<orderObjectId>`, and asks
   Cashfree for a payment session. The phone number is forwarded to Cashfree
   and is not stored by Gumora. If Cashfree does not return a session, the
   order is marked `failed`.
2. The browser runs Cashfree checkout and returns to
   `/library?db_order_id=<orderId>`.
3. The library page restores the session and calls
   `POST /api/checkout/confirm` (authenticated) with the order id.
4. Settlement fetches the order from Cashfree and, if it is verified, commits
   the paid state.
5. If the buyer never returns, a Cashfree webhook or the reconciliation
   sweep runs the same settlement (see below).

## Invariant

An order moves from `pending` to `paid` and its product's
`stats.soldCount` increases by exactly one in the same MongoDB transaction,
or neither change happens.

- The transition is a conditional update on `{ _id, status: "pending" }`.
  Duplicate callbacks, retries and concurrent requests cannot match a paid
  order, so they return `ALREADY_SETTLED` without a second increment.
- Two concurrent transactions on the same order conflict. The server aborts
  one of them, and the driver's `withTransaction` retry then sees `paid`.
- Transient transaction errors and unknown commit results are retried by
  the driver. If the commit outcome is still unknown after the driver gives
  up, the order is read back with majority read concern. `paid` is reported as
  `ALREADY_SETTLED`; anything else is reported as `OUTCOME_UNKNOWN` (HTTP 503,
  retryable). A retry is always safe because of the conditional transition.
- If the product no longer exists, the counter update matches nothing, the
  transaction aborts and the order stays `pending` (`PRODUCT_NOT_FOUND`).

## Deployment requirement: transactions

Settlement requires a MongoDB deployment that supports multi-document
transactions: a replica set (including a single-node replica set) or a
sharded cluster. MongoDB Atlas clusters are replica sets.

Capability is checked with the server's `hello` response (`setName` or
`msg: "isdbgrid"`, plus `logicalSessionTimeoutMinutes`), not with the
Mongoose connection state. On a standalone `mongod`, settlement returns
`TRANSACTIONS_UNSUPPORTED` (HTTP 503) before calling Cashfree and writes
nothing. There is no non-transactional fallback.

## Provider verification

The Cashfree "Get Order" response must contain all of `order_id` (string),
`order_status` (string), `order_amount` (number) and `order_currency`
(3 letters). A missing or malformed field yields `GATEWAY_RESPONSE_INVALID`.
Then, in order:

- `order_id` must equal the stored provider order id.
- `order_status` must be exactly `PAID`.
- `order_currency` must be exactly `INR`.
- `order_amount` and the stored order amount are converted to integer paise
  and compared exactly. Values with more than two decimals, or binary
  floating-point artefacts such as `0.1 + 0.2`, are rejected rather than
  rounded (`backend/src/lib/money.ts`).

## Outcomes

`POST /api/checkout/confirm` returns
`{ ok, code, orderId, retryable }` and these HTTP statuses:

- 200: `SETTLED`, `ALREADY_SETTLED`.
- 400: `INVALID_ORDER_ID`, malformed body.
- 404: `ORDER_NOT_FOUND` (also returned for another buyer's order).
- 409: `PAYMENT_NOT_PAID` (retryable), `ORDER_FAILED`, `INVALID_ORDER_STATE`,
  `INVALID_ORDER_AMOUNT`, `PROVIDER_ORDER_MISMATCH`, `AMOUNT_MISMATCH`,
  `CURRENCY_MISMATCH`, `PRODUCT_NOT_FOUND`.
- 502: `GATEWAY_UNAVAILABLE` (retryable), `GATEWAY_RESPONSE_INVALID`.
- 503: `TRANSACTIONS_UNSUPPORTED`, `OUTCOME_UNKNOWN` (both retryable).
- 500: `SETTLEMENT_FAILED` (retryable).

Provider values and internal details are logged server-side and are not
returned to the client.

## Recovery when the buyer does not return

A buyer can pay and then close the tab, lose connectivity or never reach
`/library`. Two server-side paths settle such orders. Both call the same
`settleOrderPayment`, so both re-read the order from Cashfree's Get Order
API, require `PAID` and an exact amount match, and use the same
transactional `pending -> paid` transition. Any combination of webhook
deliveries, sweeps and `/confirm` calls on one order increments
`soldCount` once.

### Cashfree webhook: `POST /api/webhooks/cashfree`

Configure this URL in the Cashfree dashboard for the payment success,
failure and user-dropped events.

- **Authentication.** The handler verifies `x-webhook-signature` as
  `Base64(HMAC-SHA256(x-webhook-timestamp + raw body, CASHFREE_SECRET_KEY))`,
  using a constant-time comparison, before parsing the body.
  - The route is mounted before the JSON parser, so the signed bytes are
    checked exactly as received.
  - Deliveries with a timestamp more than 24 hours from server time are
    rejected.
  - Without `CASHFREE_SECRET_KEY`, every delivery gets 503 and nothing is
    called.
- **Payload use.** Only `type` and `data.order.order_id` are read. Payment
  status and amounts in the payload are ignored, and settlement takes them
  from Cashfree. A replayed or reordered delivery can at most cause a
  redundant status check.
- **Responses.**
  - 200 acknowledges. This covers settled or already-paid orders, failure
    and drop events, unknown orders, unrelated event types, and final
    mismatches.
  - 401 rejects a delivery whose signature or timestamp is invalid.
  - 503 asks Cashfree to retry. This covers an unreachable gateway, an
    unknown commit outcome, a database without transactions, and a success
    event whose order Cashfree does not yet report as `PAID`.

Cashfree delivers at least once and retries non-200 responses on its retry
policy (by default 3 retries at 2, 10 and 30 minutes).

### Reconciliation sweep

`reconcilePendingOrders` (`backend/src/services/reconciliation.ts`)
re-checks pending Cashfree orders that are at least 2 minutes and at most
7 days old, oldest first, 100 per run, one at a time. Paid orders are
settled; the others stay `pending`. Run it in either of two ways:

- **In process:** set `RECONCILE_INTERVAL_MS` (for example `300000`). Runs
  never overlap, and the timer does not keep the process alive.
- **As a scheduled job:** run `npm run build && npm run reconcile`, for
  example as a Render cron job.

Several instances may sweep at once; the conditional transition makes that
safe. Orders older than 7 days are no longer checked automatically.

## `POST /api/checkout/confirm-public` (deprecated)

This unauthenticated endpoint is kept for clients built before the library
page switched to `/confirm`. It runs the same settlement, so it can only
settle an order that Cashfree reports as paid for the stored amount. It
does not grant asset access: `/api/library/*` still requires the buying
user's session.

To avoid acting as an oracle for guessed order ids, every well-formed request
receives the same `202 { ok: true, accepted: true }` whatever the outcome.
It is limited to 20 requests per 15 minutes per client IP. The limiter uses
in-process memory, so the limit applies per backend instance.

## Tests

Tests start real `mongod` processes through `mongodb-memory-server`; the
binary is downloaded on first run. Run them with
`cd backend && npm test`.

- `tests/settlement.integration.test.ts`: a single-node replica set with
  `enableTestCommands`. It covers idempotent repeats, 25 concurrent
  confirmations of one order (exactly one increment), concurrent orders for
  one product, ownership, failed orders and every provider-verification
  failure. It also covers a deleted product and, through the server's
  `failCommand` failpoint, non-transient write failures, write conflicts, a
  transient commit failure that re-runs the whole transaction, and a commit
  whose connection drops. Each failpoint test asserts that the server
  actually triggered the failpoint.
- `tests/settlement.standalone.test.ts`: a standalone `mongod` must be
  reported as not transaction-capable, and settlement must refuse.
- `tests/checkout.routes.test.ts`: HTTP contracts with real JWT cookies; only
  the outbound Cashfree HTTP client is stubbed.
- `tests/money.test.ts`: exact paise conversion.
- `tests/cashfreeWebhook.test.ts`: signature verification against a vector
  computed independently with `openssl dgst -sha256 -hmac`, including a body
  re-serialised from parsed JSON (rejected), tampering, the wrong key,
  timestamp binding and the timestamp window.
- `tests/payment-recovery.integration.test.ts` (replica set):
  - the webhook settles once;
  - 8 concurrent duplicate deliveries settle once;
  - a webhook racing `/confirm` settles once;
  - unsigned, mis-signed and stale deliveries are rejected without a
    gateway call;
  - a signed success event for an order Cashfree reports as `ACTIVE`
    settles nothing;
  - amount mismatches, failure and drop events, an unreachable gateway,
    unknown orders and a missing secret are handled as described above;
  - the sweep settles an unconfirmed paid order, skips orders outside its
    age window and continues past a gateway failure;
  - overlapping sweeps, webhooks and `/confirm` calls on 5 orders produce
    exactly one sale each;
  - the purchase then appears in `GET /api/library`.

## Known limitations

- The webhook and sweep have been tested with a stubbed Cashfree client
  only. Signature handling follows Cashfree's published documentation and
  has not been exercised with a real sandbox delivery from this repository.
- Pending orders older than 7 days are not re-checked automatically.
- An order Cashfree reports as `EXPIRED` or `TERMINATED` stays `pending`
  locally; it is simply no longer re-checked once it leaves the sweep window.
- A payment for a product that was deleted before confirmation is left
  `pending` with `PRODUCT_NOT_FOUND`. It needs manual review and, where
  appropriate, a refund through the Cashfree dashboard.
- The code pins Cashfree API version `2023-08-01`. The field contract above
  was checked against Cashfree's current published reference, not against a
  live sandbox call from this repository.
- Orders created before this change keep their old `prod_<id>_<timestamp>`
  provider ids. They settle normally if their stored amount is an exact
  two-decimal value.
- `providerOrderId` is not covered by a unique index. Adding one is
  recommended after checking existing data for duplicates.
