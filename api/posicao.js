import { sql, ensureSchema } from '../lib/db.js';

export default async function handler(req, res) {
  try {
    await ensureSchema();
    if (req.method === 'GET') {
      const { from, to, posicao, q } = req.query;

      let text = `
        SELECT id, posicao, sku, descricao, lote, fabricacao, validade, quantidade, criado_em
        FROM lancamentos_posicao
        WHERE 1=1
      `;
      const params = [];
      let idx = 1;

      if (from) { text += ` AND criado_em >= $${idx++}`; params.push(from); }
      if (to) { text += ` AND criado_em <= $${idx++}`; params.push(to); }
      if (posicao) { text += ` AND posicao ILIKE $${idx++}`; params.push(`%${posicao}%`); }
      if (q) {
        text += ` AND (sku ILIKE $${idx} OR descricao ILIKE $${idx} OR lote ILIKE $${idx})`;
        params.push(`%${q}%`);
        idx++;
      }
      text += ` ORDER BY criado_em DESC`;

      const { rows } = await sql.query(text, params);
      return res.status(200).json({ lancamentos: rows });
    }

    if (req.method === 'POST') {
      const { posicao, sku, descricao, lote, fabricacao, validade, quantidade } = req.body || {};
      const qtdNum = Number(quantidade);

      if (!posicao || !String(posicao).trim()) {
        return res.status(400).json({ error: 'Informe a posição.' });
      }
      if (!sku || !descricao) {
        return res.status(400).json({ error: 'Selecione um produto.' });
      }
      if (!lote || !String(lote).trim()) {
        return res.status(400).json({ error: 'Informe o lote.' });
      }
      if (!(qtdNum > 0)) {
        return res.status(400).json({ error: 'Informe uma quantidade válida.' });
      }

      const { rows } = await sql`
        INSERT INTO lancamentos_posicao (posicao, sku, descricao, lote, fabricacao, validade, quantidade)
        VALUES (${String(posicao).trim()}, ${sku}, ${descricao}, ${String(lote).trim()}, ${fabricacao || null}, ${validade || null}, ${qtdNum})
        RETURNING id, criado_em
      `;
      return res.status(200).json({ ok: true, id: rows[0].id, criado_em: rows[0].criado_em });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Método não permitido' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
