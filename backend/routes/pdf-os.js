const express = require('express');
const { getDB }      = require('../db/database');
const { autenticar } = require('../middleware/auth');
const router = express.Router();
router.use(autenticar);

router.get('/:id', async (req, res) => {
  try {
  const db = getDB();
  const os = await Promise.resolve(db.prepare('SELECT * FROM ordens_servico WHERE id = ?').get(req.params.id));
  if (!os) return res.status(404).json({ erro: 'O.S. não encontrada' });

  const pecas = await Promise.resolve(db.prepare(`
    SELECT p.*, f.nome as fornecedor_nome
    FROM pecas_os p LEFT JOIN fornecedores f ON p.fornecedor_id = f.id
    WHERE p.os_id = ? ORDER BY p.criado_em
  `).all(req.params.id));

  const fmt = d => {
    if (!d) return '—';
    const [y,m,day] = (d.split('T')[0]).split('-');
    return day + '/' + m + '/' + y;
  };
  const moeda = v => v != null && v > 0 ? 'R$ ' + parseFloat(v).toLocaleString('pt-BR', {minimumFractionDigits:2,maximumFractionDigits:2}) : '—';
  const markup = (v, f) => v && f && f > 0 ? (v/f).toFixed(2) + 'x' : '—';

  const totalVenda  = pecas.reduce((s,p) => s+(p.preco_unitario||0)*p.quantidade, 0);
  const totalFech   = pecas.reduce((s,p) => s+(p.preco_fechado||0)*p.quantidade, 0);
  const economia    = totalVenda - totalFech;
  const mkGeral     = totalFech > 0 ? (totalVenda/totalFech).toFixed(2)+'x' : '—';

  const statusCor = {
    'Pendente':         '#64748b',
    'Pedido realizado': '#1a56db',
    'Em trânsito':      '#d97706',
    'Entregue':         '#059669',
    'Cancelado':        '#dc2626',
  };

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>O.S. ${os.numero_os} — BRU Compressores</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #1a1a1a; background: #fff; }
  .header { background: linear-gradient(135deg, #1a2f6b, #0f1f52); color: #fff; padding: 18px 24px; display: flex; justify-content: space-between; align-items: center; }
  .logo { font-size: 18px; font-weight: 700; }
  .logo span { display: block; font-size: 11px; font-weight: 400; opacity: .75; margin-top: 2px; }
  .os-num { font-size: 28px; font-weight: 700; opacity: .9; }
  .accent { height: 4px; background: linear-gradient(90deg, #f97316, #1a56db); }
  .section { padding: 16px 24px; border-bottom: 1px solid #e5e7eb; }
  .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .6px; color: #6b7280; margin-bottom: 10px; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
  .field label { font-size: 9px; text-transform: uppercase; letter-spacing: .4px; color: #9ca3af; display: block; margin-bottom: 2px; }
  .field value { font-size: 12px; font-weight: 600; color: #111827; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 600; }
  .badge-os { background: #dbeafe; color: #1d4ed8; }
  .badge-pedido { background: #ede9fe; color: #6d28d9; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; padding: 14px 24px; background: #f9fafb; border-bottom: 1px solid #e5e7eb; }
  .kpi { text-align: center; padding: 10px; background: #fff; border-radius: 8px; border: 1px solid #e5e7eb; }
  .kpi .label { font-size: 9px; color: #9ca3af; text-transform: uppercase; letter-spacing: .4px; margin-bottom: 4px; }
  .kpi .value { font-size: 14px; font-weight: 700; color: #111827; }
  .kpi .sub { font-size: 9px; color: #9ca3af; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f3f4f6; padding: 7px 10px; text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: .4px; color: #6b7280; border-bottom: 2px solid #e5e7eb; white-space: nowrap; }
  td { padding: 8px 10px; border-bottom: 1px solid #f3f4f6; font-size: 11px; vertical-align: middle; }
  tr:hover td { background: #fafafa; }
  .status-dot { display: inline-flex; align-items: center; gap: 5px; }
  .status-dot::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: currentColor; flex-shrink: 0; }
  .footer { padding: 12px 24px; font-size: 9px; color: #9ca3af; display: flex; justify-content: space-between; border-top: 2px solid #e5e7eb; margin-top: 8px; }
  .economia { color: #059669; font-weight: 700; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    @page { margin: 8mm; size: A4 landscape; }
  }
</style>
</head>
<body>

<div class="header">
  <div>
    <div class="logo">BRU Compressores<span>Controle de Compras — Peças &amp; O.S.</span></div>
  </div>
  <div style="text-align:right">
    <div class="os-num">${os.numero_os}</div>
    <div style="font-size:11px;opacity:.75;margin-top:2px">
      <span class="badge ${os.tipo==='Pedido'?'badge-pedido':'badge-os'}" style="background:rgba(255,255,255,.2);color:#fff">${os.tipo||'OS'}</span>
    </div>
  </div>
</div>
<div class="accent"></div>

<div class="section">
  <div class="section-title">Dados da Ordem de Serviço</div>
  <div class="grid-4">
    <div class="field"><label>Cliente</label><value>${os.cliente}</value></div>
    <div class="field"><label>Equipamento</label><value>${os.equipamento}</value></div>
    <div class="field"><label>Abertura</label><value>${fmt(os.data_abertura)}</value></div>
    <div class="field"><label>Previsão de Conclusão</label><value>${fmt(os.data_conclusao_estimada)}</value></div>
    <div class="field"><label>Status</label><value>${os.status}</value></div>
    <div class="field"><label>Prioridade</label><value>${os.prioridade}</value></div>
    ${os.transporte ? `<div class="field"><label>Transporte</label><value>${os.transporte}</value></div>` : ''}
    ${os.observacoes ? `<div class="field" style="grid-column:span 2"><label>Observações</label><value>${os.observacoes}</value></div>` : ''}
  </div>
</div>

<div class="kpi-grid">
  <div class="kpi"><div class="label">Total de peças</div><div class="value">${pecas.length}</div><div class="sub">${pecas.filter(p=>p.status_entrega==='Entregue').length} entregues</div></div>
  <div class="kpi"><div class="label">Preço de Venda (ERP)</div><div class="value">${moeda(totalVenda)}</div><div class="sub">valor tabela</div></div>
  <div class="kpi"><div class="label">Valor Fechado</div><div class="value">${moeda(totalFech)}</div><div class="sub">negociado</div></div>
  <div class="kpi" style="border-color:#059669"><div class="label">Economia</div><div class="value economia">${moeda(economia)}</div><div class="sub">markup ${mkGeral}</div></div>
</div>

<div class="section">
  <div class="section-title">Peças (${pecas.length})</div>
  <table>
    <thead><tr>
      <th>Código</th><th>Descrição</th><th>Qtd</th>
      <th>Preço Venda</th><th>Valor Fechado</th><th>Markup</th>
      <th>Fornecedor</th><th>Transportadora</th><th>Status</th>
      <th>Prev. Entrega</th><th>Rastreio</th>
    </tr></thead>
    <tbody>
      ${pecas.map(p => `<tr>
        <td><code style="background:#f3f4f6;padding:1px 5px;border-radius:3px;font-size:10px">${p.codigo||'—'}</code></td>
        <td style="max-width:180px">${p.descricao}</td>
        <td style="text-align:center">${p.quantidade}</td>
        <td>${moeda(p.preco_unitario)}</td>
        <td style="font-weight:600">${moeda(p.preco_fechado)}</td>
        <td style="color:${p.preco_fechado>0?'#059669':'#9ca3af'}">${markup(p.preco_unitario,p.preco_fechado)}</td>
        <td style="font-size:10px">${p.fornecedor_nome||'—'}</td>
        <td style="font-size:10px">${p.transporte||'—'}</td>
        <td><span class="status-dot" style="color:${statusCor[p.status_entrega]||'#9ca3af'};font-size:10px">${p.status_entrega}</span></td>
        <td style="white-space:nowrap">${fmt(p.data_entrega_prevista)}</td>
        <td><code style="font-size:9px">${p.numero_rastreio||'—'}</code></td>
      </tr>`).join('')}
    </tbody>
  </table>
</div>

<div class="footer">
  <span>BRU Compressores — Controle de Compras</span>
  <span>Impresso em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</span>
  <span>O.S. ${os.numero_os} — ${os.cliente}</span>
</div>

<script>window.onload = () => { window.print(); }</script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
  } catch(e) { res.status(500).send('Erro: ' + e.message); }
});

module.exports = router;
