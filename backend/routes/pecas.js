const express = require('express');
const { getDB } = require('../db/database');
const { autenticar } = require('../middleware/auth');
const router = express.Router();
router.use(autenticar);

const q  = (db, sql, ...p) => Promise.resolve(db.prepare(sql).get(...p));
const qa = (db, sql, ...p) => Promise.resolve(db.prepare(sql).all(...p));
const qr = (db, sql, ...p) => Promise.resolve(db.prepare(sql).run(...p));

router.get('/entregas-pendentes', async (req, res) => {
  try {
    const db = getDB();
    res.json(await qa(db, `SELECT p.*, f.nome as fornecedor_nome, o.numero_os, o.cliente, o.prioridade, o.tipo FROM pecas_os p LEFT JOIN fornecedores f ON p.fornecedor_id = f.id LEFT JOIN ordens_servico o ON p.os_id = o.id WHERE p.status_entrega NOT IN ('Entregue','Cancelado','Aguardando Triagem','Separado (Almoxarifado)') ORDER BY CASE o.prioridade WHEN 'Alta' THEN 1 WHEN 'Média' THEN 2 ELSE 3 END, p.data_entrega_prevista ASC`));
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

router.get('/', async (req, res) => {
  try {
    const db = getDB();
    const { os_id, status_entrega } = req.query;
    let where = [], params = [];
    if (os_id)          { where.push('p.os_id = ?');          params.push(os_id); }
    if (status_entrega) { where.push('p.status_entrega = ?');  params.push(status_entrega); }
    const wc = where.length ? 'WHERE ' + where.join(' AND ') : '';
    res.json(await qa(db, `SELECT p.*, f.nome as fornecedor_nome, o.numero_os, o.cliente FROM pecas_os p LEFT JOIN fornecedores f ON p.fornecedor_id = f.id LEFT JOIN ordens_servico o ON p.os_id = o.id ${wc} ORDER BY p.criado_em DESC`, ...params));
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const db = getDB();
    const { os_id, codigo, descricao, quantidade, preco_unitario, preco_cotado, preco_fechado, fornecedor_id, status_entrega, data_entrega_prevista, numero_rastreio, observacoes, transporte } = req.body;
    if (!os_id || !descricao) return res.status(400).json({ erro: 'OS e descrição são obrigatórios' });
    if (!await q(db, 'SELECT id FROM ordens_servico WHERE id = ?', os_id)) return res.status(404).json({ erro: 'O.S. não encontrada' });
    await qr(db, `INSERT INTO pecas_os (os_id,codigo,descricao,quantidade,preco_unitario,preco_cotado,preco_fechado,fornecedor_id,status_entrega,data_entrega_prevista,numero_rastreio,observacoes,transporte) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      os_id, codigo||null, descricao, quantidade||1, preco_unitario||null, preco_cotado||null, preco_fechado||null, fornecedor_id||null, status_entrega||'Pendente', data_entrega_prevista||null, numero_rastreio||null, observacoes||null, transporte||null);
    const nova = await q(db, 'SELECT id FROM pecas_os WHERE os_id = ? ORDER BY id DESC LIMIT 1', os_id);
    res.status(201).json({ id: nova?.id, mensagem: 'Peça adicionada' });
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const db = getDB();
    const p = await q(db, 'SELECT * FROM pecas_os WHERE id = ?', req.params.id);
    if (!p) return res.status(404).json({ erro: 'Peça não encontrada' });
    const { codigo, descricao, quantidade, preco_unitario, preco_cotado, preco_fechado, fornecedor_id, status_entrega, data_entrega_prevista, numero_rastreio, observacoes, transporte } = req.body;
    await qr(db, `UPDATE pecas_os SET codigo=?,descricao=?,quantidade=?,preco_unitario=?,preco_cotado=?,preco_fechado=?,fornecedor_id=?,status_entrega=?,data_entrega_prevista=?,numero_rastreio=?,observacoes=?,transporte=?,atualizado_em=NOW() WHERE id=?`,
      codigo!==undefined?codigo:p.codigo, descricao||p.descricao, quantidade||p.quantidade, preco_unitario!==undefined?preco_unitario:p.preco_unitario, preco_cotado!==undefined?preco_cotado:p.preco_cotado, preco_fechado!==undefined?preco_fechado:p.preco_fechado, fornecedor_id!==undefined?fornecedor_id:p.fornecedor_id, status_entrega||p.status_entrega, data_entrega_prevista!==undefined?data_entrega_prevista:p.data_entrega_prevista, numero_rastreio!==undefined?numero_rastreio:p.numero_rastreio, observacoes!==undefined?observacoes:p.observacoes, transporte!==undefined?transporte:p.transporte, req.params.id);
    res.json({ mensagem: 'Peça atualizada' });
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const db = getDB();
    if (!await q(db, 'SELECT id FROM pecas_os WHERE id = ?', req.params.id)) return res.status(404).json({ erro: 'Peça não encontrada' });
    await qr(db, 'DELETE FROM pecas_os WHERE id = ?', req.params.id);
    res.json({ mensagem: 'Peça removida' });
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

module.exports = router;
