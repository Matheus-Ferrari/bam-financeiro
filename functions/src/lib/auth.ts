/**
 * auth.ts — HMAC token helpers + PBKDF2 password verification.
 * Equivalent to Python backend/app/utils/auth.py
 */

import * as crypto from "crypto";
import { db } from "./firestore";
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

// ── Credential verification against Firestore ───────────────────────────

export async function verifyUserCredentials(
  email: string,
  password: string
): Promise<Record<string, unknown> | null> {
  try {
    const snap = await db
      .collection("usuarios")
      .where("email", "==", email.trim().toLowerCase())
      .get();
    if (snap.empty) return null;

    const user = snap.docs[0].data();
    if (user.ativo === false) return null;

    const salt = (user.salt as string) || "";
    const savedHash = (user.senha_hash as string) || "";
    const computed = crypto
      .pbkdf2Sync(password, salt, 100_000, 32, "sha256")
      .toString("hex");

    if (!crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(savedHash)))
      return null;

    return {
      sub: email.trim().toLowerCase(),
      nome: user.nome || "",
      role: user.role || "user",
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
