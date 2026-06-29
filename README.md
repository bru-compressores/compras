# Sistema de Controle de Compras — Peças e O.S.

## Instalação e execução

### Pré-requisitos
- Node.js 18+ (https://nodejs.org)

### Passos

```bash
# 1. Instalar dependências
npm install

# 2. Iniciar o servidor
npm start
```

O sistema abrirá em: **http://localhost:3000**

### Login padrão
- E-mail: `admin@empresa.com`
- Senha: `admin123`

> ⚠️ Troque a senha após o primeiro acesso em: **Usuários → Editar**

---

## Estrutura do projeto

```
compras/
├── backend/
│   ├── server.js           ← Servidor Express
│   ├── db/database.js      ← Banco SQLite + criação das tabelas
│   ├── middleware/auth.js  ← JWT
│   └── routes/
│       ├── usuarios.js     ← Login + CRUD usuários
│       ├── ordens.js       ← CRUD Ordens de Serviço
│       ├── pecas.js        ← CRUD Peças por O.S.
│       ├── fornecedores.js ← CRUD Fornecedores
│       └── dashboard.js    ← KPIs + importação CSV
├── frontend/
│   ├── index.html          ← SPA principal
│   └── assets/
│       ├── css/style.css
│       └── js/
│           ├── api.js      ← Chamadas HTTP
│           ├── app.js      ← Navegação + login
│           └── pages/      ← Uma página por módulo
├── data/
│   └── compras.db          ← Banco de dados SQLite (gerado na 1ª execução)
└── package.json
```

## Importar dados do Notion

1. No Notion: `⋯` → Export → Markdown e CSV
2. Extraia o ZIP
3. No sistema: **Importar CSV** → selecione o arquivo `.csv`
4. Os dados são importados sem duplicar registros existentes

## Variáveis de ambiente (opcional)

```env
PORT=3000
JWT_SECRET=sua_chave_secreta_aqui
```
