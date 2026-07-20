const express = require('express');
const { getDB } = require('../db/database');
const { autenticar } = require('../middleware/auth');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const fs = require('fs');
const router = express.Router();
router.use(autenticar);
const upload = multer({ dest: require('os').tmpdir() });

router.get('/dashboard', (req, res) => {
  const db = getDB();
  const por_status        = db.prepare(`SELECT status, COUNT(*) as total FROM ordens_servico GROUP BY status`).all();
  const por_prioridade    = db.prepare(`SELECT prioridade, COUNT(*) as total FROM ordens_servico WHERE status != 'Concluída' GROUP BY prioridade`).all();
  const entregas_pendentes= db.prepare(`SELECT COUNT(*) as total FROM pecas_os WHERE status_entrega NOT IN ('Entregue','Cancelado')`).get().total;
  const em_transito       = db.prepare(`SELECT COUNT(*) as total FROM pecas_os WHERE status_entrega = 'Em trânsito'`).get().total;
  const valor_total_aberto= db.prepare(`SELECT COALESCE(SUM(p.preco_unitario * p.quantidade), 0) as total FROM pecas_os p JOIN ordens_servico o ON p.os_id = o.id WHERE o.status != 'Concluída'`).get().total;
  const os_atrasadas      = db.prepare(`SELECT COUNT(*) as total FROM ordens_servico WHERE data_conclusao_estimada < date('now') AND status != 'Concluída'`).get().total;
  const markup_medio_row  = db.prepare(`
    SELECT AVG(CASE WHEN p.preco_fechado > 0 THEN p.preco_unitario * 1.0 / p.preco_fechado ELSE NULL END) as mk
    FROM pecas_os p JOIN ordens_servico o ON p.os_id = o.id
    WHERE o.status != 'Concluída' AND p.preco_unitario > 0 AND p.preco_fechado > 0
  `).get();
  const markup_medio = markup_medio_row?.mk ? parseFloat(markup_medio_row.mk.toFixed(2)) : null;
  const recentes          = db.prepare(`SELECT o.*, (SELECT COUNT(*) FROM pecas_os p WHERE p.os_id = o.id) as total_pecas, (SELECT COUNT(*) FROM pecas_os p WHERE p.os_id = o.id AND p.status_entrega = 'Entregue') as pecas_entregues FROM ordens_servico o ORDER BY o.atualizado_em DESC LIMIT 5`).all();

  // Peças com entrega atrasada (data prevista < hoje e não entregues)
  const pecas_atrasadas = db.prepare(`
    SELECT p.id, p.descricao, p.data_entrega_prevista, p.status_entrega,
           o.numero_os, o.cliente, o.prioridade, o.id as os_id,
           CAST(julianday('now') - julianday(p.data_entrega_prevista) AS INTEGER) as dias_atraso
    FROM pecas_os p
    JOIN ordens_servico o ON p.os_id = o.id
    WHERE p.data_entrega_prevista < date('now','localtime')
      AND p.status_entrega NOT IN ('Entregue','Cancelado')
      AND o.status != 'Concluída'
    ORDER BY dias_atraso DESC
    LIMIT 10
  `).all();

  // O.S. com prazo vencendo em breve (próximos 7 dias)
  const os_vencendo = db.prepare(`
    SELECT id, numero_os, cliente, data_conclusao_estimada, prioridade, status,
           CAST(julianday(data_conclusao_estimada) - julianday('now') AS INTEGER) as dias_restantes
    FROM ordens_servico
    WHERE data_conclusao_estimada BETWEEN date('now','localtime') AND date('now','localtime','+7 days')
      AND status != 'Concluída'
    ORDER BY data_conclusao_estimada ASC
    LIMIT 10
  `).all();
  res.json({ por_status, por_prioridade, entregas_pendentes, em_transito, valor_total_aberto, os_atrasadas, recentes, markup_medio, pecas_atrasadas, os_vencendo });
});

router.post('/importar-csv', upload.single('arquivo'), (req, res) => {
  if (!req.file) return res.status(400).json({ erro: 'Arquivo não enviado' });
  try {
    const db = getDB();
    const registros = parse(fs.readFileSync(req.file.path, 'utf8'), { columns: true, skip_empty_lines: true, trim: true, bom: true });
    const normData = s => { if (!s) return null; const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m ? `${m[3]}-${m[2]}-${m[1]}` : s.substring(0,10); };
    const statusMap = {'Concluída':'Concluída','Peças separadas':'Peças separadas','Aguardando peças':'Aguardando peças','Aberta':'Aberta'};
    const transporteValidos = ['RODONAVES','SEDEX','RETIRADA','ENTREGA NA EMPRESA','-'];
    let importados = 0, ignorados = 0, erros = [];
    for (const r of registros) {
      const numero = r['Número da O.S.'] || r['numero_os'] || '';
      const cliente = r['Cliente'] || r['cliente'] || '';
      if (!numero || !cliente) { ignorados++; continue; }
      try {
        const result = db.prepare(`INSERT OR IGNORE INTO ordens_servico (numero_os,cliente,equipamento,data_abertura,data_conclusao_estimada,status,prioridade,transporte,observacoes) VALUES (?,?,?,?,?,?,?,?,?)`)
          .run(numero, cliente, r['Equipamento']||'-', normData(r['Data de abertura'])||new Date().toISOString().split('T')[0], normData(r['Data estimada de conclusão']), statusMap[r['Status']]||'Aberta', r['Prioridade']==='Alta'?'Alta':'Média', transporteValidos.includes(r['TRANSPORTE'])?r['TRANSPORTE']:null, r['Observações']||null);
        result.changes > 0 ? importados++ : ignorados++;
      } catch(e) { erros.push(`${numero}: ${e.message}`); }
    }
    fs.unlinkSync(req.file.path);
    res.json({ mensagem: `Importação concluída: ${importados} importados, ${ignorados} ignorados`, importados, ignorados, erros: erros.slice(0,10) });
  } catch(e) { res.status(500).json({ erro: 'Erro ao processar CSV: ' + e.message }); }
});

module.exports = router;