const express = require('express');
const { getDB } = require('../db/database');
const { autenticar } = require('../middleware/auth');
const router = express.Router();
router.use(autenticar);

router.get('/', (req, res) => {
  const db = getDB();
  const { busca } = req.query;
  let q = 'SELECT f.*, COUNT(p.id) as total_pecas FROM fornecedores f LEFT JOIN pecas_os p ON p.fornecedor_id = f.id';
  const params = [];
  if (busca) { q += ' WHERE f.nome LIKE ? OR f.cnpj LIKE ? OR f.cidade LIKE ?'; params.push('%'+busca+'%','%'+busca+'%','%'+busca+'%'); }
  q += ' GROUP BY f.id ORDER BY f.nome';
  res.json(db.prepare(q).all(...params));
});

router.get('/:id', (req, res) => {
  const db = getDB();
  const f = db.prepare('SELECT * FROM fornecedores WHERE id = ?').get(req.params.id);
  if (!f) return res.status(404).json({ erro: 'Fornecedor não encontrado' });
  const pecas = db.prepare('SELECT p.*, o.numero_os, o.cliente FROM pecas_os p LEFT JOIN ordens_servico o ON p.os_id = o.id WHERE p.fornecedor_id = ? ORDER BY p.criado_em DESC LIMIT 20').all(req.params.id);
  res.json({ ...f, pecas_recentes: pecas });
});

router.post('/', (req, res) => {
  const db = getDB();
  const { nome, cnpj, contato, telefone, email, cidade, estado, observacoes } = req.body;
  if (!nome) return res.status(400).json({ erro: 'Nome é obrigatório' });
  const r = db.prepare('INSERT INTO fornecedores (nome, cnpj, contato, telefone, email, cidade, estado, observacoes) VALUES (?,?,?,?,?,?,?,?)').run(nome, cnpj||null, contato||null, telefone||null, email||null, cidade||null, estado||null, observacoes||null);
  const novo = db.prepare('SELECT id FROM fornecedores WHERE nome = ? ORDER BY id DESC LIMIT 1').get(nome);
  res.status(201).json({ id: novo?.id, mensagem: 'Fornecedor cadastrado' });
});

router.put('/:id', (req, res) => {
  const db = getDB();
  const f = db.prepare('SELECT * FROM fornecedores WHERE id = ?').get(req.params.id);
  if (!f) return res.status(404).json({ erro: 'Fornecedor não encontrado' });
  const { nome, cnpj, contato, telefone, email, cidade, estado, observacoes } = req.body;
  db.prepare('UPDATE fornecedores SET nome=?,cnpj=?,contato=?,telefone=?,email=?,cidade=?,estado=?,observacoes=? WHERE id=?')
    .run(nome||f.nome, cnpj??f.cnpj, contato??f.contato, telefone??f.telefone, email??f.email, cidade??f.cidade, estado??f.estado, observacoes??f.observacoes, req.params.id);
  res.json({ mensagem: 'Fornecedor atualizado' });
});

router.delete('/:id', (req, res) => {
  const db = getDB();
  if (db.prepare('SELECT id FROM pecas_os WHERE fornecedor_id = ? LIMIT 1').get(req.params.id))
    return res.status(400).json({ erro: 'Fornecedor vinculado a peças, não pode ser excluído' });
  db.prepare('DELETE FROM fornecedores WHERE id = ?').run(req.params.id);
  res.json({ mensagem: 'Fornecedor removido' });
});

module.exports = router;
