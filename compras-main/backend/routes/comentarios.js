const express = require('express');
const { getDB } = require('../db/database');
const { autenticar } = require('../middleware/auth');
const router = express.Router();
router.use(autenticar);

const q  = (db, sql, ...p) => Promise.resolve(db.prepare(sql).get(...p));
const qa = (db, sql, ...p) => Promise.resolve(db.prepare(sql).all(...p));
const qr = (db, sql, ...p) => Promise.resolve(db.prepare(sql).run(...p));

router.get('/:peca_id', async (req, res) => {
  try {
    const db = getDB();
    res.json(await qa(db, `SELECT c.*, u.nome as usuario_nome FROM comentarios_peca c LEFT JOIN usuarios u ON c.usuario_id = u.id WHERE c.peca_id = ? ORDER BY c.criado_em ASC`, req.params.peca_id));
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

router.post('/:peca_id', async (req, res) => {
  try {
    const db = getDB();
    const { texto } = req.body;
    if (!texto?.trim()) return res.status(400).json({ erro: 'Texto obrigatório' });
    await qr(db, 'INSERT INTO comentarios_peca (peca_id,usuario_id,texto) VALUES (?,?,?)', req.params.peca_id, req.usuario.id, texto.trim());
    const novo = await q(db, `SELECT c.*, u.nome as usuario_nome FROM comentarios_peca c LEFT JOIN usuarios u ON c.usuario_id = u.id WHERE c.peca_id = ? ORDER BY c.id DESC LIMIT 1`, req.params.peca_id);
    res.status(201).json(novo);
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

router.delete('/item/:id', async (req, res) => {
  try {
    const db = getDB();
    const c = await q(db, 'SELECT * FROM comentarios_peca WHERE id = ?', req.params.id);
    if (!c) return res.status(404).json({ erro: 'Comentário não encontrado' });
    await qr(db, 'DELETE FROM comentarios_peca WHERE id = ?', req.params.id);
    res.json({ mensagem: 'Removido' });
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

module.exports = router;
