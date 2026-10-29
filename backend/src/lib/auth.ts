import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken'

export type JwtPayload={userId:string}
export async function hashPassword(pass: string){
    return bcrypt.hash(pass, 10);
}

export async function verifyPassword(pass: string, hashPass: string){
    return bcrypt.compare(pass, hashPass);
}

/** Session lifetime; the cookie and the JWT expire together. */
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function signJwt(payload:jwt.JwtPayload){
    // jsonwebtoken throws on an undefined expiresIn, which made every login
    // fail when JWT_EXPIRES_IN was unset; default to the cookie lifetime.
    const expiresIn = (process.env.JWT_EXPIRES_IN || "7d") as jwt.SignOptions["expiresIn"];
    return jwt.sign(payload, process.env.JWT_SECRET!,{ expiresIn })
}

type SameSite = "lax" | "strict" | "none";

/**
 * Options for the HttpOnly session cookie. The token is never exposed to
 * browser JavaScript: there is no endpoint that returns it.
 *
 * SameSite defaults to "none" because the frontend may be served from a
 * different site than the API (for example *.vercel.app). When the frontend
 * and API share a registrable domain (www.gumora.shop and api.gumora.shop),
 * set COOKIE_SAMESITE=lax.
 */
export function sessionCookieOptions(){
    const raw = (process.env.COOKIE_SAMESITE || "none").toLowerCase();
    const sameSite: SameSite = raw === "lax" || raw === "strict" ? raw : "none";
    return { httpOnly: true, secure: true, sameSite, path: "/" };
}

export function verifyJwt(token: string): JwtPayload{
    return jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload
}