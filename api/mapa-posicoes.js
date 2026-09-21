import { sql, ensureSchema } from '../lib/db.js';

/**
 * Mapa posicao_id -> código fantasia, usado pra conciliar os links dos
 * QR codes de posição (ex: ?posicao_id=130) com o código legível
 * (ex: P-1-PA-A-02-02) na hora de gerar relatórios/planilhas.
 */
export default async function handler(req, res) {
  try {
    await ensureSchema();

    if (req.method === 'GET') {
      const { rows } = await sql`SELECT posicao_id, codigo FROM mapa_posicoes ORDER BY posicao_id`;
      return res.status(200).json({ mapa: rows });
    }

    if (req.method === 'POST') {
      const mapa = (req.body && req.body.mapa) || [];
      if (!Array.isArray(mapa) || mapa.length === 0) {
        return res.status(400).json({ error: 'Lista de posições vazia.' });
      }

      let count = 0;
      for (const item of mapa) {
        const id = Number(item.posicao_id);
        const codigo = String(item.codigo || '').trim();
        if (!Number.isInteger(id) || !codigo) continue;
        await sql`
          INSERT INTO mapa_posicoes (posicao_id, codigo) VALUES (${id}, ${codigo})
          ON CONFLICT (posicao_id) DO UPDATE SET codigo = EXCLUDED.codigo
        `;
        count++;
      }
      return res.status(200).json({ ok: true, count });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Método não permitido' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
