/**
 * auth.ts — HMAC token helpers + Firebase Authentication verification.
 */

import * as crypto from "crypto";
import { Request, Response, NextFunction } from "express";

const SECRET_KEY =
  process.env.SECRET_KEY || "dev-secret-mude-em-producao-123456";
const TOKEN_EXPIRE_SECONDS =
  parseInt(process.env.TOKEN_EXPIRE_HOURS || "24") * 3600;

export const COOKIE_NAME = "__session";

// ── Token creation and verification ─────────────────────────────────────

export function createToken(subject: string = "bam_user"): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = { sub: subject, iat: now, exp: now + TOKEN_EXPIRE_SECONDS };
  const pB64 = Buffer.from(JSON.stringify(payload))
    .toString("base64url");
  const sig = crypto
    .createHmac("sha256", SECRET_KEY)
    .update(pB64)
    .digest("hex");
  return `${pB64}.${sig}`;
}

export function verifyToken(token: string): Record<string, unknown> | null {
  if (!token || !token.includes(".")) return null;
  try {
    const idx = token.lastIndexOf(".");
    const pB64 = token.slice(0, idx);
    const sig = token.slice(idx + 1);
    const expected = crypto
      .createHmac("sha256", SECRET_KEY)
      .update(pB64)
      .digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)))
      return null;
    const payload = JSON.parse(
      Buffer.from(pB64, "base64url").toString("utf8")
    ) as Record<string, unknown>;
    const exp = payload.exp as number;
    if (exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// ── Credential verification via Firebase Auth REST API ──────────────────

export async function verifyUserCredentials(
  email: string,
  password: string
): Promise<Record<string, unknown> | null> {
  try {
    // Uses Firebase Identity Platform REST API — verifies against Firebase Authentication
    const apiKey =
      process.env.FIREBASE_WEB_API_KEY ||
      "AIzaSyC3yFQA0Abw8gTvwMGvL4EFarCIRF2sKHg";
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        password,
        returnSecureToken: false,
      }),
    });

    if (!resp.ok) return null;

    const data = (await resp.json()) as {
      email?: string;
      displayName?: string;
    };

    return {
      sub: (data.email || email).trim().toLowerCase(),
      nome: data.displayName || "BAM Financeiro",
      role: "admin",
    };
  } catch {
    return null;
  }
}

// ── Cookie options ───────────────────────────────────────────────────────

export function cookieOptions(): Record<string, unknown> {
  // Firebase Hosting + Functions v2 = same origin → no need for sameSite none
  const prod = process.env.NODE_ENV !== "development";
  return {
    httpOnly: true,
    secure: prod,
    sameSite: prod ? "none" : "lax",
    maxAge: TOKEN_EXPIRE_SECONDS * 1000,
    path: "/",
  };
}

// ── Express middleware ───────────────────────────────────────────────────

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const cookies = (req as Request & { cookies?: Record<string, string> })
    .cookies || {};
  const token: string = cookies[COOKIE_NAME] || "";
  const payload = verifyToken(token);
  if (!payload) {
    res
      .status(401)
      .json({ detail: "Não autenticado. Faça login para continuar." });
    return;
  }
  // Attach payload to request
  (req as Request & { user?: Record<string, unknown> }).user = payload;
  next();
}
