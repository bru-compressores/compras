const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { getDB } = require('../db/database');
const { autenticar, apenasAdmin, JWT_SECRET } = require('../middleware/auth');
const router = express.Router();

router.post('/login', (req, res) => {
  const db = getDB();
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ erro: 'Email e senha obrigatórios' });
  const usuario = db.prepare('SELECT * FROM usuarios WHERE email = ? AND ativo = 1').get(email);
  if (!usuario || !bcrypt.compareSync(senha, usuario.senha_hash))
    return res.status(401).json({ erro: 'Credenciais inválidas' });
  const token = jwt.sign({ id: usuario.id, nome: usuario.nome, email: usuario.email, papel: usuario.papel }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ token, usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, papel: usuario.papel } });
});

router.get('/', autenticar, apenasAdmin, (req, res) => {
  const db = getDB();
  res.json(db.prepare('SELECT id, nome, email, papel, ativo, criado_em FROM usuarios ORDER BY nome').all());
});

router.post('/', autenticar, apenasAdmin, (req, res) => {
  const db = getDB();
  const { nome, email, senha, papel } = req.body;
  if (!nome || !email || !senha) return res.status(400).json({ erro: 'Nome, email e senha são obrigatórios' });
  if (db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email)) return res.status(400).json({ erro: 'Email já cadastrado' });
  const hash = bcrypt.hashSync(senha, 10);
  const r = db.prepare('INSERT INTO usuarios (nome, email, senha_hash, papel) VALUES (?, ?, ?, ?)').run(nome, email, hash, papel || 'operador');
  res.status(201).json({ id: r.lastInsertRowid, nome, email, papel: papel || 'operador' });
});

router.put('/:id', autenticar, apenasAdmin, (req, res) => {
  const db = getDB();
  const u = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.params.id);
  if (!u) return res.status(404).json({ erro: 'Usuário não encontrado' });
  const { nome, email, papel, ativo, senha } = req.body;
  if (senha) {
    db.prepare('UPDATE usuarios SET nome=?, email=?, papel=?, ativo=?, senha_hash=? WHERE id=?')
      .run(nome||u.nome, email||u.email, papel||u.papel, ativo!==undefined?(ativo?1:0):u.ativo, bcrypt.hashSync(senha,10), req.params.id);
  } else {
    db.prepare('UPDATE usuarios SET nome=?, email=?, papel=?, ativo=? WHERE id=?')
      .run(nome||u.nome, email||u.email, papel||u.papel, ativo!==undefined?(ativo?1:0):u.ativo, req.params.id);
  }
  res.json({ mensagem: 'Usuário atualizado' });
});

router.delete('/:id', autenticar, apenasAdmin, (req, res) => {
  const db = getDB();
  if (parseInt(req.params.id) === req.usuario.id) return res.status(400).json({ erro: 'Não pode excluir sua própria conta' });
  db.prepare('UPDATE usuarios SET ativo = 0 WHERE id = ?').run(req.params.id);
  res.json({ mensagem: 'Usuário desativado' });
});

module.exports = router;
