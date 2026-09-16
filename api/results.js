import { sql, ensureSchema } from '../lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método não permitido' });
  }
  try {
    await ensureSchema();
    const { from, to, sessionId, status, q } = req.query;

    let text = `
      SELECT c.session_id, s.label AS session_label, s.status AS session_status,
             s.inicio, s.fim, c.sku, p.descricao, c.quantidade, c.atualizado_em
      FROM contagens c
      JOIN sessoes s ON s.id = c.session_id
      LEFT JOIN produtos p ON p.sku = c.sku
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    if (from) { text += ` AND s.inicio >= $${idx++}`; params.push(from); }
    if (to) { text += ` AND s.inicio <= $${idx++}`; params.push(to); }
    if (sessionId) { text += ` AND c.session_id = $${idx++}`; params.push(sessionId); }
    if (status) { text += ` AND s.status = $${idx++}`; params.push(status); }
    if (q) {
      text += ` AND (c.sku ILIKE $${idx} OR p.descricao ILIKE $${idx})`;
      params.push(`%${q}%`);
      idx++;
    }
    text += ` ORDER BY s.inicio DESC, p.descricao ASC NULLS LAST`;

    const { rows } = await sql.query(text, params);
    const sessRes = await sql`SELECT id, label, status, inicio, fim FROM sessoes ORDER BY inicio DESC`;

    return res.status(200).json({ results: rows, sessions: sessRes.rows });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
