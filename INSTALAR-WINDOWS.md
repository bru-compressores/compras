# Como instalar e rodar — Windows

## Passo 1 — Instalar o Node.js

1. Acesse: https://nodejs.org
2. Clique no botão **"LTS"** (versão recomendada)
3. Baixe e execute o instalador `.msi`
4. Clique em "Next" em todas as telas e "Install"
5. Aguarde finalizar e clique em "Finish"

---

## Passo 2 — Extrair o projeto

1. Clique com o botão direito no arquivo `controle-compras.zip`
2. Selecione **"Extrair tudo..."**
3. Escolha uma pasta fácil de achar, por exemplo: `C:\Sistemas\controle-compras`

---

## Passo 3 — Abrir o terminal na pasta do projeto

**Opção A (mais fácil):**
1. Abra a pasta `compras` no Windows Explorer
2. Clique na barra de endereço no topo
3. Digite `cmd` e pressione **Enter**
4. O terminal já abre na pasta certa ✅

**Opção B:**
1. Pressione `Win + R`, digite `cmd`, Enter
2. Digite: `cd C:\Sistemas\controle-compras\compras`

---

## Passo 4 — Instalar as dependências (só uma vez)

No terminal, digite:

```
npm install
```

Aguarde baixar os pacotes (pode demorar 1-2 minutos na primeira vez).

---

## Passo 5 — Iniciar o sistema

```
npm start
```

Você verá:

```
✅ Servidor rodando em http://localhost:3000
   Login padrão: admin@empresa.com / admin123
```

---

## Passo 6 — Abrir no navegador

Acesse: **http://localhost:3000**

Use o login padrão:
- E-mail: `admin@empresa.com`
- Senha: `admin123`

> ⚠️ Troque a senha após o primeiro acesso em **Usuários → Editar**

---

## Para parar o servidor

No terminal, pressione `Ctrl + C`

## Para iniciar novamente

Basta abrir o terminal na pasta e rodar:
```
npm start
```
(não precisa rodar `npm install` de novo)

---

## Dúvidas frequentes

**"npm não é reconhecido"**
→ O Node.js não foi instalado corretamente. Reinstale e marque a opção "Add to PATH".

**A página não abre**
→ Verifique se o terminal mostra "Servidor rodando". Se não, rode `npm start` novamente.

**Porta 3000 já em uso**
→ Crie um arquivo `.env` na pasta `compras` com o conteúdo: `PORT=3001`
→ Acesse então http://localhost:3001
