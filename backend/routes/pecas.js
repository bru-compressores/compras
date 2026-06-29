const express = require('express');
const { getDB } = require('../db/database');
const { autenticar } = require('../middleware/auth');
const router = express.Router();
router.use(autenticar);

router.get('/entregas-pendentes', (req, res) => {
  const db = getDB();
  res.json(db.prepare(`
    SELECT p.*, f.nome as fornecedor_nome, o.numero_os, o.cliente, o.prioridade, o.tipo
    FROM pecas_os p
    LEFT JOIN fornecedores f ON p.fornecedor_id = f.id
    LEFT JOIN ordens_servico o ON p.os_id = o.id
    WHERE p.status_entrega NOT IN ('Entregue','Cancelado')
    ORDER BY CASE o.prioridade WHEN 'Alta' THEN 1 WHEN 'Média' THEN 2 ELSE 3 END, p.data_entrega_prevista ASC
  `).all());
});

router.get('/', (req, res) => {
  const db = getDB();
  const { os_id, status_entrega } = req.query;
  let where = [], params = [];
  if (os_id)         { where.push('p.os_id = ?');         params.push(os_id); }
  if (status_entrega){ where.push('p.status_entrega = ?'); params.push(status_entrega); }
  const wc = where.length ? 'WHERE ' + where.join(' AND ') : '';
  res.json(db.prepare(`SELECT p.*, f.nome as fornecedor_nome, o.numero_os, o.cliente FROM pecas_os p LEFT JOIN fornecedores f ON p.fornecedor_id = f.id LEFT JOIN ordens_servico o ON p.os_id = o.id ${wc} ORDER BY p.criado_em DESC`).all(...params));
});

router.post('/', (req, res) => {
  const db = getDB();
  const { os_id, codigo, descricao, quantidade, preco_unitario, preco_cotado, preco_fechado, fornecedor_id, status_entrega, data_entrega_prevista, numero_rastreio, observacoes } = req.body;
  if (!os_id || !descricao) return res.status(400).json({ erro: 'OS e descrição são obrigatórios' });
  if (!db.prepare('SELECT id FROM ordens_servico WHERE id = ?').get(os_id)) return res.status(404).json({ erro: 'O.S. não encontrada' });
  db.prepare(`INSERT INTO pecas_os (os_id,codigo,descricao,quantidade,preco_unitario,preco_cotado,preco_fechado,fornecedor_id,status_entrega,data_entrega_prevista,numero_rastreio,observacoes,transporte) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(os_id, codigo||null, descricao, quantidade||1, preco_unitario||null, preco_cotado||null, preco_fechado||null, fornecedor_id||null, status_entrega||'Pendente', data_entrega_prevista||null, numero_rastreio||null, observacoes||null, req.body.transporte||null);
  const nova = db.prepare('SELECT id FROM pecas_os WHERE os_id = ? ORDER BY id DESC LIMIT 1').get(os_id);
  res.status(201).json({ id: nova?.id, mensagem: 'Peça adicionada' });
});

router.put('/:id', (req, res) => {
  const db = getDB();
  const p = db.prepare('SELECT * FROM pecas_os WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ erro: 'Peça não encontrada' });
  const { codigo, descricao, quantidade, preco_unitario, preco_cotado, preco_fechado, fornecedor_id, status_entrega, data_entrega_prevista, numero_rastreio, observacoes } = req.body;
  db.prepare(`UPDATE pecas_os SET codigo=?,descricao=?,quantidade=?,preco_unitario=?,preco_cotado=?,preco_fechado=?,fornecedor_id=?,status_entrega=?,data_entrega_prevista=?,numero_rastreio=?,observacoes=?,transporte=?,atualizado_em=datetime('now','localtime') WHERE id=?`)
    .run(codigo??p.codigo, descricao||p.descricao, quantidade||p.quantidade, preco_unitario??p.preco_unitario, preco_cotado??p.preco_cotado, preco_fechado??p.preco_fechado, fornecedor_id??p.fornecedor_id, status_entrega||p.status_entrega, data_entrega_prevista??p.data_entrega_prevista, numero_rastreio??p.numero_rastreio, observacoes??p.observacoes, (req.body.transporte!==undefined?req.body.transporte:p.transporte), req.params.id);
  res.json({ mensagem: 'Peça atualizada' });
});

router.delete('/:id', (req, res) => {
  const db = getDB();
  if (!db.prepare('SELECT id FROM pecas_os WHERE id = ?').get(req.params.id)) return res.status(404).json({ erro: 'Peça não encontrada' });
  db.prepare('DELETE FROM pecas_os WHERE id = ?').run(req.params.id);
  res.json({ mensagem: 'Peça removida' });
});

module.exports = router;
