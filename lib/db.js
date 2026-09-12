import { sql } from '@vercel/postgres';

let schemaReady = null;

/**
 * Cria as tabelas se ainda não existirem. Idempotente — chamado no início
 * de cada handler; barato porque usa CREATE TABLE IF NOT EXISTS.
 */
export function ensureSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS produtos (
        sku TEXT PRIMARY KEY,
        descricao TEXT NOT NULL
      )`;
      await sql`CREATE TABLE IF NOT EXISTS sessoes (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'aberta',
        inicio TIMESTAMPTZ NOT NULL DEFAULT now(),
        fim TIMESTAMPTZ
      )`;
      await sql`CREATE TABLE IF NOT EXISTS contagens (
        id SERIAL PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES sessoes(id),
        sku TEXT NOT NULL,
        quantidade NUMERIC NOT NULL DEFAULT 0,
        atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE(session_id, sku)
      )`;
    })();
  }
  return schemaReady;
}

export function formatLabel(d) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  }).format(d).replace(',', '');
}

export { sql };
