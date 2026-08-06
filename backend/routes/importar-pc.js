/**
 * Importador de Pedido de Compra (PC) via PDF — BRU Compressores
 * Extrai dados do PC e vincula às peças da O.S. via código + requisição
 */
const express  = require('express');
const multer   = require('multer');
const fs       = require('fs');
const { getDB }      = require('../db/database');
const { autenticar } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar);
const upload = multer({ dest: require('os').tmpdir(), limits: { fileSize: 20 * 1024 * 1024 } });

let PDFParse = null;
function getPDFParse() {
  if (!PDFParse) PDFParse = require('pdf-parse');
  return PDFParse;
}

function toNum(s) {
  return parseFloat(String(s||'0').replace(/\./g,'').replace(',','.')) || 0;
}

function extrairPC(text) {
  const linhas = text.split('\n').map(l => l.trim()).filter(Boolean);
  const r = {
    numero_pc: null,
    data_emissao: null,
    requisicao_almox: null,
    fornecedor_nome: null,
    fornecedor_codigo: null,
    prev_entrega_geral: null,
    itens: []
  };

  // Número do PC — linha após "Pedido de Compra"
  for (let i = 0; i < linhas.length; i++) {
    if (linhas[i] === 'Pedido de Compra' && /^\d+$/.test(linhas[i+1])) {
      r.numero_pc = linhas[i+1];
      break;
    }
  }

  // Data emissão — linha após "Emissão" (formato DD/MM/YYYY)
  for (let i = 0; i < linhas.length; i++) {
    if (linhas[i] === 'Emissão') {
      const m = linhas[i+1]?.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (m) { r.data_emissao = `${m[3]}-${m[2]}-${m[1]}`; break; }
    }
  }

  // Requisição do almoxarifado
  for (const ln of linhas) {
    const m = ln.match(/Requisi[çc][aã]o de Almoxarifado[:\s]+(\d+)/i);
    if (m) { r.requisicao_almox = m[1]; break; }
  }

  // Fornecedor — linha com padrão "NUM - NOME FORNECEDOR"
  for (const ln of linhas) {
    const m = ln.match(/^(\d+)\s*-\s*(.+LTDA|.+SA\b|.+ME\b|.+EIRELI|.+S\.A\.)/i);
    if (m && ln !== r.numero_pc) { r.fornecedor_codigo = m[1]; r.fornecedor_nome = m[2].trim(); break; }
  }
  // Fallback: linha após "Fornecedor"
  if (!r.fornecedor_nome) {
    for (let i = 0; i < linhas.length; i++) {
      if (linhas[i] === 'Fornecedor' && linhas[i+1] && /\d+\s*-/.test(linhas[i+1])) {
        const m = linhas[i+1].match(/^\d+\s*-\s*(.+)/);
        if (m) { r.fornecedor_nome = m[1].trim(); break; }
      }
    }
  }

  // Previsão de entrega geral (linha após "Prev. Entrega:")
  for (let i = 0; i < linhas.length; i++) {
    if (linhas[i] === 'Prev. Entrega:') {
      const m = linhas[i+1]?.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (m) { r.prev_entrega_geral = `${m[3]}-${m[2]}-${m[1]}`; break; }
    }
  }
  // Fallback: busca data solta no contexto de entrega
  if (!r.prev_entrega_geral) {
    for (const ln of linhas) {
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(ln) && ln !== linhas.find(l => l === linhas[0])) {
        const m = ln.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        if (m && m[3] >= '2026') { r.prev_entrega_geral = `${m[3]}-${m[2]}-${m[1]}`; }
      }
    }
  }

  // Itens — padrão observado:
  // linha N:   "DESCRICAO DA PECA"
  // linha N+1: "QTD,00UNIDVLR_UNIT000VLR_TOTAL"
  // linha N+2: "REFERENCIAXXXXXCODIGO"  (ref + cod grudados)
  const RE_ITEM_VAL = /^(\d+,\d{2})(UN|LT|L|KG|PC|CX|MT|GL)(\d+(?:\.\d{3})*,\d{2})0{2,3}(\d+(?:\.\d{3})*,\d{2})$/i;
  // Pega os últimos 4 dígitos como código (padrão Primam) e o resto como referência
  const RE_REF_COD  = /^(.*?)(\d{4})$/;

  for (let i = 0; i < linhas.length; i++) {
    const mVal = linhas[i]?.match(RE_ITEM_VAL);
    if (mVal) {
      const descricao = linhas[i-1] || '';
      const refCod    = linhas[i+1] || '';
      const mRC       = refCod.match(RE_REF_COD);
      const qtd       = toNum(mVal[1]);
      const vlrUnit   = toNum(mVal[3]);

      // Previsão de entrega do item — busca data próxima
      let prevEntrega = r.prev_entrega_geral;
      for (let j = i-5; j < i+5; j++) {
        if (j < 0 || j >= linhas.length) continue;
        const mD = linhas[j].match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (mD) { prevEntrega = `${mD[3]}-${mD[2]}-${mD[1]}`; break; }
      }

      r.itens.push({
        descricao:    descricao.trim(),
        codigo:       mRC ? mRC[2] : null,
        referencia:   mRC ? mRC[1] : null,
        quantidade:   qtd,
        preco_fechado: vlrUnit,
        prev_entrega:  prevEntrega,
      });
    }
  }

  return r;
}

// POST /api/importar-pc
router.post('/', upload.array('arquivos', 50), async (req, res) => {
  if (!req.files || !req.files.length) return res.status(400).json({ erro: 'Nenhum arquivo enviado' });

  const pdfParse = getPDFParse();
  const db = getDB();
  const resultados = [];

  for (const file of req.files) {
    const nome = file.originalname;
    try {
      const buffer = fs.readFileSync(file.path);
      const parsed = await pdfParse(buffer);
      const pc     = extrairPC(parsed.text);

      if (!pc.numero_pc)       throw new Error('Número do PC não encontrado');
      if (!pc.requisicao_almox) throw new Error('Número da Requisição não encontrado');
      if (!pc.itens.length)     throw new Error('Nenhum item encontrado no PC');

      // Buscar O.S. pela requisição (observações ou número_os)
      const osLista = await Promise.resolve(db.prepare(
        `SELECT id, numero_os FROM ordens_servico WHERE observacoes LIKE ? OR numero_os = ?`
      ).all(`%${pc.requisicao_almox}%`, pc.requisicao_almox));

      console.log(`PC ${pc.numero_pc} | Req: ${pc.requisicao_almox} | OS encontradas: ${osLista.length} | Itens: ${pc.itens.length}`);
      pc.itens.forEach(i => console.log(`  Item: cod=${i.codigo} ref=${i.referencia} R$${i.preco_fechado}`));

      // Buscar fornecedor pelo nome
      let fornecedorId = null;
      if (pc.fornecedor_nome) {
        const forn = await Promise.resolve(db.prepare(
          `SELECT id FROM fornecedores WHERE nome ILIKE ?`
        ).get(`%${pc.fornecedor_nome.substring(0, 20)}%`));
        if (forn) fornecedorId = forn.id;
        console.log(`  Fornecedor: ${pc.fornecedor_nome} -> id=${fornecedorId}`);
      }

      let pecasAtualizadas = 0, pecasNaoEncontradas = 0;
      const dataPC = pc.data_emissao || new Date().toISOString().split('T')[0];

      for (const item of pc.itens) {
        if (!item.codigo) { pecasNaoEncontradas++; continue; }

        let peca = null;

        // 1. Tenta nas O.S. vinculadas à requisição
        for (const os of osLista) {
          peca = await Promise.resolve(db.prepare(
            `SELECT id FROM pecas_os WHERE os_id = ? AND codigo = ? LIMIT 1`
          ).get(os.id, item.codigo));
          if (peca) { console.log(`  ✅ Encontrou cod=${item.codigo} na OS ${os.numero_os}`); break; }
        }

        // 2. Fallback global — busca pelo código sem restrição de status
        if (!peca) {
          peca = await Promise.resolve(db.prepare(
            `SELECT p.id FROM pecas_os p
             JOIN ordens_servico o ON p.os_id = o.id
             WHERE p.codigo = ?
             ORDER BY p.criado_em DESC LIMIT 1`
          ).get(item.codigo));
          if (peca) console.log(`  ✅ Fallback global: cod=${item.codigo}`);
          else console.log(`  ❌ Não encontrou cod=${item.codigo}`)
        }

        if (!peca) { pecasNaoEncontradas++; continue; }

        // Atualiza a peça com os dados do PC
        await Promise.resolve(db.prepare(`
          UPDATE pecas_os SET
            preco_fechado = ?,
            data_entrega_prevista = ?,
            status_entrega = 'Pedido realizado',
            fornecedor_id = COALESCE(?, fornecedor_id),
            numero_pc = ?,
            referencia = COALESCE(?, referencia),
            atualizado_em = NOW()
          WHERE id = ?
        `).run(
          item.preco_fechado || null,
          item.prev_entrega  || null,
          fornecedorId,
          pc.numero_pc ? 'PC-' + pc.numero_pc : null,
          item.referencia || null,
          peca.id
        ));

        pecasAtualizadas++;
      }

      // Registra a data do pedido na O.S. (no histórico)
      for (const os of osLista) {
        await Promise.resolve(db.prepare(
          `INSERT INTO historico_status (os_id, status_anterior, status_novo, observacao, usuario_id) VALUES (?,?,?,?,?)`
        ).run(os.id, null, 'Pedido realizado',
          `PC ${pc.numero_pc} importado — ${pecasAtualizadas} peça(s) atualizada(s). Fornecedor: ${pc.fornecedor_nome||'—'}`,
          req.usuario.id
        ));
      }

      resultados.push({
        arquivo: nome, sucesso: true,
        numero_pc: pc.numero_pc,
        requisicao: pc.requisicao_almox,
        fornecedor: pc.fornecedor_nome,
        data_emissao: pc.data_emissao,
        pecas_atualizadas: pecasAtualizadas,
        pecas_nao_encontradas: pecasNaoEncontradas,
        os_vinculadas: osLista.map(o => o.numero_os)
      });

    } catch(e) {
      resultados.push({ arquivo: nome, sucesso: false, erro: e.message });
    } finally {
      try { fs.unlinkSync(file.path); } catch(_) {}
    }
  }

  res.json({ resultados });
});

module.exports = router;
