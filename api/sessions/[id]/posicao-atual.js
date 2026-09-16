import { sql, ensureSchema } from '../../../lib/db.js';

/**
 * Registra qual posição está sendo lida agora numa sessão, pro modo
 * auditor acompanhar ao vivo — inclusive antes de qualquer produto
 * ser lançado naquela posição.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido' });
  }
  try {
    await ensureSchema();
    const { id } = req.query;
    const { posicao } = req.body || {};

    const { rows } = await sql`
      UPDATE sessoes SET posicao_atual = ${posicao || null}, posicao_atualizada_em = now()
      WHERE id = ${id}
      RETURNING id
    `;
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Sessão não encontrada.' });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
