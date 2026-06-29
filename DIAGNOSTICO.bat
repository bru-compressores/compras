@echo off
title Diagnostico PDF
chcp 65001 > nul
echo.
echo  Gerando diagnostico do PDF...
echo  Por favor aguarde...
echo.

:: Cria script Node temporario
echo const pdfParse = require('pdf-parse'); > "%TEMP%\diag_pdf.js"
echo const fs = require('fs'); >> "%TEMP%\diag_pdf.js"
echo const path = require('path'); >> "%TEMP%\diag_pdf.js"
echo. >> "%TEMP%\diag_pdf.js"
echo const args = process.argv.slice(2); >> "%TEMP%\diag_pdf.js"
echo if (!args[0]) { console.log('Uso: node diag_pdf.js "caminho\\arquivo.pdf"'); process.exit(1); } >> "%TEMP%\diag_pdf.js"
echo. >> "%TEMP%\diag_pdf.js"
echo const buf = fs.readFileSync(args[0]); >> "%TEMP%\diag_pdf.js"
echo pdfParse(buf).then(data ^=^> { >> "%TEMP%\diag_pdf.js"
echo   const linhas = data.text.split('\n'); >> "%TEMP%\diag_pdf.js"
echo   let out = '=== TEXTO EXTRAIDO DO PDF ===\n\n'; >> "%TEMP%\diag_pdf.js"
echo   linhas.forEach((l, i) ^=^> { if (l.trim()) out += i + ': |' + l.trim() + '|\n'; }); >> "%TEMP%\diag_pdf.js"
echo   fs.writeFileSync('diagnostico_pdf.txt', out, 'utf8'); >> "%TEMP%\diag_pdf.js"
echo   console.log('Arquivo diagnostico_pdf.txt gerado com sucesso!'); >> "%TEMP%\diag_pdf.js"
echo }).catch(e ^=^> console.error('Erro:', e.message)); >> "%TEMP%\diag_pdf.js"

:: Pede o caminho do PDF
echo  Arraste o arquivo PDF aqui e pressione Enter:
echo  (ou cole o caminho completo do arquivo)
echo.
set /p PDF_PATH="  PDF: "

:: Remove aspas se houver
set PDF_PATH=%PDF_PATH:"=%

if not exist "%PDF_PATH%" (
    echo.
    echo  ERRO: Arquivo nao encontrado: %PDF_PATH%
    pause
    exit /b 1
)

echo.
echo  Processando: %PDF_PATH%
node "%TEMP%\diag_pdf.js" "%PDF_PATH%"

if exist "diagnostico_pdf.txt" (
    echo.
    echo  ============================================
    echo   Arquivo gerado: diagnostico_pdf.txt
    echo   Esta na pasta: %CD%
    echo  ============================================
    echo.
    echo  Envie o arquivo diagnostico_pdf.txt para analise.
) else (
    echo  ERRO ao gerar diagnostico.
)

pause
