# Gestão de Clínica Pediátrica — Clínica Pediátrica Pequenos Passos

Projeto prático Full Stack com EJS (SENAI — Técnico em Desenvolvimento de Sistemas).

| Arquivo | Conteúdo |
|---|---|
| [`documentacao.docx`](./documentacao.docx) / [`documentacao.pdf`](./documentacao.pdf) | Requisitos funcionais, arquitetura, tecnologias e ambiente (Anexo 1) |
| [`der.png`](./der.png) / [`der.pdf`](./der.pdf) | DER com PK, FK e cardinalidades |
| [`clinica_pediatrica.sql`](./clinica_pediatrica.sql) | Criação das tabelas e registros de teste |
| [`sistema/`](./sistema) | Código-fonte (Node.js + Express + EJS + PostgreSQL) |

Instruções completas de execução: [`sistema/README.md`](./sistema/README.md).

Resumo (PowerShell, PostgreSQL na porta 7777 do laboratório):

```powershell
psql -U postgres -h localhost -p 7777 -c "CREATE DATABASE clinica_pediatrica;"
psql -U postgres -h localhost -p 7777 -d clinica_pediatrica -f clinica_pediatrica.sql
cd sistema
Copy-Item .env.example .env
notepad .env
npm install
npm start
```

Acesse `http://localhost:3000` e entre com um dos usuários de teste do `sistema/README.md`.
