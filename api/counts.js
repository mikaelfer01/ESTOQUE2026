import { sql, ensureSchema } from '../lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido' });
  }
  try {
    await ensureSchema();
    const { sessionId, sku, qtd } = req.body || {};
    const qtdNum = Number(qtd);
    if (!sessionId || !sku || !(qtdNum > 0)) {
      return res.status(400).json({ error: 'Dados inválidos.' });
    }

    const sess = await sql`SELECT status FROM sessoes WHERE id = ${sessionId}`;
    if (sess.rows.length === 0) {
      return res.status(404).json({ error: 'Sessão não encontrada.' });
    }
    if (sess.rows[0].status !== 'aberta') {
      return res.status(400).json({ error: 'Esta contagem já foi finalizada.' });
    }

    const prod = await sql`SELECT sku FROM produtos WHERE sku = ${sku}`;
    if (prod.rows.length === 0) {
      return res.status(404).json({ error: 'SKU não encontrado no inventário.' });
    }

    const { rows } = await sql`
      INSERT INTO contagens (session_id, sku, quantidade, atualizado_em)
      VALUES (${sessionId}, ${sku}, ${qtdNum}, now())
      ON CONFLICT (session_id, sku)
      DO UPDATE SET quantidade = contagens.quantidade + EXCLUDED.quantidade, atualizado_em = now()
      RETURNING quantidade
    `;

    return res.status(200).json({ newTotal: Number(rows[0].quantidade) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
