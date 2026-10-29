# Browser tests

These are Playwright tests. They cover two kinds of check, which are kept
separate.

## Mock-isolated tests: `e2e/mocked/`

Run them with:

```bash
cd client
npx playwright install chromium   # first time only
npm run test:e2e
```

- **What runs:** Playwright builds the app (`next build`) and serves it with
  `next start` on port 3100.
- **Fake API address:** `NEXT_PUBLIC_API_URL` is set to
  `http://127.0.0.1:59999`. Nothing listens there.
- **Mocked responses:** `e2e/support/api-mock.ts` answers every browser
  request to that address. The response shapes follow the Express handlers
  in `backend/src`.
- **Strict mocking:** a request the test did not mock gets a `501` and fails
  the test. A page therefore cannot quietly depend on an endpoint the test
  did not declare.
- **No external services:** no deployed backend, database or payment
  provider is contacted.

These tests run in CI on every push and pull request. Coverage:

- **Homepage:** the page title, the Login link and the Start Selling link.
- **Registration and login forms:**
  - required fields are marked as required;
  - an empty or malformed submit sends no request;
  - wrong credentials show the server's error;
  - a successful login lands on the dashboard;
  - a user who is already signed in is redirected away from `/login`.
- **Access policy for signed-out visitors:** `/discover`, `/library` and
  `/dashboard/products` redirect to `/login` without requesting page data.
  The policy is implemented client-side, with one `GET /api/auth/me` per
  page. There is no Next.js middleware.
- **Discover catalogue:** product cards, prices and detail links, plus the
  empty state.

Checkout is not covered. It needs a Cashfree checkout session, and these
tests must never create real payments. Settlement logic is tested in the
backend against a real MongoDB replica set (`backend/tests/`).

## Availability smoke checks: `e2e/smoke/`

```bash
SMOKE_WEB_URL=https://www.gumora.shop SMOKE_API_URL=https://api.gumora.shop npm run test:e2e:smoke
```

- **What they do:** read-only GET requests against real deployments: the
  homepage and `GET /healthz`.
- **What a failure means:** it describes the state of the deployment, not
  the code.
- **When they run:** only by hand, locally or through the "Deployment
  availability smoke" workflow (`workflow_dispatch`). They are never part
  of PR CI.

## Not covered here

- Integration tests against a locally running backend.
- E2E tests against a controlled staging environment. No staging
  environment exists.
