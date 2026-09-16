import { sql, ensureSchema } from '../lib/db.js';

/**
 * Apaga todo o histórico de contagens (lançamentos + sessões).
 * Não mexe na lista de produtos.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido' });
  }
  try {
    await ensureSchema();
    await sql`DELETE FROM contagens`;
    await sql`DELETE FROM sessoes`;
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
