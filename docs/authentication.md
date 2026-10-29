# Authentication and sessions

## Session cookie

`POST /api/auth/login` signs a JWT (`{ userId }`, `JWT_SECRET`) and sets it
as the session cookie named by `COOKIE_NAME`. The cookie and the JWT expire
together, after 7 days by default.

- **Cookie attributes:** `HttpOnly`, `Secure` and `Path=/`.
- **SameSite:** `None` by default. It can be set with `COOKIE_SAMESITE`
  (`lax`, `strict` or `none`).
- **Token lifetime:** `JWT_EXPIRES_IN` overrides the token lifetime. When it
  is unset, the token uses the cookie lifetime (`7d`).
- **Request checks:** `requireAuth` reads only this cookie. It verifies the
  JWT and loads the user, returning 401 with `{ ok: false, error }`
  otherwise.
- **Logout:** `POST /api/auth/logout` clears the cookie with the same
  attributes.

The token is never readable by browser JavaScript. No endpoint returns it,
and no endpoint accepts a token from a request body.

## Removed: token copy in `localStorage`

Earlier builds called `GET /api/auth/token` before redirecting to Cashfree,
stored the returned JWT in `localStorage["session_token"]`, and posted it to
`POST /api/auth/refresh-session` after the redirect to re-create the cookie.
That design had two problems:

- **XSS exposure.** Any script running on the frontend origin could read a
  7-day bearer token. This defeated `HttpOnly`.
- **Session fixation.** `refresh-session` installed whatever valid JWT it
  received as the caller's session cookie. Another page could therefore sign
  a visitor in as a different account (login CSRF / session fixation).

Both endpoints are removed. The library page deletes any `session_token`
left by older builds. If the session cookie is missing after the Cashfree
redirect, the buyer goes to `/login?next=/library`. The pending order id is
kept in `localStorage` (it is not a credential: `/confirm` is authenticated
and checks ownership), so the purchase is confirmed after login. `next`
accepts same-origin paths only (`client/src/lib/auth/safe-next.ts`).

The paid order does not depend on the buyer returning at all. See "Recovery
when the buyer does not return" in [payment-settlement.md](payment-settlement.md).

## Choosing `COOKIE_SAMESITE`

- **Frontend and API on one registrable domain** (`www.gumora.shop` and
  `api.gumora.shop`): use `lax`. The cookie is first-party. It is still sent
  on the top-level return from Cashfree, and browsers do not attach it to
  cross-site subresource or `fetch` requests.
- **Frontend on another site** (for example a `*.vercel.app` preview
  against the production API): `none` is required. Browsers that block
  third-party cookies will not send the cookie in that setup, whatever the
  backend does.

## Cross-site request protections

- **JSON-only bodies.** State-changing endpoints parse `application/json`
  bodies only, and a cross-origin request with that content type needs a
  CORS preflight.
- **CORS allow-list.** The CORS allow-list (`backend/src/app.ts`) refuses
  origins outside it.
- **No CSRF token.** There is no separate CSRF token. With
  `COOKIE_SAMESITE=none`, protection rests on the two points above.
