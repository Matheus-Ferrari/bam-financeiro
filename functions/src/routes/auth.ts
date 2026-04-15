import { Router } from "express";
import { verifyUserCredentials, createToken, cookieOptions, COOKIE_NAME } from "../lib/auth";
import { requireAuth } from "../lib/auth";

const router = Router();

// POST /auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    res.status(400).json({ detail: "Email e senha são obrigatórios" });
    return;
  }
  const user = await verifyUserCredentials(String(email), String(password));
  if (!user) {
    res.status(401).json({ detail: "Credenciais inválidas" });
    return;
  }
  const token = createToken(String(user.sub));
  res.cookie(COOKIE_NAME, token, cookieOptions() as Record<string, unknown> as never);
  res.json({ ok: true, user: { email: user.sub, nome: user.nome, role: user.role } });
});

// POST /auth/logout
router.post("/logout", (_req, res) => {
  const prod = process.env.NODE_ENV !== "development";
  res.clearCookie(COOKIE_NAME, {
    path: "/",
    httpOnly: true,
    secure: prod,
    sameSite: prod ? "none" : "lax",
  });
  res.json({ ok: true });
});

// GET /auth/me
router.get("/me", requireAuth, (req, res) => {
  const user = (req as typeof req & { user?: Record<string, unknown> }).user;
  res.json({ usuario: user });
});

export default router;
