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

// GET /api/saving/lead-times
router.get('/lead-times', async (req, res) => {
  try {
    const db = getDB();
    const qa = (sql, ...p) => Promise.resolve(db.prepare(sql).all(...p));
    const q  = (sql, ...p) => Promise.resolve(db.prepare(sql).get(...p));

    // Lead times médios por período
    const medias = await q(db, `
      SELECT
        COUNT(*) as total_os,
        ROUND(AVG(EXTRACT(EPOCH FROM (data_entrada_compras - criado_em))/3600/24), 1) as lt_primam_compras,
        ROUND(AVG(EXTRACT(EPOCH FROM (data_triagem_concluida - data_entrada_compras))/3600/24), 1) as lt_triagem,
        ROUND(AVG(EXTRACT(EPOCH FROM (data_primeiro_pedido - data_triagem_concluida))/3600/24), 1) as lt_cotacao,
        ROUND(AVG(EXTRACT(EPOCH FROM (data_todas_pedidas - data_primeiro_pedido))/3600/24), 1) as lt_pedido,
        ROUND(AVG(EXTRACT(EPOCH FROM (data_entrega_completa - data_todas_pedidas))/3600/24), 1) as lt_entrega,
        ROUND(AVG(EXTRACT(EPOCH FROM (data_entrega_completa - data_entrada_compras))/3600/24), 1) as lt_total
      FROM ordens_servico
      WHERE data_entrada_compras IS NOT NULL
    `);

    // Últimas OS com lead times calculados
    const historico = await qa(db, `
      SELECT
        numero_os, cliente, status,
        data_entrada_compras, data_triagem_concluida,
        data_primeiro_pedido, data_todas_pedidas, data_entrega_completa,
        ROUND(EXTRACT(EPOCH FROM (data_entrega_completa - data_entrada_compras))/3600/24, 0) as lt_total_dias
      FROM ordens_servico
      WHERE data_entrada_compras IS NOT NULL
      ORDER BY data_entrada_compras DESC
      LIMIT 20
    `);

    res.json({ medias, historico });
  } catch(e) { res.status(500).json({ erro: e.message }); }
});
