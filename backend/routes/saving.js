const express = require('express');
const { getDB } = require('../db/database');
const { autenticar } = require('../middleware/auth');
const router = express.Router();
router.use(autenticar);

const qa = (db, sql, ...p) => Promise.resolve(db.prepare(sql).all(...p));
const q  = (db, sql, ...p) => Promise.resolve(db.prepare(sql).get(...p));

router.get('/', async (req, res) => {
  try {
    const db = getDB();

    // Totais gerais — Saving = Cotado - Fechado
    const totais = await q(db, `
      SELECT
        COUNT(*) as total_pecas,
        SUM(CASE WHEN preco_cotado > 0 THEN preco_cotado * quantidade ELSE 0 END) as total_cotado,
        SUM(CASE WHEN preco_fechado > 0 THEN preco_fechado * quantidade ELSE 0 END) as total_fechado,
        SUM(CASE WHEN preco_cotado > 0 AND preco_fechado > 0
            THEN (preco_cotado - preco_fechado) * quantidade ELSE 0 END) as saving_total,
        COUNT(CASE WHEN preco_cotado > 0 AND preco_fechado > 0 THEN 1 END) as pecas_negociadas
      FROM pecas_os
      WHERE preco_cotado > 0 OR preco_fechado > 0
    `);

    // Saving por mês
    const porMes = await qa(db, `
      SELECT
        TO_CHAR(atualizado_em, 'YYYY-MM') as mes,
        COUNT(*) as total_pecas,
        SUM(CASE WHEN preco_cotado > 0 THEN preco_cotado * quantidade ELSE 0 END) as total_cotado,
        SUM(CASE WHEN preco_fechado > 0 THEN preco_fechado * quantidade ELSE 0 END) as total_fechado,
        SUM(CASE WHEN preco_cotado > 0 AND preco_fechado > 0
            THEN (preco_cotado - preco_fechado) * quantidade ELSE 0 END) as saving
      FROM pecas_os
      WHERE (preco_cotado > 0 OR preco_fechado > 0)
        AND atualizado_em >= NOW() - INTERVAL '12 months'
      GROUP BY TO_CHAR(atualizado_em, 'YYYY-MM')
      ORDER BY mes ASC
    `);

    // Saving por fornecedor
    const porFornecedor = await qa(db, `
      SELECT
        COALESCE(f.nome, 'Sem fornecedor') as fornecedor,
        COUNT(p.id) as total_pecas,
        SUM(CASE WHEN p.preco_cotado > 0 THEN p.preco_cotado * p.quantidade ELSE 0 END) as total_cotado,
        SUM(CASE WHEN p.preco_fechado > 0 THEN p.preco_fechado * p.quantidade ELSE 0 END) as total_fechado,
        SUM(CASE WHEN p.preco_cotado > 0 AND p.preco_fechado > 0
            THEN (p.preco_cotado - p.preco_fechado) * p.quantidade ELSE 0 END) as saving,
        ROUND(AVG(CASE WHEN p.preco_cotado > 0 AND p.preco_fechado > 0
            THEN (1 - p.preco_fechado::numeric / p.preco_cotado) * 100 ELSE NULL END), 1) as saving_pct
      FROM pecas_os p
      LEFT JOIN fornecedores f ON p.fornecedor_id = f.id
      WHERE p.preco_cotado > 0 AND p.preco_fechado > 0
      GROUP BY f.id, f.nome
      HAVING SUM((p.preco_cotado - p.preco_fechado) * p.quantidade) > 0
      ORDER BY saving DESC
      LIMIT 20
    `);

    // Top 15 maiores savings por peça
    const topSaving = await qa(db, `
      SELECT
        p.descricao, p.codigo, p.codigo_fabricante,
        p.quantidade, p.preco_cotado, p.preco_fechado,
        (p.preco_cotado - p.preco_fechado) * p.quantidade as saving_total,
        ROUND((1 - p.preco_fechado::numeric / p.preco_cotado) * 100, 1) as saving_pct,
        o.numero_os, o.cliente,
        COALESCE(f.nome, '—') as fornecedor,
        p.atualizado_em
      FROM pecas_os p
      JOIN ordens_servico o ON p.os_id = o.id
      LEFT JOIN fornecedores f ON p.fornecedor_id = f.id
      WHERE p.preco_cotado > 0 AND p.preco_fechado > 0
        AND p.preco_fechado < p.preco_cotado
      ORDER BY saving_total DESC
      LIMIT 15
    `);

    res.json({ totais, porMes, porFornecedor, topSaving });
  } catch(e) { console.error('Saving error:', e.message); res.status(500).json({ erro: e.message }); }
});

module.exports = router;
