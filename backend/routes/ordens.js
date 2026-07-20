const express = require('express');
const { getDB } = require('../db/database');
const { autenticar } = require('../middleware/auth');
const router = express.Router();
router.use(autenticar);

router.get('/', (req, res) => {
  const db = getDB();
  const { status, prioridade, tipo, busca, pagina = 1, limite = 25 } = req.query;
  let where = [], params = [];
  if (status)    { where.push('o.status = ?');    params.push(status); }
  if (prioridade){ where.push('o.prioridade = ?');params.push(prioridade); }
  if (tipo)      { where.push('o.tipo = ?');      params.push(tipo); }
  if (busca)     { where.push('(o.numero_os LIKE ? OR o.cliente LIKE ? OR o.equipamento LIKE ?)'); params.push(`%${busca}%`,`%${busca}%`,`%${busca}%`); }
  const wc = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const offset = (parseInt(pagina)-1) * parseInt(limite);
  const total = db.prepare(`SELECT COUNT(*) as total FROM ordens_servico o ${wc}`).get(...params).total;
  const registros = db.prepare(`
    SELECT o.*,
      (SELECT COUNT(*) FROM pecas_os p WHERE p.os_id = o.id) as total_pecas,
      (SELECT COUNT(*) FROM pecas_os p WHERE p.os_id = o.id AND p.status_entrega = 'Entregue') as pecas_entregues
    FROM ordens_servico o ${wc}
    ORDER BY
      CASE o.prioridade WHEN 'Alta' THEN 1 WHEN 'Média' THEN 2 ELSE 3 END,
      CASE o.status WHEN 'Aberta' THEN 1 WHEN 'Aguardando peças' THEN 2 WHEN 'Peças separadas' THEN 3 ELSE 4 END,
      o.data_abertura DESC LIMIT ? OFFSET ?
  `).all(...params, parseInt(limite), offset);
  res.json({ total, pagina: parseInt(pagina), limite: parseInt(limite), registros });
});

router.get('/:id', (req, res) => {
  const db = getDB();
  const os = db.prepare('SELECT * FROM ordens_servico WHERE id = ?').get(req.params.id);
  if (!os) return res.status(404).json({ erro: 'O.S. não encontrada' });
  const pecas = db.prepare(`
    SELECT p.*, f.nome as fornecedor_nome
    FROM pecas_os p LEFT JOIN fornecedores f ON p.fornecedor_id = f.id
    WHERE p.os_id = ? ORDER BY p.criado_em
  `).all(req.params.id);
  const historico = db.prepare(`
    SELECT h.*, u.nome as usuario_nome
    FROM historico_status h LEFT JOIN usuarios u ON h.usuario_id = u.id
    WHERE h.os_id = ? ORDER BY h.criado_em DESC
  `).all(req.params.id);
  res.json({ ...os, pecas, historico });
});

router.post('/', (req, res) => {
  const db = getDB();
  const { numero_os, cliente, equipamento, data_abertura, data_conclusao_estimada, status, prioridade, tipo, transporte, observacoes } = req.body;
  if (!numero_os || !cliente || !equipamento || !data_abertura) return res.status(400).json({ erro: 'Campos obrigatórios: número, cliente, equipamento, data' });
  if (db.prepare('SELECT id FROM ordens_servico WHERE numero_os = ?').get(numero_os)) return res.status(400).json({ erro: 'Número de O.S. já cadastrado' });
  db.prepare(`INSERT INTO ordens_servico (numero_os,cliente,equipamento,data_abertura,data_conclusao_estimada,status,prioridade,tipo,transporte,observacoes,criado_por) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .run(numero_os, cliente, equipamento, data_abertura, data_conclusao_estimada||null, status||'Aberta', prioridade||'Média', tipo||'OS', transporte||null, observacoes||null, req.usuario.id);
  const novaOS = db.prepare('SELECT id FROM ordens_servico WHERE numero_os = ?').get(numero_os);
  db.prepare('INSERT INTO historico_status (os_id,status_anterior,status_novo,observacao,usuario_id) VALUES (?,?,?,?,?)').run(novaOS.id, null, status||'Aberta', 'O.S. criada', req.usuario.id);
  res.status(201).json({ id: novaOS.id, mensagem: 'O.S. criada' });
});

router.put('/:id', (req, res) => {
  const db = getDB();
  const os = db.prepare('SELECT * FROM ordens_servico WHERE id = ?').get(req.params.id);
  if (!os) return res.status(404).json({ erro: 'O.S. não encontrada' });
  const { numero_os, cliente, equipamento, data_abertura, data_conclusao_estimada, status, prioridade, tipo, transporte, observacoes } = req.body;
  db.prepare(`UPDATE ordens_servico SET numero_os=?,cliente=?,equipamento=?,data_abertura=?,data_conclusao_estimada=?,status=?,prioridade=?,tipo=?,transporte=?,observacoes=?,atualizado_em=datetime('now','localtime') WHERE id=?`)
    .run(numero_os||os.numero_os, cliente||os.cliente, equipamento||os.equipamento, data_abertura||os.data_abertura, data_conclusao_estimada??os.data_conclusao_estimada, status||os.status, prioridade||os.prioridade, tipo||os.tipo||'OS', transporte??os.transporte, observacoes??os.observacoes, req.params.id);
  if (status && status !== os.status)
    db.prepare('INSERT INTO historico_status (os_id,status_anterior,status_novo,observacao,usuario_id) VALUES (?,?,?,?,?)').run(req.params.id, os.status, status, req.body.obs_historico||null, req.usuario.id);
  res.json({ mensagem: 'O.S. atualizada' });
});

router.delete('/:id', (req, res) => {
  const db = getDB();
  if (!db.prepare('SELECT id FROM ordens_servico WHERE id = ?').get(req.params.id)) return res.status(404).json({ erro: 'O.S. não encontrada' });
  db.prepare('DELETE FROM ordens_servico WHERE id = ?').run(req.params.id);
  res.json({ mensagem: 'O.S. removida' });
});

// POST /api/os/:id/duplicar
router.post('/:id/duplicar', (req, res) => {
  const db = getDB();
  const os = db.prepare('SELECT * FROM ordens_servico WHERE id = ?').get(req.params.id);
  if (!os) return res.status(404).json({ erro: 'O.S. não encontrada' });

  const pecas = db.prepare('SELECT * FROM pecas_os WHERE os_id = ?').all(req.params.id);
  const novoNumero = (req.body.numero_os || os.numero_os + '-COPIA').toString();

  if (db.prepare('SELECT id FROM ordens_servico WHERE numero_os = ?').get(novoNumero)) {
    return res.status(400).json({ erro: 'Número ' + novoNumero + ' já existe. Escolha outro.' });
  }

  db.prepare(`INSERT INTO ordens_servico
    (numero_os, cliente, equipamento, data_abertura, data_conclusao_estimada, status, prioridade, tipo, transporte, observacoes, criado_por)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .run(novoNumero, os.cliente, os.equipamento, new Date().toISOString().split('T')[0],
        os.data_conclusao_estimada||null, 'Aberta', os.prioridade, os.tipo||'OS',
        os.transporte||null, os.observacoes||null, req.usuario.id);

  const nova = db.prepare('SELECT id FROM ordens_servico WHERE numero_os = ?').get(novoNumero);

  for (const p of pecas) {
    db.prepare(`INSERT INTO pecas_os (os_id,codigo,descricao,quantidade,preco_unitario,status_entrega)
      VALUES (?,?,?,?,?,'Pendente')`)
      .run(nova.id, p.codigo||null, p.descricao, p.quantidade, p.preco_unitario||null);
  }

  db.prepare('INSERT INTO historico_status (os_id,status_anterior,status_novo,observacao,usuario_id) VALUES (?,?,?,?,?)')
    .run(nova.id, null, 'Aberta', 'Duplicada da O.S. ' + os.numero_os, req.usuario.id);

  res.json({ id: nova.id, numero_os: novoNumero, pecas_copiadas: pecas.length });
});

module.exports = router;
