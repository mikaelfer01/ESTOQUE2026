import { sql } from '@vercel/postgres';

let schemaReady = null;

/**
 * Cria as tabelas se ainda não existirem. Idempotente — chamado no início
 * de cada handler; barato porque usa CREATE TABLE IF NOT EXISTS.
 * Se falhar, limpa o cache para a próxima chamada tentar de novo em vez
 * de ficar presa num erro permanente até a função reiniciar.
 */
export function ensureSchema() {
  if (!schemaReady) {
    schemaReady = createTables().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

async function createTables() {
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
  // "tipo" distingue sessões de contagem (index.html) das de lançamento
  // por posição (posicao.html) — ambas reaproveitam a mesma tabela.
  await sql`ALTER TABLE sessoes ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'contagem'`;
  // Guarda qual posição está sendo lida agora numa sessão por posição —
  // atualizado a cada escaneamento/digitação, mesmo antes de lançar
  // qualquer produto, pra o modo auditor acompanhar em tempo real.
  await sql`ALTER TABLE sessoes ADD COLUMN IF NOT EXISTS posicao_atual TEXT`;
  await sql`ALTER TABLE sessoes ADD COLUMN IF NOT EXISTS posicao_atualizada_em TIMESTAMPTZ`;
  await sql`CREATE TABLE IF NOT EXISTS contagens (
    id SERIAL PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessoes(id),
    sku TEXT NOT NULL,
    quantidade NUMERIC NOT NULL DEFAULT 0,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(session_id, sku)
  )`;
  await sql`CREATE TABLE IF NOT EXISTS lancamentos_posicao (
    id SERIAL PRIMARY KEY,
    posicao TEXT NOT NULL,
    sku TEXT NOT NULL,
    descricao TEXT NOT NULL,
    lote TEXT,
    fabricacao TEXT,
    validade TEXT,
    quantidade NUMERIC NOT NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_lancamentos_posicao_posicao ON lancamentos_posicao (posicao)`;

  // Liga cada lançamento por posição a uma sessão (permite várias pessoas
  // entrarem na mesma "rodada" e finalizarem/exportarem juntas).
  await sql`ALTER TABLE lancamentos_posicao ADD COLUMN IF NOT EXISTS session_id TEXT REFERENCES sessoes(id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_lancamentos_posicao_session ON lancamentos_posicao (session_id)`;

  // Migração: em versões anteriores fabricacao/validade eram DATE (exigia
  // selecionar num calendário). Agora são texto livre (ex: "03/2026"),
  // então converte colunas antigas se ainda estiverem como DATE.
  await sql`
    DO $$
    BEGIN
      IF (SELECT data_type FROM information_schema.columns
          WHERE table_name = 'lancamentos_posicao' AND column_name = 'fabricacao') = 'date' THEN
        ALTER TABLE lancamentos_posicao ALTER COLUMN fabricacao TYPE TEXT USING to_char(fabricacao, 'DD/MM/YYYY');
      END IF;
      IF (SELECT data_type FROM information_schema.columns
          WHERE table_name = 'lancamentos_posicao' AND column_name = 'validade') = 'date' THEN
        ALTER TABLE lancamentos_posicao ALTER COLUMN validade TYPE TEXT USING to_char(validade, 'DD/MM/YYYY');
      END IF;
    END $$;
  `;
}

export function formatLabel(d) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  }).format(d).replace(',', '');
}

export { sql };
