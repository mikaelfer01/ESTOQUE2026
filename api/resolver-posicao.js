import { ensureSchema, resolvePosicaoCodigo, detectPosicaoTipo, getMapaPosicoesById } from '../lib/db.js';

/**
 * Endpoint de teste/diagnóstico: recebe o valor bruto lido (link, código
 * de barras ou código fantasia) e devolve como ele foi conciliado — usado
 * pela aba "Teste" pra conferir se o mapa_posicoes está batendo certo.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método não permitido' });
  }
  try {
    await ensureSchema();
    const valor = req.query.valor;
    if (!valor || !String(valor).trim()) {
      return res.status(400).json({ error: 'Informe o valor lido.' });
    }

    const tipo = detectPosicaoTipo(valor);
    const mapaById = await getMapaPosicoesById();
    const resolvida = resolvePosicaoCodigo(valor, mapaById);

    let posicaoId = null;
    let mapeado = true;
    if (tipo === 'link') {
      const m = String(valor).match(/posicao_id=(\d+)/i);
      posicaoId = Number(m[1]);
      mapeado = mapaById.has(posicaoId);
    }

    return res.status(200).json({ raw: valor, tipo, posicaoId, mapeado, resolvida });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
