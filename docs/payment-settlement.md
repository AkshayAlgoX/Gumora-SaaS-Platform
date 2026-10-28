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

## Known limitations

- No Cashfree webhook handler. Settlement happens only when the buyer
  returns to the library page. A buyer who pays and never returns stays
  `pending` until they open the library with the order id. A
  signature-verified webhook (`x-webhook-signature` /
  `x-webhook-timestamp`, HMAC-SHA256 over timestamp + raw body) would close
  this gap. It has not been implemented or tested against Cashfree.
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
