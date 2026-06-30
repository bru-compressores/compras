const express = require('express');
const { getDB } = require('../db/database');
const { autenticar } = require('../middleware/auth');
const router = express.Router();
router.use(autenticar);

router.get('/dashboard', async (req, res) => {
  try {
    const db = getDB();
    const qa = (sql, ...p) => Promise.resolve(db.prepare(sql).all(...p));
    const q  = (sql, ...p) => Promise.resolve(db.prepare(sql).get(...p));

    const [por_status, por_prioridade, val, atrasadas, transito, pendentes, mk, recentes, pecas_atrasadas, os_vencendo] = await Promise.all([
      qa(`SELECT status, COUNT(*) as total FROM ordens_servico GROUP BY status`),
      qa(`SELECT prioridade, COUNT(*) as total FROM ordens_servico GROUP BY prioridade`),
      q(`SELECT SUM(p.preco_unitario * p.quantidade) as total FROM pecas_os p JOIN ordens_servico o ON p.os_id = o.id WHERE o.status != 'Concluída'`),
      q(`SELECT COUNT(*) as total FROM ordens_servico WHERE data_conclusao_estimada::date < CURRENT_DATE AND status != 'Concluída'`),
      q(`SELECT COUNT(*) as total FROM pecas_os WHERE status_entrega = 'Em trânsito'`),
      q(`SELECT COUNT(*) as total FROM pecas_os WHERE status_entrega NOT IN ('Entregue','Cancelado')`),
      q(`SELECT AVG(CASE WHEN p.preco_fechado > 0 THEN p.preco_unitario * 1.0 / p.preco_fechado ELSE NULL END) as mk FROM pecas_os p JOIN ordens_servico o ON p.os_id = o.id WHERE o.status != 'Concluída' AND p.preco_unitario > 0 AND p.preco_fechado > 0`),
      qa(`SELECT o.*, (SELECT COUNT(*) FROM pecas_os p WHERE p.os_id = o.id) as total_pecas, (SELECT COUNT(*) FROM pecas_os p WHERE p.os_id = o.id AND p.status_entrega = 'Entregue') as pecas_entregues FROM ordens_servico o ORDER BY o.atualizado_em DESC LIMIT 5`),
      qa(`SELECT p.id, p.descricao, p.data_entrega_prevista, p.status_entrega, o.numero_os, o.cliente, o.prioridade, o.id as os_id, CAST(EXTRACT(DAY FROM NOW() - p.data_entrega_prevista::date::timestamp) AS INTEGER) as dias_atraso FROM pecas_os p JOIN ordens_servico o ON p.os_id = o.id WHERE p.data_entrega_prevista::date < CURRENT_DATE AND p.status_entrega NOT IN ('Entregue','Cancelado') AND o.status != 'Concluída' ORDER BY dias_atraso DESC LIMIT 10`),
      qa(`SELECT id, numero_os, cliente, data_conclusao_estimada, prioridade, status, CAST(EXTRACT(DAY FROM data_conclusao_estimada::date::timestamp - NOW()) AS INTEGER) as dias_restantes FROM ordens_servico WHERE data_conclusao_estimada::date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days' AND status != 'Concluída' ORDER BY data_conclusao_estimada::date ASC LIMIT 10`),
    ]);

    res.json({
      por_status, por_prioridade,
      valor_total_aberto: val?.total || 0,
      os_atrasadas: atrasadas?.total || 0,
      em_transito: transito?.total || 0,
      entregas_pendentes: pendentes?.total || 0,
      markup_medio: mk?.mk ? parseFloat(parseFloat(mk.mk).toFixed(2)) : null,
      recentes, pecas_atrasadas, os_vencendo
    });
  } catch(e) { console.error('Dashboard error:', e.message); res.status(500).json({ erro: e.message }); }
});

module.exports = router;
