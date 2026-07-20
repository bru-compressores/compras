const express = require('express');
const { getDB } = require('../db/database');
const { autenticar } = require('../middleware/auth');
const router = express.Router();
router.use(autenticar);

const q  = (db, sql, ...p) => Promise.resolve(db.prepare(sql).get(...p));
const qa = (db, sql, ...p) => Promise.resolve(db.prepare(sql).all(...p));
const qr = (db, sql, ...p) => Promise.resolve(db.prepare(sql).run(...p));

router.get('/', async (req, res) => {
  try {
    const db = getDB();
    const { status, prioridade, tipo, busca, pagina = 1, limite = 25 } = req.query;
    let where = [], params = [];
    if (status)     { where.push('o.status = ?');     params.push(status); }
    if (prioridade) { where.push('o.prioridade = ?'); params.push(prioridade); }
    if (tipo)       { where.push('o.tipo = ?');       params.push(tipo); }
    if (busca)      { where.push('(o.numero_os LIKE ? OR o.cliente LIKE ? OR o.equipamento LIKE ?)'); params.push(`%${busca}%`,`%${busca}%`,`%${busca}%`); }
    const wc = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const offset = (parseInt(pagina)-1) * parseInt(limite);
    const totalRow = await q(db, `SELECT COUNT(*) as total FROM ordens_servico o ${wc}`, ...params);
    const total = parseInt(totalRow.total) || 0;
    const registrosRaw = await qa(db, `SELECT o.*, (SELECT COUNT(*) FROM pecas_os p WHERE p.os_id = o.id) as total_pecas, (SELECT COUNT(*) FROM pecas_os p WHERE p.os_id = o.id AND p.status_entrega = 'Entregue') as pecas_entregues FROM ordens_servico o ${wc} ORDER BY CASE o.prioridade WHEN 'Alta' THEN 1 WHEN 'Média' THEN 2 ELSE 3 END, o.data_abertura DESC LIMIT ? OFFSET ?`, ...params, parseInt(limite), offset);
    const registros = registrosRaw.map(r => ({ ...r, total_pecas: parseInt(r.total_pecas)||0, pecas_entregues: parseInt(r.pecas_entregues)||0 }));
    res.json({ total, pagina: parseInt(pagina), limite: parseInt(limite), registros });
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const db = getDB();
    const os = await q(db, 'SELECT * FROM ordens_servico WHERE id = ?', req.params.id);
    if (!os) return res.status(404).json({ erro: 'O.S. não encontrada' });
    const pecas = await qa(db, `SELECT p.*, f.nome as fornecedor_nome FROM pecas_os p LEFT JOIN fornecedores f ON p.fornecedor_id = f.id WHERE p.os_id = ? ORDER BY p.criado_em`, req.params.id);
    const historico = await qa(db, `SELECT h.*, u.nome as usuario_nome FROM historico_status h LEFT JOIN usuarios u ON h.usuario_id = u.id WHERE h.os_id = ? ORDER BY h.criado_em DESC`, req.params.id);
    res.json({ ...os, pecas, historico });
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const db = getDB();
    const { numero_os, cliente, equipamento, data_abertura, data_conclusao_estimada, status, prioridade, tipo, transporte, observacoes } = req.body;
    if (!numero_os || !cliente || !equipamento || !data_abertura) return res.status(400).json({ erro: 'Campos obrigatórios: número, cliente, equipamento, data' });
    if (await q(db, 'SELECT id FROM ordens_servico WHERE numero_os = ?', numero_os)) return res.status(400).json({ erro: 'Número de O.S. já cadastrado' });
    await qr(db, `INSERT INTO ordens_servico (numero_os,cliente,equipamento,data_abertura,data_conclusao_estimada,status,prioridade,tipo,transporte,observacoes,criado_por) VALUES (?,?,?,?,?,?,?,?,?,?,?)`, numero_os, cliente, equipamento, data_abertura, data_conclusao_estimada||null, status||'Aberta', prioridade||'Média', tipo||'OS', transporte||null, observacoes||null, req.usuario.id);
    const nova = await q(db, 'SELECT id FROM ordens_servico WHERE numero_os = ?', numero_os);
    await qr(db, 'INSERT INTO historico_status (os_id,status_anterior,status_novo,observacao,usuario_id) VALUES (?,?,?,?,?)', nova.id, null, status||'Aberta', 'O.S. criada', req.usuario.id);
    res.status(201).json({ id: nova.id, mensagem: 'O.S. criada' });
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const db = getDB();
    const os = await q(db, 'SELECT * FROM ordens_servico WHERE id = ?', req.params.id);
    if (!os) return res.status(404).json({ erro: 'O.S. não encontrada' });
    const { numero_os, cliente, equipamento, data_abertura, data_conclusao_estimada, status, prioridade, tipo, transporte, observacoes } = req.body;
    await qr(db, `UPDATE ordens_servico SET numero_os=?,cliente=?,equipamento=?,data_abertura=?,data_conclusao_estimada=?,status=?,prioridade=?,tipo=?,transporte=?,observacoes=?,atualizado_em=NOW() WHERE id=?`,
      numero_os||os.numero_os, cliente||os.cliente, equipamento||os.equipamento, data_abertura||os.data_abertura, data_conclusao_estimada!==undefined?data_conclusao_estimada:os.data_conclusao_estimada, status||os.status, prioridade||os.prioridade, tipo||os.tipo||'OS', transporte!==undefined?transporte:os.transporte, observacoes!==undefined?observacoes:os.observacoes, req.params.id);
    if (status && status !== os.status)
      await qr(db, 'INSERT INTO historico_status (os_id,status_anterior,status_novo,observacao,usuario_id) VALUES (?,?,?,?,?)', req.params.id, os.status, status, req.body.obs_historico||null, req.usuario.id);
    res.json({ mensagem: 'O.S. atualizada' });
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const db = getDB();
    if (!await q(db, 'SELECT id FROM ordens_servico WHERE id = ?', req.params.id)) return res.status(404).json({ erro: 'O.S. não encontrada' });
    await qr(db, 'DELETE FROM ordens_servico WHERE id = ?', req.params.id);
    res.json({ mensagem: 'O.S. removida' });
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

router.post('/:id/duplicar', async (req, res) => {
  try {
    const db = getDB();
    const os = await q(db, 'SELECT * FROM ordens_servico WHERE id = ?', req.params.id);
    if (!os) return res.status(404).json({ erro: 'O.S. não encontrada' });
    const pecas = await qa(db, 'SELECT * FROM pecas_os WHERE os_id = ?', req.params.id);
    const novoNumero = (req.body.numero_os || os.numero_os + '-COPIA').toString();
    if (await q(db, 'SELECT id FROM ordens_servico WHERE numero_os = ?', novoNumero)) return res.status(400).json({ erro: 'Número ' + novoNumero + ' já existe.' });
    await qr(db, `INSERT INTO ordens_servico (numero_os,cliente,equipamento,data_abertura,data_conclusao_estimada,status,prioridade,tipo,transporte,observacoes,criado_por) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      novoNumero, os.cliente, os.equipamento, new Date().toISOString().split('T')[0], os.data_conclusao_estimada||null, 'Aberta', os.prioridade, os.tipo||'OS', os.transporte||null, os.observacoes||null, req.usuario.id);
    const nova = await q(db, 'SELECT id FROM ordens_servico WHERE numero_os = ?', novoNumero);
    for (const p of pecas) await qr(db, `INSERT INTO pecas_os (os_id,codigo,descricao,quantidade,preco_unitario,status_entrega) VALUES (?,?,?,?,?,'Pendente')`, nova.id, p.codigo||null, p.descricao, p.quantidade, p.preco_unitario||null);
    await qr(db, 'INSERT INTO historico_status (os_id,status_anterior,status_novo,observacao,usuario_id) VALUES (?,?,?,?,?)', nova.id, null, 'Aberta', 'Duplicada da O.S. ' + os.numero_os, req.usuario.id);
    res.json({ id: nova.id, numero_os: novoNumero, pecas_copiadas: pecas.length });
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

module.exports = router;
