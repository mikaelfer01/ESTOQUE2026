import { sql, ensureSchema } from '../lib/db.js';

export default async function handler(req, res) {
  try {
    await ensureSchema();
    if (req.method === 'GET') {
      const { rows } = await sql`SELECT sku, descricao FROM produtos ORDER BY descricao ASC`;
      return res.status(200).json({ products: rows });
    }

    if (req.method === 'POST') {
      const products = req.body && req.body.products;
      if (!Array.isArray(products) || products.length === 0) {
        return res.status(400).json({ error: 'Lista de produtos vazia.' });
      }

      await sql`DELETE FROM produtos`;

      const chunkSize = 500;
      for (let i = 0; i < products.length; i += chunkSize) {
        const chunk = products.slice(i, i + chunkSize);
        const values = [];
        const params = [];
        chunk.forEach((p, idx) => {
          const base = idx * 2;
          values.push(`($${base + 1}, $${base + 2})`);
          params.push(String(p.sku), String(p.descricao));
        });
        await sql.query(`INSERT INTO produtos (sku, descricao) VALUES ${values.join(',')}`, params);
      }

      return res.status(200).json({ ok: true, count: products.length });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Método não permitido' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
