@echo off
title Atualizando importador PDF...
chcp 65001 > nul

echo Sobrescrevendo backend/routes/importar-pdf.js...

(
echo const express  = require^('express'^);
echo const multer   = require^('multer'^);
echo const fs       = require^('fs'^);
echo const pdfParse = require^('pdf-parse'^);
echo const { getDB }      = require^('../db/database'^);
echo const { autenticar } = require^('../middleware/auth'^);
echo const router = express.Router^(^);
echo router.use^(autenticar^);
echo const upload = multer^({ dest: require^('os'^).tmpdir^(^), limits: { fileSize: 20 * 1024 * 1024 } }^);
echo function extrairDadosPrimam^(texto^) {
echo   const linhas = texto.split^('\n'^).map^(l =^> l.trim^(^)^).filter^(Boolean^);
echo   const ANOS = new Set^(['2023','2024','2025','2026','2027','2028']^);
echo   let numero_os = null;
echo   for ^(let i=0;i^<linhas.length;i++^) {
echo     if ^(/^PR\d{10,}/.test^(linhas[i]^)^) {
echo       for ^(let j=i+1;j^<Math.min^(i+5,linhas.length^);j++^) {
echo         if ^(/^\d{4,5}$/.test^(linhas[j]^)^&^&!ANOS.has^(linhas[j]^)^){numero_os=linhas[j];break;}
echo       }
echo       if ^(numero_os^) break;
echo     }
echo   }
echo   if ^(!numero_os^) { for ^(const l of linhas^) { if ^(/^\d{4,5}$/.test^(l^)^&^&!ANOS.has^(l^)^){numero_os=l;break;} } }
echo   let cliente=null;
echo   for ^(const l of linhas^) {
echo     const m=l.match^(/^\d{3,6}\s*[-^–]\s*^([A-Z].+?^)^(?:\d{2}\.\d{3}\.\d{3}\/^|$^)/^);
echo     if ^(m^&^&!m[1].includes^('@'^)^&^&!m[1].includes^('www'^)^){cliente=m[1].trim^(^);break;}
echo   }
echo   const normData=s=^>{const m=s^&^&s.match^(/^(\d{2^})\/^(\d{2^})\/^(\d{4^})/^);return m?`${m[3]}-${m[2]}-${m[1]}`:null;};
echo   let data_abertura=null,data_conclusao_estimada=null;
echo   for ^(let i=0;i^<linhas.length;i++^) {
echo     if ^(linhas[i]==='OS AUTORIZADA'^|^|linhas[i]==='ENCOMENDADO'^) { for^(let j=i-1;j^>=Math.max^(0,i-4^);j--^){const d=normData^(linhas[j]^);if^(d^){data_abertura=d;break;}} }
echo     if ^(/NORMAL^|URGENTE/i.test^(linhas[i]^)^){const ds=[...linhas[i].matchAll^(/^(\d{2}\/\d{2}\/\d{4^}^)/g^)].map^(m=^>normData^(m[0]^)^);if^(ds.length^>=2^)data_conclusao_estimada=ds[1];else if^(ds.length===1^)data_conclusao_estimada=ds[0];}
echo   }
echo   if^(!data_abertura^){for^(const l of linhas^){const d=normData^(l^);if^(d^){data_abertura=d;break;}}}
echo   if^(!data_abertura^)data_abertura=new Date^(^).toISOString^(^).split^('T'^)[0];
echo   const prioridade=linhas.some^(l=^>/URGENTE/.test^(l^)^|^|/\bALTA\b/.test^(l^)^)?'Alta':'Media';
echo   let equipamento=null,numero_serie=null,marca=null;
echo   for^(const l of linhas^){
echo     if^(!equipamento^){const m=l.match^(/Modelo[:\s]+^([^\s\/,;]+^)/i^);if^(m^)equipamento=m[1].trim^(^);}
echo     if^(!numero_serie^){const m=l.match^(/Nr\.\s*S[ee]rie[:\s]+^([^\s\/,;]+^)/i^);if^(m^)numero_serie=m[1].trim^(^);}
echo     if^(!marca^){const m=l.match^(/Marca[:\s]+^([A-Z][^\n\/,]+^)/i^);if^(m^)marca=m[1].trim^(^);}
echo   }
echo   const pecas=[];
echo   const idxProd=linhas.findIndex^(l=^>l==='PRODUTO^(S^)'^);
echo   const idxServ=linhas.findIndex^(l=^>l==='SERVICO^(S^)'^);
echo   const idxFim=idxServ^>idxProd?idxServ:linhas.findIndex^(^(l,i^)=^>i^>idxProd^&^&/^Subtotal Produto/.test^(l^)^);
echo   if^(idxProd===-1^)return{numero_os,cliente,data_abertura,data_conclusao_estimada,prioridade,equipamento,numero_serie,marca,pecas};
echo   const bloco=linhas.slice^(idxProd+1,idxFim^>idxProd?idxFim:undefined^);
echo   const numRe='\\d+^(?:\\.\\d{3^}^)*,\\d{2}';
echo   const RE_VAL=new RegExp^(`^^(UN^|LT^|KG^|PC^|CX^|MT^|GL^|M2^|M3^)^(${numRe}^)^(${numRe}^)^(${numRe}^)\\d*$`,'i'^);
echo   const RE_TUDO=new RegExp^(`^^(\\d{3,6^}^)^(.+?^)^(UN^|LT^|KG^|PC^|CX^|MT^|GL^)^(${numRe}^)^(${numRe}^)^(${numRe}^)\\d*$`,'i'^);
echo   const toFloat=s=^>parseFloat^(^(s^|^|'0'^).replace^(/\./g,''^).replace^(/,/,'.'^^)^);
echo   const SKIP=/^^(Codigo^|Item^|Unid^|Valor^|Subtotal^|Desconto^|Total^|IPI^|Frete^|Condicoes^|Referente^|Patrimonio^|Marca^|Defeito^|Observ^|Agend^|impresso^|ERP^|Parcela^|Vencimento^|Forma^|Dias^)/i;
echo   let i=0;
echo   while^(i^<bloco.length^){
echo     const l=bloco[i];
echo     if^(SKIP.test^(l^)^|^|/^\d{2}\/\d{2}\/\d{4}/.test^(l^)^|^|/^\d+,\d{2}$/.test^(l^)^){i++;continue;}
echo     const mTudo=l.match^(RE_TUDO^);
echo     if^(mTudo^){pecas.push^({codigo:mTudo[1],descricao:mTudo[2].trim^(^),quantidade:toFloat^(mTudo[4]^),preco_unitario:toFloat^(mTudo[5]^)}^);i++;continue;}
echo     if^(/^\d{3,6}$/.test^(l^)^&^&!ANOS.has^(l^)^){
echo       const codigo=l,descricao=bloco[i+1]^|^|'';
echo       let mVal=null,skip=2;
echo       for^(let k=i+2;k^<=Math.min^(i+5,bloco.length-1^);k++^){
echo         const t=bloco[k].match^(RE_VAL^);
echo         if^(t^){mVal=t;skip=k-i+1;break;}
echo         if^(/^\d{3,6}$/.test^(bloco[k]^)^&^&!ANOS.has^(bloco[k]^)^)break;
echo       }
echo       if^(mVal^){pecas.push^({codigo,descricao:descricao.trim^(^),quantidade:toFloat^(mVal[2]^),preco_unitario:toFloat^(mVal[3]^)}^);i+=skip;continue;}
echo       else if^(descricao^&^&!/^^(UN^|LT^|Item^|Codigo^)/i.test^(descricao^)^){pecas.push^({codigo,descricao:descricao.trim^(^),quantidade:1,preco_unitario:null}^);i+=2;continue;}
echo     }
echo     i++;
echo   }
echo   return{numero_os,cliente,data_abertura,data_conclusao_estimada,prioridade,equipamento,numero_serie,marca,pecas};
echo }
) > "%TEMP%\teste_extrator.js"

echo Feito. Testando extrator...
pause
