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
    const { busca } = req.query;
    let sql = 'SELECT f.*, COUNT(p.id) as total_pecas FROM fornecedores f LEFT JOIN pecas_os p ON p.fornecedor_id = f.id';
    const params = [];
    if (busca) { sql += ' WHERE f.nome LIKE ? OR f.cnpj LIKE ? OR f.cidade LIKE ?'; params.push(`%${busca}%`,`%${busca}%`,`%${busca}%`); }
    sql += ' GROUP BY f.id ORDER BY f.nome';
    res.json(await qa(db, sql, ...params));
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const db = getDB();
    const f = await q(db, 'SELECT * FROM fornecedores WHERE id = ?', req.params.id);
    if (!f) return res.status(404).json({ erro: 'Fornecedor não encontrado' });
    res.json(f);
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const db = getDB();
    const { nome, cnpj, contato, telefone, email, cidade, estado, observacoes } = req.body;
    if (!nome) return res.status(400).json({ erro: 'Nome é obrigatório' });
    await qr(db, 'INSERT INTO fornecedores (nome,cnpj,contato,telefone,email,cidade,estado,observacoes) VALUES (?,?,?,?,?,?,?,?)', nome, cnpj||null, contato||null, telefone||null, email||null, cidade||null, estado||null, observacoes||null);
    const novo = await q(db, 'SELECT id FROM fornecedores WHERE nome = ? ORDER BY id DESC LIMIT 1', nome);
    res.status(201).json({ id: novo?.id, mensagem: 'Fornecedor cadastrado' });
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const db = getDB();
    const f = await q(db, 'SELECT * FROM fornecedores WHERE id = ?', req.params.id);
    if (!f) return res.status(404).json({ erro: 'Fornecedor não encontrado' });
    const { nome, cnpj, contato, telefone, email, cidade, estado, observacoes } = req.body;
    await qr(db, 'UPDATE fornecedores SET nome=?,cnpj=?,contato=?,telefone=?,email=?,cidade=?,estado=?,observacoes=? WHERE id=?',
      nome||f.nome, cnpj!==undefined?cnpj:f.cnpj, contato!==undefined?contato:f.contato, telefone!==undefined?telefone:f.telefone, email!==undefined?email:f.email, cidade!==undefined?cidade:f.cidade, estado!==undefined?estado:f.estado, observacoes!==undefined?observacoes:f.observacoes, req.params.id);
    res.json({ mensagem: 'Fornecedor atualizado' });
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const db = getDB();
    if (await q(db, 'SELECT id FROM pecas_os WHERE fornecedor_id = ? LIMIT 1', req.params.id)) return res.status(400).json({ erro: 'Fornecedor vinculado a peças' });
    await qr(db, 'DELETE FROM fornecedores WHERE id = ?', req.params.id);
    res.json({ mensagem: 'Fornecedor removido' });
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

module.exports = router;
