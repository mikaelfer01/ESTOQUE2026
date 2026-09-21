import { sql, ensureSchema } from '../lib/db.js';

/**
 * Concilia o valor bruto lido no QR com o código fantasia da posição
 * (ver regra-interpretacao-posicoes-wms):
 * - link do sistema (".../posicao-info.html?posicao_id=130") -> resolve
 *   pelo mapa_posicoes (posicao_id não segue fórmula, exige tabela);
 * - código de barras ("POS-{local_estoque_id}-{codigo}") -> o código já
 *   vem embutido, extrai direto sem precisar de mapa;
 * - qualquer outra coisa (já é o código fantasia, ou foi digitado à mão)
 *   -> usa como veio.
 */
function resolvePosicaoCodigo(raw, mapaById) {
  if (!raw) return raw;
  const linkMatch = String(raw).match(/posicao_id=(\d+)/i);
  if (linkMatch) {
    const id = Number(linkMatch[1]);
    return mapaById.has(id) ? mapaById.get(id) : `ID ${id} (não mapeado)`;
  }
  const barcodeMatch = String(raw).match(/^POS-\d+-(P-.+)$/i);
  if (barcodeMatch) return barcodeMatch[1];
  return raw;
}

export default async function handler(req, res) {
  try {
    await ensureSchema();
    if (req.method === 'GET') {
      const { from, to, posicao, q, sessionId } = req.query;

      let text = `
        SELECT id, session_id, posicao, sku, descricao, lote, fabricacao, validade, quantidade, criado_em
        FROM lancamentos_posicao
        WHERE 1=1
      `;
      const params = [];
      let idx = 1;

      if (from) { text += ` AND criado_em >= $${idx++}`; params.push(from); }
      if (to) { text += ` AND criado_em <= $${idx++}`; params.push(to); }
      if (posicao) { text += ` AND posicao ILIKE $${idx++}`; params.push(`%${posicao}%`); }
      if (sessionId) { text += ` AND session_id = $${idx++}`; params.push(sessionId); }
      if (q) {
        text += ` AND (sku ILIKE $${idx} OR descricao ILIKE $${idx} OR lote ILIKE $${idx})`;
        params.push(`%${q}%`);
        idx++;
      }
      text += ` ORDER BY criado_em DESC`;

      const { rows } = await sql.query(text, params);

      const mapaRes = await sql`SELECT posicao_id, codigo FROM mapa_posicoes`;
      const mapaById = new Map(mapaRes.rows.map((m) => [m.posicao_id, m.codigo]));
      const lancamentos = rows.map((r) => ({
        ...r,
        posicao_resolvida: resolvePosicaoCodigo(r.posicao, mapaById)
      }));

      return res.status(200).json({ lancamentos });
    }

    if (req.method === 'POST') {
      const { sessionId, posicao, sku, descricao, lote, fabricacao, validade, quantidade } = req.body || {};
      const qtdNum = Number(quantidade);

      if (!sessionId) {
        return res.status(400).json({ error: 'Sessão inválida.' });
      }
      if (!posicao || !String(posicao).trim()) {
        return res.status(400).json({ error: 'Informe a posição.' });
      }
      if (!sku || !descricao) {
        return res.status(400).json({ error: 'Selecione um produto.' });
      }
      if (!(qtdNum > 0)) {
        return res.status(400).json({ error: 'Informe uma quantidade válida.' });
      }

      const sess = await sql`SELECT status FROM sessoes WHERE id = ${sessionId}`;
      if (sess.rows.length === 0) {
        return res.status(404).json({ error: 'Sessão não encontrada.' });
      }
      if (sess.rows[0].status !== 'aberta') {
        return res.status(400).json({ error: 'Esta sessão já foi finalizada.' });
      }

      const loteVal = lote ? String(lote).trim() : null;

      const { rows } = await sql`
        INSERT INTO lancamentos_posicao (session_id, posicao, sku, descricao, lote, fabricacao, validade, quantidade)
        VALUES (${sessionId}, ${String(posicao).trim()}, ${sku}, ${descricao}, ${loteVal}, ${fabricacao || null}, ${validade || null}, ${qtdNum})
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
