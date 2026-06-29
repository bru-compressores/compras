const express = require('express');
const { getDB } = require('../db/database');
const { autenticar } = require('../middleware/auth');
const router = express.Router();
router.use(autenticar);

// GET /api/comentarios/:peca_id
router.get('/:peca_id', (req, res) => {
  const db = getDB();
  const rows = db.prepare(`
    SELECT c.*, u.nome as usuario_nome
    FROM comentarios_peca c
    LEFT JOIN usuarios u ON c.usuario_id = u.id
    WHERE c.peca_id = ?
    ORDER BY c.criado_em ASC
  `).all(req.params.peca_id);
  res.json(rows);
});

// POST /api/comentarios/:peca_id
router.post('/:peca_id', (req, res) => {
  const db = getDB();
  const { texto } = req.body;
  if (!texto?.trim()) return res.status(400).json({ erro: 'Texto obrigatório' });
  if (!db.prepare('SELECT id FROM pecas_os WHERE id = ?').get(req.params.peca_id))
    return res.status(404).json({ erro: 'Peça não encontrada' });
  db.prepare('INSERT INTO comentarios_peca (peca_id, usuario_id, texto) VALUES (?,?,?)')
    .run(req.params.peca_id, req.usuario.id, texto.trim());
  const novo = db.prepare(`
    SELECT c.*, u.nome as usuario_nome FROM comentarios_peca c
    LEFT JOIN usuarios u ON c.usuario_id = u.id
    WHERE c.peca_id = ? ORDER BY c.id DESC LIMIT 1
  `).get(req.params.peca_id);
  res.status(201).json(novo);
});

// DELETE /api/comentarios/item/:id
router.delete('/item/:id', (req, res) => {
  const db = getDB();
  const c = db.prepare('SELECT * FROM comentarios_peca WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ erro: 'Comentário não encontrado' });
  if (c.usuario_id !== req.usuario.id && req.usuario.papel !== 'admin')
    return res.status(403).json({ erro: 'Sem permissão' });
  db.prepare('DELETE FROM comentarios_peca WHERE id = ?').run(req.params.id);
  res.json({ mensagem: 'Removido' });
});

module.exports = router;
