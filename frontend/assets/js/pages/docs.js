const PageDocs = {
  render() {
    document.getElementById('topbar-actions').innerHTML = '';
    document.getElementById('content').innerHTML = this.renderHTML();
  },

  renderHTML() {
    const grupos = [
      {
        cor: '#16a34a',
        corBg: '#f0fdf4',
        corBorda: '#22c55e',
        emoji: '🟢',
        titulo: 'Comece aqui — uso do dia a dia',
        subtitulo: 'Para quem vai usar e cuidar do sistema. Leia nesta ordem.',
        docs: [
          {
            n: 1,
            icone: '📘',
            corNum: '#16a34a',
            nome: 'Guia de Continuidade',
            desc: 'Explica o que é o sistema, como pedir melhorias ao Claude sem saber programar, como aplicar atualizações e o que fazer quando algo quebrar.',
            tag: 'Leia primeiro',
            tagCor: '#16a34a',
            tagBg: '#dcfce7',
            arquivo: '/assets/docs/guia-continuidade.pdf',
          },
          {
            n: 2,
            icone: '🗺️',
            corNum: '#0369a1',
            nome: 'Manual de Procedimentos Visual',
            desc: 'Guia visual passo a passo das três plataformas do sistema: GitHub (subir atualizações), Supabase (banco de dados) e Render (hospedagem).',
            tag: 'Passo a passo',
            tagCor: '#0369a1',
            tagBg: '#dbeafe',
            arquivo: '/assets/docs/manual-procedimentos-visual.pdf',
          },
        ],
      },
      {
        cor: '#1a56db',
        corBg: '#eff6ff',
        corBorda: '#3b82f6',
        emoji: '🔵',
        titulo: 'Para administrar',
        subtitulo: 'Quando for trocar o responsável pelo sistema.',
        docs: [
          {
            n: 3,
            icone: '✅',
            corNum: '#1a56db',
            nome: 'Checklist de Transferência de Acesso',
            desc: 'Lista prática com todos os passos para transferir o sistema a uma nova pessoa: GitHub, Render, Supabase e credenciais internas.',
            tag: 'Ao trocar de responsável',
            tagCor: '#1a56db',
            tagBg: '#dbeafe',
            arquivo: '/assets/docs/checklist-transferencia.pdf',
          },
        ],
      },
      {
        cor: '#c2410c',
        corBg: '#fff7ed',
        corBorda: '#f97316',
        emoji: '🟠',
        titulo: 'Para quem vai programar / evoluir',
        subtitulo: 'Referência para dar manutenção ou continuar o desenvolvimento.',
        docs: [
          {
            n: 4,
            icone: '📦',
            corNum: '#c2410c',
            nome: 'Pacote Mestre de Continuidade',
            desc: 'Documento completo de transferência: contexto, regras de negócio, decisões críticas, bugs conhecidos, estado atual e próximos passos. Cole em uma nova conversa com o Claude para retomar o desenvolvimento.',
            tag: 'Documento principal',
            tagCor: '#c2410c',
            tagBg: '#ffedd5',
            arquivo: '/assets/docs/pacote-mestre-continuidade.pdf',
          },
          {
            n: 5,
            icone: '📗',
            corNum: '#1e3a5f',
            nome: 'Documentação Técnica Completa',
            desc: 'Referência aprofundada: arquitetura, todas as tabelas do banco, rotas da API, padrões de código, variáveis de ambiente e lições aprendidas com bugs reais.',
            tag: 'Referência aprofundada',
            tagCor: '#1e3a5f',
            tagBg: '#e0f2fe',
            arquivo: '/assets/docs/documentacao-tecnica.pdf',
          },
        ],
      },
    ];

    const renderDoc = (d) => `
      <div style="
        background:var(--surface);
        border:1px solid var(--border);
        border-left:4px solid ${d.corNum};
        border-radius:var(--radius-lg);
        padding:18px 20px;
        display:flex;
        align-items:flex-start;
        gap:16px;
        transition:box-shadow .15s, transform .15s;
        cursor:default;
      " onmouseover="this.style.boxShadow='0 4px 16px rgba(0,0,0,.10)';this.style.transform='translateY(-1px)'"
         onmouseout="this.style.boxShadow='none';this.style.transform='none'">
        <div style="
          width:32px;height:32px;border-radius:50%;
          background:${d.corNum};color:#fff;
          display:flex;align-items:center;justify-content:center;
          font-weight:700;font-size:14px;flex-shrink:0;margin-top:2px
        ">${d.n}</div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:4px">
            <span style="font-size:18px">${d.icone}</span>
            <span style="font-weight:700;font-size:13px;color:var(--text)">${d.nome}</span>
            <span style="
              font-size:10px;font-weight:600;padding:2px 8px;border-radius:20px;
              background:${d.tagBg};color:${d.tagCor};white-space:nowrap
            ">${d.tag}</span>
          </div>
          <p style="font-size:12px;color:var(--text-3);margin:0 0 10px;line-height:1.5">${d.desc}</p>
          <a href="${d.arquivo}" target="_blank" style="
            display:inline-flex;align-items:center;gap:6px;
            font-size:12px;font-weight:600;color:var(--brand2);
            text-decoration:none;padding:5px 12px;
            border:1px solid var(--brand2);border-radius:var(--radius);
            transition:background .15s
          " onmouseover="this.style.background='var(--brand2)';this.style.color='#fff'"
             onmouseout="this.style.background='transparent';this.style.color='var(--brand2)'">
            📄 Abrir PDF →
          </a>
        </div>
      </div>`;

    const renderGrupo = (g) => `
      <div style="margin-bottom:32px">
        <div style="
          display:flex;align-items:center;gap:10px;
          padding:12px 16px;
          background:${g.corBg};
          border-left:4px solid ${g.corBorda};
          border-radius:var(--radius);
          margin-bottom:14px
        ">
          <span style="font-size:18px">${g.emoji}</span>
          <div>
            <div style="font-weight:700;font-size:14px;color:${g.cor}">${g.titulo}</div>
            <div style="font-size:11px;color:var(--text-3);margin-top:1px">${g.subtitulo}</div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px">
          ${g.docs.map(renderDoc).join('')}
        </div>
      </div>`;

    return `
      <div style="max-width:800px;margin:0 auto;padding:8px 0 40px">
        <div class="card mb-14" style="border-left:4px solid var(--brand2)">
          <div style="padding:16px 20px">
            <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:4px">
              📚 Central de Documentação — Sistema de Controle de Compras
            </div>
            <div style="font-size:12px;color:var(--text-3);line-height:1.5;margin-bottom:8px">
              Documentos de continuidade e manuais do sistema. Clique em <b>"📄 Abrir PDF →"</b> para abrir em nova aba.
            </div>
            <div style="
              font-size:11px;color:var(--text-4);
              background:var(--surface-2);padding:8px 12px;border-radius:var(--radius);
              border-left:3px solid var(--border)
            ">
              💡 Estes documentos foram criados para administradores e desenvolvedores do sistema.
              Recomenda-se guardar uma cópia em local seguro da empresa (pasta compartilhada, Google Drive, etc.).
            </div>
          </div>
        </div>
        ${grupos.map(renderGrupo).join('')}
      </div>`;
  },
};
