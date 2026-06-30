const express = require('express');
const { getDB } = require('../db/database');
const { autenticar } = require('../middleware/auth');
const router = express.Router();
router.use(autenticar);

const q  = (db, sql, ...p) => Promise.resolve(db.prepare(sql).get(...p));
const qa = (db, sql, ...p) => Promise.resolve(db.prepare(sql).all(...p));
const qr = (db, sql, ...p) => Promise.resolve(db.prepare(sql).run(...p));

// GET /api/triagem — lista O.S. com peças aguardando triagem, agrupadas
router.get('/', async (req, res) => {
  try {
    const db = getDB();
    const osComTriagem = await qa(db, `
      SELECT DISTINCT o.id, o.numero_os, o.cliente, o.equipamento, o.tipo, o.prioridade, o.data_abertura,
        (SELECT COUNT(*) FROM pecas_os p2 WHERE p2.os_id = o.id AND p2.status_entrega = 'Aguardando Triagem') as pendentes_triagem,
        (SELECT COUNT(*) FROM pecas_os p2 WHERE p2.os_id = o.id) as total_pecas
      FROM ordens_servico o
      JOIN pecas_os p ON p.os_id = o.id
      WHERE p.status_entrega = 'Aguardando Triagem'
      ORDER BY o.data_abertura DESC
    `);
    res.json(osComTriagem.map(os => ({
      ...os,
      pendentes_triagem: parseInt(os.pendentes_triagem)||0,
      total_pecas: parseInt(os.total_pecas)||0
    })));
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

// GET /api/triagem/:os_id — peças de uma O.S. específica para triagem
router.get('/:os_id', async (req, res) => {
  try {
    const db = getDB();
    const os = await q(db, 'SELECT * FROM ordens_servico WHERE id = ?', req.params.os_id);
    if (!os) return res.status(404).json({ erro: 'O.S. não encontrada' });
    const pecas = await qa(db, `SELECT p.*, f.nome as fornecedor_nome FROM pecas_os p LEFT JOIN fornecedores f ON p.fornecedor_id = f.id WHERE p.os_id = ? ORDER BY p.criado_em`, req.params.os_id);
    res.json({ ...os, pecas });
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

// PUT /api/triagem/peca/:id — marca decisão da triagem
router.put('/peca/:id', async (req, res) => {
  try {
    const db = getDB();
    const { decisao } = req.body; // 'separado' ou 'comprar'
    if (!['separado','comprar'].includes(decisao)) return res.status(400).json({ erro: 'Decisão inválida' });
    const novoStatus = decisao === 'separado' ? 'Separado (Almoxarifado)' : 'Pendente';
    await qr(db, 'UPDATE pecas_os SET status_entrega=?, atualizado_em=NOW() WHERE id=?', novoStatus, req.params.id);
    res.json({ mensagem: 'Triagem aplicada', status: novoStatus });
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

// POST /api/triagem/:os_id/finalizar — marca todas as restantes (sem decisão) como "Pendente" (default seguro)
router.post('/:os_id/finalizar', async (req, res) => {
  try {
    const db = getDB();
    await qr(db, `UPDATE pecas_os SET status_entrega='Pendente', atualizado_em=NOW() WHERE os_id=? AND status_entrega='Aguardando Triagem'`, req.params.os_id);
    res.json({ mensagem: 'Triagem finalizada' });
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

module.exports = router;
