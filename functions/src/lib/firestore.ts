/**
 * FirestoreStorage — generic CRUD backed by Firestore.
 * Equivalent to Python storage_service.py FirestoreStorage class.
 */

import * as admin from "firebase-admin";
import { v4 as uuidv4 } from "uuid";

// Initialise Firebase once (works both locally and in Cloud Functions)
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

export interface StorageRecord {
  id: string;
  [key: string]: unknown;
}

export class FirestoreStorage {
  private col: FirebaseFirestore.CollectionReference;

  constructor(collection: string) {
    this.col = db.collection(collection);
  }

  async all(): Promise<StorageRecord[]> {
    const snap = await this.col.get();
    return snap.docs.map((d) => {
      const data = d.data() as StorageRecord;
      // Ensure the document always has an 'id' field matching the Firestore doc id
      if (!data.id) data.id = d.id;
      return data;
    });
  }

  async get(id: string): Promise<StorageRecord | null> {
    const doc = await this.col.doc(id).get();
    return doc.exists ? (doc.data() as StorageRecord) : null;
  }

  async create(data: Record<string, unknown>): Promise<StorageRecord> {
    const item: StorageRecord = {
      ...data,
      id: uuidv4(),
      criado_em: new Date().toISOString(),
    };
    await this.col.doc(item.id).set(item);
    return item;
  }

  async update(
    id: string,
    data: Record<string, unknown>
  ): Promise<StorageRecord | null> {
    const ref = this.col.doc(id);
    const doc = await ref.get();
    if (!doc.exists) return null;
    const updated: StorageRecord = {
      ...(doc.data() as StorageRecord),
      ...data,
      id,
      atualizado_em: new Date().toISOString(),
    };
    await ref.set(updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const ref = this.col.doc(id);
    const doc = await ref.get();
    if (!doc.exists) return false;
    await ref.delete();
    return true;
  }
}

// Singletons — one per entity (mirrors Python singletons)
export const clientesStorage = new FirestoreStorage("clientes");
export const cortesStorage = new FirestoreStorage("cortes");
export const quickUpdatesStorage = new FirestoreStorage("quick_updates");
export const movimentacoesStorage = new FirestoreStorage("movimentacoes");
export const caixaStorage = new FirestoreStorage("caixa");
export const projetosAdicionaisStorage = new FirestoreStorage("projetos_adicionais");
export const comissoesStorage = new FirestoreStorage("comissoes");
export const despesasLocaisStorage = new FirestoreStorage("despesas_locais");
export const conciliacaoStorage = new FirestoreStorage("conciliacao");
export const statusOverridesStorage = new FirestoreStorage("status_overrides");
export const fechamentoStorage = new FirestoreStorage("fechamento");
export const baseReceitasStorage = new FirestoreStorage("base_receitas");
export const baseDespesasStorage = new FirestoreStorage("base_despesas");
export const usuariosStorage = new FirestoreStorage("usuarios");
export const precificacaoClassificacoesStorage = new FirestoreStorage("precificacao_classificacoes");

export { db };
