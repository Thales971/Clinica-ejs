# Clínica Pediátrica Pequenos Passos — Sistema Web (Node.js + EJS)

Aplicação Server-Side Rendering (SSR) criada com Node.js, Express, EJS e PostgreSQL para a gestão da Clínica Pediátrica Pequenos Passos. O sistema possui login de operador por CPF e senha (hash bcrypt), sessão com expiração e logout, CRUD de responsáveis com busca por nome, CRUD de crianças vinculadas a um responsável e CRUD de atendimentos com listagem via JOIN em ordem cronológica.

## Estrutura

```text
clinica-pediatrica/
├── documentacao.docx / documentacao.pdf   (requisitos e infraestrutura — Anexo 1)
├── der.png / der.pdf                      (diagrama entidade-relacionamento)
├── clinica_pediatrica.sql                 (criação e povoamento do banco)
└── sistema/
    ├── app.js
    ├── db.js
    ├── gerar-hash.js
    ├── package.json
    ├── .env.example
    ├── .gitignore
    ├── README.md
    ├── middleware/
    │   └── auth.js
    └── views/
        ├── login.ejs
        ├── inicio.ejs
        ├── erro.ejs
        ├── responsaveis.ejs
        ├── novo-responsavel.ejs
        ├── editar-responsavel.ejs
        ├── criancas.ejs
        ├── nova-crianca.ejs
        ├── editar-crianca.ejs
        ├── atendimentos.ejs
        ├── novo-atendimento.ejs
        ├── editar-atendimento.ejs
        └── partials/
            ├── topo.ejs
            ├── rodape.ejs
            ├── erros.ejs
            ├── campos-responsavel.ejs
            ├── campos-crianca.ejs
            └── campos-atendimento.ejs
```

## Requisitos

- Node.js 18 LTS ou superior (com npm)
- PostgreSQL 16 ou superior em execução (a extensão `pgcrypto` já vem no instalador oficial)
- pgAdmin 4 ou `psql` (para criar o banco e executar o script)

## Configuração do PostgreSQL

No laboratório o PostgreSQL usa a porta **7777**. Em uma instalação padrão a porta é **5432** — troque o número nos comandos abaixo se for o seu caso.

### Opção A — pelo PowerShell (psql)

Se o comando `psql` não for reconhecido, use o caminho completo, por exemplo `& "C:\Program Files\PostgreSQL\17\bin\psql.exe"`.

```powershell
cd C:\Users\alunods\Desktop\clinica-pediatrica
psql -U postgres -h localhost -p 7777 -c "CREATE DATABASE clinica_pediatrica;"
psql -U postgres -h localhost -p 7777 -d clinica_pediatrica -f clinica_pediatrica.sql
```

### Opção B — pelo pgAdmin 4

1. Conecte-se ao servidor PostgreSQL.
2. Crie um banco chamado `clinica_pediatrica`.
3. Abra o **Query Tool** desse banco.
4. Abra e execute todo o conteúdo do arquivo [`clinica_pediatrica.sql`](../clinica_pediatrica.sql).

O script cria a extensão `pgcrypto`, as tabelas `usuarios`, `responsaveis`, `criancas` e `atendimentos` (com PK, FK NOT NULL e `ON DELETE RESTRICT`) e insere os dados fictícios de teste. Ele pode ser executado mais de uma vez sem duplicar registros.

## Instalação

No PowerShell, entre na pasta `sistema`:

```powershell
cd C:\Users\alunods\Desktop\clinica-pediatrica\sistema
npm install
```

## Variáveis de configuração (.env)

Copie o modelo e edite com os dados da sua máquina:

```powershell
Copy-Item .env.example .env
notepad .env
```

| Variável | Valor padrão | Finalidade |
|---|---|---|
| `PGUSER` | `postgres` | Usuário do PostgreSQL |
| `PGPASSWORD` | — | Senha do usuário PostgreSQL (a da SUA instalação) |
| `PGHOST` | `localhost` | Servidor do PostgreSQL |
| `PGPORT` | `7777` | Porta do PostgreSQL (use `5432` em instalação padrão) |
| `PGDATABASE` | `clinica_pediatrica` | Banco da aplicação |
| `PORT` | `3000` | Porta HTTP do Express |
| `SESSION_SECRET` | — | Segredo que assina o cookie de sessão |
| `SESSAO_MINUTOS` | `30` | Tempo de expiração da sessão, em minutos |
| `CPF_CHAVE` | — | Chave do HMAC e da criptografia do CPF |

`CPF_CHAVE` precisa ser **igual** ao valor da linha `SET clinica.cpf_chave = '...'` do arquivo `clinica_pediatrica.sql`. Os dois arquivos já vêm com o mesmo valor de laboratório (`chave-local-pequenos-passos`). Se quiser usar uma chave própria, troque nos dois lugares **antes** de executar o script SQL.

O arquivo `.env` não é versionado (está no `.gitignore`). A senha do PostgreSQL é diferente das senhas de login da aplicação.

## Executar a aplicação

Ainda dentro da pasta `sistema`:

```powershell
npm start
```

Abra no navegador:

```text
http://localhost:3000
```

## Usuários de teste (dados fictícios)

| Operador | CPF | Senha |
|---|---|---|
| Mariana Alves | `019.067.890-96` | `Mariana@2026` |
| Rafael Costa | `370.462.526-45` | `Rafael@2026` |
| Juliana Ferreira | `734.875.747-21` | `Juliana@2026` |

O CPF pode ser digitado com ou sem pontuação. No banco ficam somente o hash bcrypt da senha e o CPF protegido.

O fluxo esperado é:

1. A aplicação abre a tela de login.
2. Com CPF ou senha errados aparece "CPF ou senha inválidos." (sem dizer qual campo falhou).
3. Com os dados corretos o sistema abre `/inicio`, mostrando o nome do operador, os módulos e o botão **Sair**.
4. Cadastre, edite, exclua e pesquise responsáveis; cadastre crianças escolhendo o responsável; cadastre atendimentos escolhendo a criança.

## Proteção de dados: hash x criptografia

| Dado | Técnica | Reversível? | Para quê |
|---|---|---|---|
| Senha (`senha_hash`) | bcrypt com salt | Não | No login, `bcrypt.compare` confere a senha digitada |
| CPF (`cpf_hash`) | HMAC-SHA256 com chave (`pgcrypto`) | Não | Localizar o operador no login e impedir CPF repetido |
| CPF (`cpf_cripto`) | `pgp_sym_encrypt` — AES (`pgcrypto`) | Sim, com a chave | Exibir o CPF para operador autenticado (mascarado na lista, completo na edição) |

- **Hash** é de mão única: serve para verificar, não para recuperar o valor.
- **Criptografia** é reversível: quem tem a chave recupera o valor. Por isso a chave fica no `.env`, fora do código.

## Regras importantes

- Todas as rotas internas usam o middleware `verificarAutenticacao`; sem sessão, o acesso volta para `/login`.
- A sessão expira após `SESSAO_MINUTOS`. Para demonstrar a expiração, use `SESSAO_MINUTOS=1`, faça login, espere 1 minuto e recarregue a página.
- O logout destrói a sessão no servidor e apaga o cookie.
- Responsável com crianças vinculadas não pode ser excluído: o sistema mostra uma mensagem explicando o motivo. O mesmo vale para criança com atendimentos. O banco reforça a regra com `ON DELETE RESTRICT`.
- Os atendimentos são listados com `ORDER BY data_atendimento ASC, horario ASC`: da data mais próxima para a mais distante, e o horário desempata atendimentos do mesmo dia.
- Todas as consultas são parametrizadas (`$1`, `$2`, ...) e os campos são validados no servidor.

## Gerar outro hash de senha

O arquivo [`gerar-hash.js`](./gerar-hash.js) gera um hash bcrypt:

```powershell
node gerar-hash.js MinhaSenha
```

Copie o hash gerado somente se precisar inserir outro usuário no banco. Senhas nunca devem ser salvas em texto puro.

## Rotas principais

| Método | Rota | Descrição |
|---|---|---|
| GET | `/login` | Exibe o login |
| POST | `/login` | Autentica o operador |
| POST / GET | `/logout` | Encerra a sessão |
| GET | `/inicio` | Página inicial |
| GET | `/responsaveis?busca=` | Lista e pesquisa responsáveis |
| GET / POST | `/responsaveis/novo` | Cadastra responsável |
| GET / POST | `/responsaveis/editar/:id` | Edita responsável |
| POST | `/responsaveis/deletar/:id` | Exclui responsável |
| GET | `/criancas` | Lista crianças |
| GET / POST | `/criancas/novo` | Cadastra criança |
| GET / POST | `/criancas/editar/:id` | Edita criança |
| POST | `/criancas/deletar/:id` | Exclui criança |
| GET | `/atendimentos` | Lista atendimentos (JOIN + ordenação) |
| GET / POST | `/atendimentos/novo` | Cadastra atendimento |
| GET / POST | `/atendimentos/editar/:id` | Edita atendimento |
| POST | `/atendimentos/deletar/:id` | Exclui atendimento |

## Solução de problemas

### `Missing script: "start"`

O comando foi executado na pasta errada. Entre na pasta que contém o `package.json`:

```powershell
cd C:\Users\alunods\Desktop\clinica-pediatrica\sistema
npm start
```

### `Variável CPF_CHAVE não definida`

O arquivo `.env` não existe na pasta `sistema`. Crie-o com `Copy-Item .env.example .env`.

### `EADDRINUSE: address already in use :::3000`

Já existe uma aplicação usando a porta 3000. Descubra o processo:

```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen
```

Encerre somente o processo exibido na coluna `OwningProcess`:

```powershell
Stop-Process -Id NUMERO_DO_PROCESSO -Force
```

Ou altere `PORT` no `.env`.

### `28P01: autenticação da senha falhou`

`PGPASSWORD` precisa ser a senha do usuário do PostgreSQL. Confira também `PGUSER` e `PGPORT` nas propriedades do servidor no pgAdmin.

### `3D000: banco de dados não existe`

Crie o banco `clinica_pediatrica` (veja "Configuração do PostgreSQL") ou ajuste `PGDATABASE` no `.env`.

### `ECONNREFUSED`

O PostgreSQL não está em execução ou a porta está errada. Confira se é `7777` (laboratório) ou `5432` (padrão).

### `Wrong key or corrupt data` ou login dos usuários de teste falhando

A `CPF_CHAVE` do `.env` está diferente da chave usada no `clinica_pediatrica.sql`. Deixe as duas iguais. Se a chave do script foi alterada depois de executado, apague e recrie o banco e rode o script de novo.

### `extensão "pgcrypto" não está disponível`

Instale o PostgreSQL pelo instalador oficial (que inclui as extensões contrib) e execute o script conectado com o usuário `postgres`.

### `erro de sintaxe` ao executar o SQL

Execute somente o conteúdo SQL de [`clinica_pediatrica.sql`](../clinica_pediatrica.sql). Não cole comandos do PowerShell dentro do Query Tool.

## Ao compartilhar o projeto

Não inclua a pasta `node_modules` nem o arquivo `.env`. Quem receber o projeto executa `npm install` e cria o próprio `.env` a partir do `.env.example`.
