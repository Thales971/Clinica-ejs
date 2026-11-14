SET client_encoding = 'UTF8';

CREATE EXTENSION IF NOT EXISTS pgcrypto;

SET clinica.cpf_chave = 'chave-local-pequenos-passos';

CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    cpf_hash CHAR(64) UNIQUE NOT NULL,
    cpf_cripto BYTEA NOT NULL,
    senha_hash VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS responsaveis (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    cpf_hash CHAR(64) UNIQUE NOT NULL,
    cpf_cripto BYTEA NOT NULL,
    email VARCHAR(120) NOT NULL,
    telefone VARCHAR(20) NOT NULL
);

CREATE TABLE IF NOT EXISTS criancas (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    data_nascimento DATE NOT NULL,
    responsavel_id INT NOT NULL REFERENCES responsaveis(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS atendimentos (
    id SERIAL PRIMARY KEY,
    crianca_id INT NOT NULL REFERENCES criancas(id) ON DELETE RESTRICT,
    data_atendimento DATE NOT NULL,
    horario TIME NOT NULL,
    motivo VARCHAR(200) NOT NULL,
    situacao VARCHAR(20) NOT NULL CHECK (situacao IN ('Agendado', 'Realizado', 'Cancelado'))
);

CREATE INDEX IF NOT EXISTS idx_atendimentos_data_horario ON atendimentos (data_atendimento, horario);

INSERT INTO usuarios (nome, cpf_hash, cpf_cripto, senha_hash) VALUES
('Mariana Alves',
 encode(hmac('01906789096', current_setting('clinica.cpf_chave'), 'sha256'), 'hex'),
 pgp_sym_encrypt('01906789096', current_setting('clinica.cpf_chave')),
 '$2b$10$CMLGUg4GR2Fz8gh2ENJeHuWmOqh85ThqjWCtEidOY1Vvmh6Uaa8GW'),
('Rafael Costa',
 encode(hmac('37046252645', current_setting('clinica.cpf_chave'), 'sha256'), 'hex'),
 pgp_sym_encrypt('37046252645', current_setting('clinica.cpf_chave')),
 '$2b$10$G9vSWGV5oeCb2LvGiZA3FecIbfRYNmH9ikJwRCjLjTBnDBbHZp2Dq'),
('Juliana Ferreira',
 encode(hmac('73487574721', current_setting('clinica.cpf_chave'), 'sha256'), 'hex'),
 pgp_sym_encrypt('73487574721', current_setting('clinica.cpf_chave')),
 '$2b$10$SXw25Ir7sUE4IAfCTcy5dOMbuwagINRLDzXNYhF3y7LmkQwo1igxW')
ON CONFLICT (cpf_hash) DO NOTHING;

INSERT INTO responsaveis (nome, cpf_hash, cpf_cripto, email, telefone) VALUES
('Carlos Eduardo Lima',
 encode(hmac('07396754941', current_setting('clinica.cpf_chave'), 'sha256'), 'hex'),
 pgp_sym_encrypt('07396754941', current_setting('clinica.cpf_chave')),
 'carlos.lima@email.com', '(11) 98765-4321'),
('Fernanda Souza Martins',
 encode(hmac('27351581282', current_setting('clinica.cpf_chave'), 'sha256'), 'hex'),
 pgp_sym_encrypt('27351581282', current_setting('clinica.cpf_chave')),
 'fernanda.martins@email.com', '(11) 97654-3210'),
('Roberto Carlos Pereira',
 encode(hmac('10376314559', current_setting('clinica.cpf_chave'), 'sha256'), 'hex'),
 pgp_sym_encrypt('10376314559', current_setting('clinica.cpf_chave')),
 'roberto.pereira@email.com', '(11) 96543-2109')
ON CONFLICT (cpf_hash) DO NOTHING;

INSERT INTO criancas (nome, data_nascimento, responsavel_id)
SELECT 'Lucas Lima', DATE '2019-03-12', id FROM responsaveis
WHERE cpf_hash = encode(hmac('07396754941', current_setting('clinica.cpf_chave'), 'sha256'), 'hex')
AND NOT EXISTS (SELECT 1 FROM criancas WHERE nome = 'Lucas Lima');

INSERT INTO criancas (nome, data_nascimento, responsavel_id)
SELECT 'Sofia Lima', DATE '2021-08-25', id FROM responsaveis
WHERE cpf_hash = encode(hmac('07396754941', current_setting('clinica.cpf_chave'), 'sha256'), 'hex')
AND NOT EXISTS (SELECT 1 FROM criancas WHERE nome = 'Sofia Lima');

INSERT INTO criancas (nome, data_nascimento, responsavel_id)
SELECT 'Helena Martins', DATE '2020-11-02', id FROM responsaveis
WHERE cpf_hash = encode(hmac('27351581282', current_setting('clinica.cpf_chave'), 'sha256'), 'hex')
AND NOT EXISTS (SELECT 1 FROM criancas WHERE nome = 'Helena Martins');

INSERT INTO criancas (nome, data_nascimento, responsavel_id)
SELECT 'Miguel Pereira', DATE '2018-05-17', id FROM responsaveis
WHERE cpf_hash = encode(hmac('10376314559', current_setting('clinica.cpf_chave'), 'sha256'), 'hex')
AND NOT EXISTS (SELECT 1 FROM criancas WHERE nome = 'Miguel Pereira');

INSERT INTO atendimentos (crianca_id, data_atendimento, horario, motivo, situacao)
SELECT id, DATE '2026-12-10', TIME '14:30', 'Consulta de rotina (puericultura)', 'Agendado' FROM criancas
WHERE nome = 'Lucas Lima'
AND NOT EXISTS (SELECT 1 FROM atendimentos WHERE data_atendimento = DATE '2026-12-10' AND horario = TIME '14:30');

INSERT INTO atendimentos (crianca_id, data_atendimento, horario, motivo, situacao)
SELECT id, DATE '2026-11-03', TIME '09:00', 'Febre e dor de garganta', 'Realizado' FROM criancas
WHERE nome = 'Helena Martins'
AND NOT EXISTS (SELECT 1 FROM atendimentos WHERE data_atendimento = DATE '2026-11-03' AND horario = TIME '09:00');

INSERT INTO atendimentos (crianca_id, data_atendimento, horario, motivo, situacao)
SELECT id, DATE '2026-11-20', TIME '10:15', 'Aplicação de vacina', 'Agendado' FROM criancas
WHERE nome = 'Miguel Pereira'
AND NOT EXISTS (SELECT 1 FROM atendimentos WHERE data_atendimento = DATE '2026-11-20' AND horario = TIME '10:15');

INSERT INTO atendimentos (crianca_id, data_atendimento, horario, motivo, situacao)
SELECT id, DATE '2026-11-20', TIME '08:30', 'Retorno de exames', 'Agendado' FROM criancas
WHERE nome = 'Sofia Lima'
AND NOT EXISTS (SELECT 1 FROM atendimentos WHERE data_atendimento = DATE '2026-11-20' AND horario = TIME '08:30');
