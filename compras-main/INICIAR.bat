@echo off
title BRU Compressores
chcp 65001 > nul

echo.
echo  BRU Compressores - Controle de Compras
echo  ========================================
echo.

node --version > nul 2>&1
if %errorlevel% neq 0 (
    echo  ERRO: Node.js nao encontrado!
    echo  Instale em: https://nodejs.org
    echo.
    pause
    exit /b 1
)

echo  Node.js OK
echo.

if not exist "node_modules\sql.js\package.json" (
    echo  Instalando dependencias...
    npm install
    echo.
)

echo  Iniciando servidor...
echo  Acesse: http://localhost:3000
echo  Login: admin@empresa.com / admin123
echo  Ctrl+C para encerrar
echo.

node backend\server.js

echo.
pause
