import crypto from 'crypto';
import { sql, ensureSchema, formatLabel } from '../lib/db.js';

export default async function handler(req, res) {
  try {
    await ensureSchema();
    if (req.method === 'GET') {
      const tipo = req.query.tipo || 'contagem';
      const { rows } = await sql`
        SELECT id, label FROM sessoes WHERE status = 'aberta' AND tipo = ${tipo} ORDER BY inicio DESC
      `;
      return res.status(200).json({ sessions: rows });
    }

    if (req.method === 'POST') {
      const tipo = (req.body && req.body.tipo) || 'contagem';
      const id = crypto.randomUUID();
      const now = new Date();
      const label = formatLabel(now);
      await sql`
        INSERT INTO sessoes (id, label, status, inicio, tipo)
        VALUES (${id}, ${label}, 'aberta', ${now.toISOString()}, ${tipo})
      `;
      return res.status(200).json({ sessionId: id, label });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Método não permitido' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
