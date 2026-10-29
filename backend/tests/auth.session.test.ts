import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import type { Express } from "express";
import type { MongoMemoryServer } from "mongodb-memory-server";
import { createApp } from "../src/app";
import { hashPassword, signJwt } from "../src/lib/auth";
import { User } from "../src/models/Users";
import { clearCollections, startStandalone, stopMongo } from "./helpers/mongo";

/**
 * Session handling: the JWT lives only in an HttpOnly cookie and no
 * endpoint hands it to, or accepts it from, browser JavaScript.
 */

process.env.JWT_SECRET = "test-only-jwt-secret";
process.env.COOKIE_NAME = "gumora_test_session";

let server: MongoMemoryServer;
let app: Express;
const PASSWORD = "correct horse battery staple";

beforeAll(async () => {
  server = await startStandalone();
  app = createApp();
}, 120_000);

afterAll(async () => {
  await stopMongo(server);
});

afterEach(async () => {
  delete process.env.COOKIE_SAMESITE;
  process.env.JWT_EXPIRES_IN = "1h";
  await clearCollections();
});

async function user() {
  const email = `u-${Date.now()}-${Math.random()}@example.test`;
  const u = await User.create({ name: "U", email, passwordHash: await hashPassword(PASSWORD) });
  return { u, email };
}

function sessionCookie(res: request.Response): string {
  const cookies = ([] as string[]).concat(res.headers["set-cookie"] ?? []);
  const c = cookies.find((v) => v.startsWith(`${process.env.COOKIE_NAME}=`));
  expect(c, "session cookie set").toBeDefined();
  return c!;
}

describe("login", () => {
  it("sets an HttpOnly, Secure session cookie and never returns the token", async () => {
    const { email } = await user();
    const res = await request(app).post("/api/auth/login").send({ email, password: PASSWORD });

    expect(res.status).toBe(200);
    const cookie = sessionCookie(res);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/SameSite=None/i);
    expect(cookie).toMatch(/Max-Age=604800/);
    const token = cookie.split(";")[0].split("=")[1];
    expect(JSON.stringify(res.body)).not.toContain(token);
  });

  it("honours COOKIE_SAMESITE=lax and ignores invalid values", async () => {
    const { email } = await user();
    process.env.COOKIE_SAMESITE = "lax";
    const lax = await request(app).post("/api/auth/login").send({ email, password: PASSWORD });
    expect(sessionCookie(lax)).toMatch(/SameSite=Lax/i);

    process.env.COOKIE_SAMESITE = "off";
    const bogus = await request(app).post("/api/auth/login").send({ email, password: PASSWORD });
    expect(sessionCookie(bogus)).toMatch(/SameSite=None/i);
  });

  it("works when JWT_EXPIRES_IN is unset and expires with the cookie", async () => {
    const { email } = await user();
    delete process.env.JWT_EXPIRES_IN;

    const res = await request(app).post("/api/auth/login").send({ email, password: PASSWORD });

    expect(res.status).toBe(200);
    const token = sessionCookie(res).split(";")[0].split("=")[1];
    const { iat, exp } = jwt.decode(token) as { iat: number; exp: number };
    expect(exp - iat).toBe(7 * 24 * 60 * 60);
  });
});

describe("token exposure endpoints are gone", () => {
  it("GET /api/auth/token no longer returns the session JWT", async () => {
    const { u } = await user();
    const token = signJwt({ userId: u.id });

    const res = await request(app).get("/api/auth/token").set("Cookie", `${process.env.COOKIE_NAME}=${token}`);

    expect(res.status).toBe(404);
    expect(res.text).not.toContain(token);
  });

  it("POST /api/auth/refresh-session cannot turn a token into a cookie", async () => {
    // Previously any page could post a JWT here and have it installed as the
    // browser's session cookie (login CSRF / session fixation).
    const { u } = await user();
    const res = await request(app).post("/api/auth/refresh-session").send({ token: signJwt({ userId: u.id }) });

    expect(res.status).toBe(404);
    expect(res.headers["set-cookie"]).toBeUndefined();
  });
});

describe("session use", () => {
  it("authenticates /me from the cookie and logs out with matching attributes", async () => {
    const { u } = await user();
    const cookie = `${process.env.COOKIE_NAME}=${signJwt({ userId: u.id })}`;

    const me = await request(app).get("/api/auth/me").set("Cookie", cookie);
    expect(me.status).toBe(200);
    expect(me.body.user.id).toBe(u.id);

    const out = await request(app).post("/api/auth/logout").set("Cookie", cookie);
    const cleared = sessionCookie(out);
    expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970/);
    expect(cleared).toMatch(/HttpOnly/i);
    expect(cleared).toMatch(/SameSite=None/i);
  });

  it("rejects a missing or forged session with a consistent error field", async () => {
    const missing = await request(app).get("/api/auth/me");
    const forged = await request(app)
      .get("/api/auth/me")
      .set("Cookie", `${process.env.COOKIE_NAME}=${jwt.sign({ userId: "x" }, "attacker-key")}`);

    expect([missing.status, forged.status]).toEqual([401, 401]);
    expect(missing.body).toHaveProperty("error");
    expect(forged.body).toHaveProperty("error");
  });
});
