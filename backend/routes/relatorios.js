const express = require('express');
const { getDB }      = require('../db/database');
const { autenticar } = require('../middleware/auth');
const router = express.Router();
router.use(autenticar);

// GET /api/relatorios/economia
router.get('/economia', (req, res) => {
  const db = getDB();
  const { periodo, ano, mes } = req.query;

  // Economia por fornecedor
  const porFornecedor = db.prepare(`
    SELECT
      COALESCE(f.nome, 'Sem fornecedor') as fornecedor,
      COUNT(p.id) as total_pecas,
      SUM(p.preco_unitario * p.quantidade) as total_venda,
      SUM(CASE WHEN p.preco_cotado > 0 THEN p.preco_cotado * p.quantidade ELSE 0 END) as total_cotado,
      SUM(CASE WHEN p.preco_fechado > 0 THEN p.preco_fechado * p.quantidade ELSE 0 END) as total_fechado,
      AVG(CASE WHEN p.preco_unitario > 0 AND p.preco_fechado > 0 THEN p.preco_unitario * 1.0 / p.preco_fechado ELSE NULL END) as markup_medio
    FROM pecas_os p
    LEFT JOIN fornecedores f ON p.fornecedor_id = f.id
    WHERE p.preco_fechado > 0
    GROUP BY f.id, f.nome
    ORDER BY total_fechado DESC
    LIMIT 20
  `).all();

  // Economia por mês
  const porMes = db.prepare(`
    SELECT
      strftime('%Y-%m', p.atualizado_em) as mes,
      COUNT(p.id) as total_pecas,
      SUM(p.preco_unitario * p.quantidade) as total_venda,
      SUM(CASE WHEN p.preco_cotado > 0 THEN p.preco_cotado * p.quantidade ELSE 0 END) as total_cotado,
      SUM(CASE WHEN p.preco_fechado > 0 THEN p.preco_fechado * p.quantidade ELSE 0 END) as total_fechado
    FROM pecas_os p
    WHERE p.preco_fechado > 0
      AND p.atualizado_em >= date('now', '-12 months')
    GROUP BY strftime('%Y-%m', p.atualizado_em)
    ORDER BY mes ASC
  `).all();

  // Totais gerais
  const totais = db.prepare(`
    SELECT
      COUNT(*) as total_pecas,
      SUM(preco_unitario * quantidade) as total_venda,
      SUM(CASE WHEN preco_cotado > 0 THEN preco_cotado * quantidade ELSE 0 END) as total_cotado,
      SUM(CASE WHEN preco_fechado > 0 THEN preco_fechado * quantidade ELSE 0 END) as total_fechado
    FROM pecas_os
    WHERE preco_fechado > 0
  `).get();

  // Top economias (maior diferença venda vs fechado)
  const topEconomia = db.prepare(`
    SELECT
      p.descricao, p.codigo,
      p.preco_unitario, p.preco_fechado, p.quantidade,
      (p.preco_unitario - p.preco_fechado) * p.quantidade as economia_total,
      ROUND(p.preco_unitario * 1.0 / p.preco_fechado, 2) as markup,
      o.numero_os, o.cliente,
      COALESCE(f.nome, '—') as fornecedor
    FROM pecas_os p
    JOIN ordens_servico o ON p.os_id = o.id
    LEFT JOIN fornecedores f ON p.fornecedor_id = f.id
    WHERE p.preco_fechado > 0 AND p.preco_unitario > 0
    ORDER BY economia_total DESC
    LIMIT 15
  `).all();

  res.json({ porFornecedor, porMes, totais, topEconomia });
});

// GET /api/relatorios/historico-preco?codigo=XXXX&descricao=YYYY
router.get('/historico-preco', (req, res) => {
  const db = getDB();
  const { codigo, descricao } = req.query;
  if (!codigo && !descricao) return res.status(400).json({ erro: 'Informe código ou descrição' });

  let where = [], params = [];
  if (codigo)    { where.push('p.codigo = ?');             params.push(codigo); }
  if (descricao) { where.push('p.descricao LIKE ?');       params.push('%' + descricao + '%'); }

  const historico = db.prepare(`
    SELECT
      p.id, p.codigo, p.descricao, p.quantidade,
      p.preco_unitario, p.preco_cotado, p.preco_fechado,
      p.status_entrega, p.atualizado_em,
      ROUND(CASE WHEN p.preco_fechado > 0 THEN p.preco_unitario * 1.0 / p.preco_fechado ELSE NULL END, 2) as markup,
      o.numero_os, o.cliente, o.data_abertura,
      COALESCE(f.nome, '—') as fornecedor
    FROM pecas_os p
    JOIN ordens_servico o ON p.os_id = o.id
    LEFT JOIN fornecedores f ON p.fornecedor_id = f.id
    WHERE ${where.join(' OR ')}
    ORDER BY p.atualizado_em DESC
    LIMIT 50
  `).all(...params);

  // Estatísticas
  const comFechado = historico.filter(h => h.preco_fechado > 0);
  const stats = comFechado.length ? {
    menor_preco:   Math.min(...comFechado.map(h => h.preco_fechado)),
    maior_preco:   Math.max(...comFechado.map(h => h.preco_fechado)),
    media_preco:   comFechado.reduce((s,h) => s+h.preco_fechado, 0) / comFechado.length,
    ultimo_preco:  comFechado[0]?.preco_fechado,
    ultimo_forn:   comFechado[0]?.fornecedor,
    total_compras: comFechado.length
  } : null;

  res.json({ historico, stats });
});

module.exports = router;
