import { sql, ensureSchema } from '../../../lib/db.js';

export default async function handler(req, res) {
  await ensureSchema();
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido' });
  }
  try {
    const { id } = req.query;
    const { rows } = await sql`
      UPDATE sessoes SET status = 'finalizada', fim = now()
      WHERE id = ${id} AND status = 'aberta'
      RETURNING id
    `;
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Sessão não encontrada ou já finalizada.' });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
