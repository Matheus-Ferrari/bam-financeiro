import * as admin from "firebase-admin";
import { onRequest } from "firebase-functions/v2/https";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import { requireAuth } from "./lib/auth";
import authRouter from "./routes/auth";
import clientesRouter from "./routes/clientes";
import fechamentoRouter from "./routes/fechamento";
import comissoesRouter from "./routes/comissoes";
import cortesRouter from "./routes/cortes";
import despesasLocaisRouter from "./routes/despesasLocais";
import projetosAdicionaisRouter from "./routes/projetosAdicionais";
import financeiroRouter from "./routes/financeiro";
import excelRouter from "./routes/excel";
import quickUpdateRouter from "./routes/quickUpdate";

if (!admin.apps.length) {
  admin.initializeApp();
}

const app = express();

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://localhost:5176",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:5175",
  "https://bam-financeiro.web.app",
  "https://bam-financeiro.firebaseapp.com",
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
}));

app.use(cookieParser());
app.use(express.json());

app.use("/auth", authRouter);

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    sistema: "BAM Financeiro",
    versao: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

app.use("/clientes", requireAuth, clientesRouter);
app.use("/fechamento", requireAuth, fechamentoRouter);
app.use("/comissoes", requireAuth, comissoesRouter);
app.use("/cortes", requireAuth, cortesRouter);
app.use("/despesas-locais", requireAuth, despesasLocaisRouter);
app.use("/projetos-adicionais", requireAuth, projetosAdicionaisRouter);
app.use("/financeiro", requireAuth, financeiroRouter);
app.use("/excel", requireAuth, excelRouter);
app.use("/quick-update", requireAuth, quickUpdateRouter);

app.use((_req, res) => {
  res.status(404).json({ detail: "Rota nao encontrada" });
});

export const api = onRequest({ invoker: "public", region: "us-central1", cors: false }, app);
