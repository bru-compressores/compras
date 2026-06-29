const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { getDB }      = require('../db/database');
const { autenticar, apenasAdmin } = require('../middleware/auth');

const router = express.Router();
const SECRET = process.env.JWT_SECRET || 'bru-secret-local-dev';

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, senha } = req.body;
    if (!email || !senha) return res.status(400).json({ erro: 'Email e senha obrigatórios' });
    const db = getDB();
    const usuario = await Promise.resolve(db.prepare('SELECT * FROM usuarios WHERE email = ? AND ativo = 1').get(email));
    if (!usuario) return res.status(401).json({ erro: 'Credenciais inválidas' });
    const ok = await bcrypt.compare(senha, usuario.senha_hash);
    if (!ok) return res.status(401).json({ erro: 'Credenciais inválidas' });
    const token = jwt.sign({ id: usuario.id, email: usuario.email, papel: usuario.papel }, SECRET, { expiresIn: '7d' });
    res.json({ token, usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, papel: usuario.papel } });
  } catch(e) {
    console.error('Login error:', e.message);
    res.status(500).json({ erro: 'Erro interno: ' + e.message });
  }
});

// GET /api/usuarios
router.get('/', autenticar, apenasAdmin, async (req, res) => {
  try {
    const db = getDB();
    const lista = await Promise.resolve(db.prepare('SELECT id, nome, email, papel, ativo, criado_em FROM usuarios ORDER BY nome').all());
    res.json(lista);
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

// POST /api/usuarios
router.post('/', autenticar, apenasAdmin, async (req, res) => {
  try {
    const { nome, email, senha, papel } = req.body;
    if (!nome || !email || !senha) return res.status(400).json({ erro: 'Nome, email e senha obrigatórios' });
    const db = getDB();
    const existe = await Promise.resolve(db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email));
    if (existe) return res.status(400).json({ erro: 'Email já cadastrado' });
    const hash = await bcrypt.hash(senha, 10);
    await Promise.resolve(db.prepare("INSERT INTO usuarios (nome, email, senha_hash, papel) VALUES (?, ?, ?, ?)").run(nome, email, hash, papel || 'operador'));
    const novo = await Promise.resolve(db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email));
    res.status(201).json({ id: novo?.id, mensagem: 'Usuário criado' });
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

// PUT /api/usuarios/:id
router.put('/:id', autenticar, async (req, res) => {
  try {
    const { nome, email, senha, papel, ativo } = req.body;
    const db = getDB();
    const u = await Promise.resolve(db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.params.id));
    if (!u) return res.status(404).json({ erro: 'Usuário não encontrado' });
    const hash = senha ? await bcrypt.hash(senha, 10) : u.senha_hash;
    await Promise.resolve(db.prepare('UPDATE usuarios SET nome=?, email=?, senha_hash=?, papel=?, ativo=? WHERE id=?')
      .run(nome || u.nome, email || u.email, hash, papel || u.papel, ativo !== undefined ? (ativo ? 1 : 0) : u.ativo, req.params.id));
    res.json({ mensagem: 'Usuário atualizado' });
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

module.exports = router;
