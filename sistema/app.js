import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import bcrypt from 'bcrypt';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './db.js';
import { verificarAutenticacao } from './middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORTA = Number(process.env.PORT) || 3000;

const CPF_CHAVE = process.env.CPF_CHAVE;
if (!CPF_CHAVE) {
    console.error('Variável CPF_CHAVE não definida. Copie o .env.example para .env e preencha os valores.');
    process.exit(1);
}

const SESSAO_MINUTOS = Number(process.env.SESSAO_MINUTOS) || 30;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: false }));

app.use(session({
    name: 'clinica.sid',
    secret: process.env.SESSION_SECRET || 'troque-esta-chave-apenas-para-aula-local',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * SESSAO_MINUTOS, httpOnly: true, sameSite: 'lax' }
}));

app.use((req, res, next) => {
    res.locals.usuario = req.session.usuario || null;
    res.locals.mensagem = req.session.mensagem || null;
    if (req.session.mensagem) delete req.session.mensagem;
    next();
});

const SITUACOES = ['Agendado', 'Realizado', 'Cancelado'];

function avisar(req, tipo, texto) {
    req.session.mensagem = { tipo, texto };
}

function texto(valor) {
    return typeof valor === 'string' ? valor.trim() : '';
}

function somenteDigitos(valor) {
    return texto(valor).replace(/\D/g, '');
}

function cpfValido(cpf) {
    if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
    const digito = (base) => {
        let soma = 0;
        for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (base.length + 1 - i);
        const resto = (soma * 10) % 11;
        return resto === 10 ? 0 : resto;
    };
    const d1 = digito(cpf.slice(0, 9));
    const d2 = digito(cpf.slice(0, 9) + d1);
    return cpf === cpf.slice(0, 9) + d1 + d2;
}

function formatarCpf(cpf) {
    if (!cpf || cpf.length !== 11) return cpf || '';
    return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
}

function mascararCpf(cpf) {
    if (!cpf || cpf.length !== 11) return '***';
    return `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**`;
}

function idValido(valor) {
    const id = Number(valor);
    return Number.isInteger(id) && id > 0 ? id : null;
}

function dataValida(valor) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
    const data = new Date(`${valor}T00:00:00Z`);
    return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor;
}

function hojeISO() {
    const agora = new Date();
    agora.setMinutes(agora.getMinutes() - agora.getTimezoneOffset());
    return agora.toISOString().slice(0, 10);
}

app.locals.formatarData = (valor) => {
    if (!valor) return '';
    const [ano, mes, dia] = String(valor).split('-');
    return `${dia}/${mes}/${ano}`;
};
app.locals.formatarHora = (valor) => (valor ? String(valor).slice(0, 5) : '');

function validarResponsavel(dados) {
    const erros = [];
    if (texto(dados.nome).length < 3) erros.push('Informe o nome completo do responsável.');
    if (!cpfValido(somenteDigitos(dados.cpf))) erros.push('Informe um CPF válido.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(texto(dados.email))) erros.push('Informe um e-mail válido.');
    const tel = somenteDigitos(dados.telefone);
    if (tel.length < 10 || tel.length > 11) erros.push('Informe um telefone com DDD (10 ou 11 dígitos).');
    return erros;
}

async function validarCrianca(dados) {
    const erros = [];
    if (texto(dados.nome).length < 2) erros.push('Informe o nome da criança.');
    const nascimento = texto(dados.data_nascimento);
    if (!dataValida(nascimento)) erros.push('Informe uma data de nascimento válida.');
    else if (nascimento > hojeISO()) erros.push('A data de nascimento não pode estar no futuro.');
    const responsavelId = idValido(dados.responsavel_id);
    if (!responsavelId) {
        erros.push('Selecione o responsável.');
    } else {
        const existe = await pool.query('SELECT 1 FROM responsaveis WHERE id = $1', [responsavelId]);
        if (existe.rows.length === 0) erros.push('O responsável selecionado não existe.');
    }
    return erros;
}

async function validarAtendimento(dados) {
    const erros = [];
    const criancaId = idValido(dados.crianca_id);
    if (!criancaId) {
        erros.push('Selecione a criança.');
    } else {
        const existe = await pool.query('SELECT 1 FROM criancas WHERE id = $1', [criancaId]);
        if (existe.rows.length === 0) erros.push('A criança selecionada não existe.');
    }
    if (!dataValida(texto(dados.data_atendimento))) erros.push('Informe uma data de atendimento válida.');
    if (!/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(texto(dados.horario))) erros.push('Informe um horário válido.');
    if (texto(dados.motivo).length < 3) erros.push('Informe o motivo do atendimento.');
    if (!SITUACOES.includes(texto(dados.situacao))) erros.push('Selecione uma situação válida.');
    return erros;
}

async function listarResponsaveisSelect() {
    const r = await pool.query('SELECT id, nome FROM responsaveis ORDER BY nome ASC');
    return r.rows;
}

async function listarCriancasSelect() {
    const r = await pool.query(`
        SELECT c.id, c.nome, r.nome AS responsavel_nome
        FROM criancas c
        INNER JOIN responsaveis r ON r.id = c.responsavel_id
        ORDER BY c.nome ASC
    `);
    return r.rows;
}

const HASH_FICTICIO = bcrypt.hashSync('senha-inexistente', 10);

app.get('/login', (req, res) => {
    if (req.session.usuario) return res.redirect('/inicio');
    res.render('login', { erro: null, cpf: '' });
});

app.post('/login', async (req, res) => {
    const cpf = somenteDigitos(req.body.cpf);
    const senha = typeof req.body.senha === 'string' ? req.body.senha : '';
    const MENSAGEM_ERRO = 'CPF ou senha inválidos.';

    if (!cpf || !senha) {
        return res.status(400).render('login', { erro: 'Preencha CPF e senha.', cpf: req.body.cpf || '' });
    }

    try {
        const resultado = await pool.query(
            `SELECT id, nome, senha_hash FROM usuarios
             WHERE cpf_hash = encode(hmac($1::text, $2::text, 'sha256'), 'hex')`,
            [cpf, CPF_CHAVE]
        );
        const usuario = resultado.rows[0];
        const senhaValida = await bcrypt.compare(senha, usuario ? usuario.senha_hash : HASH_FICTICIO);

        if (!usuario || !senhaValida) {
            return res.status(401).render('login', { erro: MENSAGEM_ERRO, cpf: req.body.cpf || '' });
        }

        req.session.regenerate((erroSessao) => {
            if (erroSessao) return res.status(500).send('Falha ao iniciar sessão.');
            req.session.usuario = { id: usuario.id, nome: usuario.nome };
            req.session.save((erroSalvar) => {
                if (erroSalvar) return res.status(500).send('Falha ao salvar sessão.');
                res.redirect('/inicio');
            });
        });
    } catch (err) {
        console.error(err);
        res.status(500).render('login', { erro: 'Erro interno ao realizar login.', cpf: '' });
    }
});

function encerrarSessao(req, res) {
    req.session.destroy((erro) => {
        if (erro) return res.status(500).send('Erro ao encerrar sessão.');
        res.clearCookie('clinica.sid');
        res.redirect('/login');
    });
}
app.post('/logout', encerrarSessao);
app.get('/logout', encerrarSessao);

app.get('/', (req, res) => {
    res.redirect(req.session.usuario ? '/inicio' : '/login');
});

app.get('/inicio', verificarAutenticacao, async (req, res) => {
    try {
        const totais = await pool.query(`
            SELECT
                (SELECT COUNT(*) FROM responsaveis) AS responsaveis,
                (SELECT COUNT(*) FROM criancas) AS criancas,
                (SELECT COUNT(*) FROM atendimentos) AS atendimentos
        `);
        res.render('inicio', {
            totais: totais.rows[0],
            expiraEm: req.session.cookie.expires,
            sessaoMinutos: SESSAO_MINUTOS
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao carregar a página inicial.');
    }
});

app.get('/responsaveis', verificarAutenticacao, async (req, res) => {
    const busca = texto(req.query.busca);
    const termo = busca.replace(/[\\%_]/g, '\\$&');

    try {
        const resultado = await pool.query(`
            SELECT r.id, r.nome, r.email, r.telefone,
                   pgp_sym_decrypt(r.cpf_cripto, $1::text) AS cpf,
                   COUNT(c.id)::int AS total_criancas
            FROM responsaveis r
            LEFT JOIN criancas c ON c.responsavel_id = r.id
            WHERE ($2::text = '' OR r.nome ILIKE '%' || $2::text || '%')
            GROUP BY r.id
            ORDER BY r.nome ASC
        `, [CPF_CHAVE, termo]);

        const responsaveis = resultado.rows.map((r) => ({ ...r, cpf: mascararCpf(r.cpf) }));
        res.render('responsaveis', { responsaveis, busca });
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao buscar responsáveis.');
    }
});

app.get('/responsaveis/novo', verificarAutenticacao, (req, res) => {
    res.render('novo-responsavel', { erros: [], dados: {} });
});

app.post('/responsaveis/novo', verificarAutenticacao, async (req, res) => {
    const erros = validarResponsavel(req.body);
    if (erros.length > 0) {
        return res.status(400).render('novo-responsavel', { erros, dados: req.body });
    }

    const cpf = somenteDigitos(req.body.cpf);
    try {
        await pool.query(`
            INSERT INTO responsaveis (nome, cpf_hash, cpf_cripto, email, telefone)
            VALUES ($1, encode(hmac($2::text, $5::text, 'sha256'), 'hex'), pgp_sym_encrypt($2::text, $5::text), $3, $4)
        `, [texto(req.body.nome), cpf, texto(req.body.email), texto(req.body.telefone), CPF_CHAVE]);
        avisar(req, 'sucesso', 'Responsável cadastrado com sucesso.');
        res.redirect('/responsaveis');
    } catch (err) {
        if (err.code === '23505') {
            return res.status(400).render('novo-responsavel', { erros: ['Já existe um responsável com este CPF.'], dados: req.body });
        }
        console.error(err);
        res.status(500).send('Erro ao cadastrar responsável.');
    }
});

app.get('/responsaveis/editar/:id', verificarAutenticacao, async (req, res) => {
    const id = idValido(req.params.id);
    if (!id) return res.status(404).render('erro', { titulo: 'Responsável não encontrado.', voltar: '/responsaveis' });

    try {
        const resultado = await pool.query(`
            SELECT id, nome, email, telefone, pgp_sym_decrypt(cpf_cripto, $1::text) AS cpf
            FROM responsaveis WHERE id = $2
        `, [CPF_CHAVE, id]);

        if (resultado.rows.length === 0) {
            return res.status(404).render('erro', { titulo: 'Responsável não encontrado.', voltar: '/responsaveis' });
        }
        const dados = { ...resultado.rows[0], cpf: formatarCpf(resultado.rows[0].cpf) };
        res.render('editar-responsavel', { erros: [], dados });
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao buscar responsável para edição.');
    }
});

app.post('/responsaveis/editar/:id', verificarAutenticacao, async (req, res) => {
    const id = idValido(req.params.id);
    if (!id) return res.status(404).render('erro', { titulo: 'Responsável não encontrado.', voltar: '/responsaveis' });

    const erros = validarResponsavel(req.body);
    if (erros.length > 0) {
        return res.status(400).render('editar-responsavel', { erros, dados: { ...req.body, id } });
    }

    const cpf = somenteDigitos(req.body.cpf);
    try {
        const resultado = await pool.query(`
            UPDATE responsaveis
            SET nome = $1,
                cpf_hash = encode(hmac($2::text, $5::text, 'sha256'), 'hex'),
                cpf_cripto = pgp_sym_encrypt($2::text, $5::text),
                email = $3,
                telefone = $4
            WHERE id = $6
        `, [texto(req.body.nome), cpf, texto(req.body.email), texto(req.body.telefone), CPF_CHAVE, id]);

        if (resultado.rowCount === 0) {
            return res.status(404).render('erro', { titulo: 'Responsável não encontrado.', voltar: '/responsaveis' });
        }
        avisar(req, 'sucesso', 'Responsável atualizado com sucesso.');
        res.redirect('/responsaveis');
    } catch (err) {
        if (err.code === '23505') {
            return res.status(400).render('editar-responsavel', { erros: ['Já existe outro responsável com este CPF.'], dados: { ...req.body, id } });
        }
        console.error(err);
        res.status(500).send('Erro ao atualizar responsável.');
    }
});

app.post('/responsaveis/deletar/:id', verificarAutenticacao, async (req, res) => {
    const id = idValido(req.params.id);
    if (!id) return res.redirect('/responsaveis');

    try {
        const vinculos = await pool.query(`
            SELECT r.nome, COUNT(c.id)::int AS total
            FROM responsaveis r
            LEFT JOIN criancas c ON c.responsavel_id = r.id
            WHERE r.id = $1
            GROUP BY r.id
        `, [id]);

        if (vinculos.rows.length === 0) {
            avisar(req, 'erro', 'Responsável não encontrado.');
        } else if (vinculos.rows[0].total > 0) {
            const { nome, total } = vinculos.rows[0];
            avisar(req, 'erro', `Não é possível excluir ${nome}: existe(m) ${total} criança(s) vinculada(s). Exclua ou transfira as crianças para outro responsável antes.`);
        } else {
            await pool.query('DELETE FROM responsaveis WHERE id = $1', [id]);
            avisar(req, 'sucesso', 'Responsável excluído com sucesso.');
        }
        res.redirect('/responsaveis');
    } catch (err) {
        if (err.code === '23503') {
            avisar(req, 'erro', 'Não é possível excluir: o responsável possui crianças vinculadas.');
            return res.redirect('/responsaveis');
        }
        console.error(err);
        res.status(500).send('Erro ao excluir responsável.');
    }
});

app.get('/criancas', verificarAutenticacao, async (req, res) => {
    try {
        const resultado = await pool.query(`
            SELECT c.id, c.nome, c.data_nascimento, c.responsavel_id,
                   r.nome AS responsavel_nome,
                   (SELECT COUNT(*) FROM atendimentos a WHERE a.crianca_id = c.id)::int AS total_atendimentos
            FROM criancas c
            INNER JOIN responsaveis r ON r.id = c.responsavel_id
            ORDER BY c.nome ASC
        `);
        res.render('criancas', { criancas: resultado.rows });
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao buscar crianças.');
    }
});

app.get('/criancas/novo', verificarAutenticacao, async (req, res) => {
    try {
        const responsaveis = await listarResponsaveisSelect();
        res.render('nova-crianca', { erros: [], dados: {}, responsaveis, hoje: hojeISO() });
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao carregar formulário de crianças.');
    }
});

app.post('/criancas/novo', verificarAutenticacao, async (req, res) => {
    try {
        const erros = await validarCrianca(req.body);
        if (erros.length > 0) {
            const responsaveis = await listarResponsaveisSelect();
            return res.status(400).render('nova-crianca', { erros, dados: req.body, responsaveis, hoje: hojeISO() });
        }

        await pool.query(
            'INSERT INTO criancas (nome, data_nascimento, responsavel_id) VALUES ($1, $2, $3)',
            [texto(req.body.nome), texto(req.body.data_nascimento), idValido(req.body.responsavel_id)]
        );
        avisar(req, 'sucesso', 'Criança cadastrada com sucesso.');
        res.redirect('/criancas');
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao cadastrar criança.');
    }
});

app.get('/criancas/editar/:id', verificarAutenticacao, async (req, res) => {
    const id = idValido(req.params.id);
    if (!id) return res.status(404).render('erro', { titulo: 'Criança não encontrada.', voltar: '/criancas' });

    try {
        const resultado = await pool.query('SELECT * FROM criancas WHERE id = $1', [id]);
        if (resultado.rows.length === 0) {
            return res.status(404).render('erro', { titulo: 'Criança não encontrada.', voltar: '/criancas' });
        }
        const responsaveis = await listarResponsaveisSelect();
        res.render('editar-crianca', { erros: [], dados: resultado.rows[0], responsaveis, hoje: hojeISO() });
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao buscar criança para edição.');
    }
});

app.post('/criancas/editar/:id', verificarAutenticacao, async (req, res) => {
    const id = idValido(req.params.id);
    if (!id) return res.status(404).render('erro', { titulo: 'Criança não encontrada.', voltar: '/criancas' });

    try {
        const erros = await validarCrianca(req.body);
        if (erros.length > 0) {
            const responsaveis = await listarResponsaveisSelect();
            return res.status(400).render('editar-crianca', { erros, dados: { ...req.body, id }, responsaveis, hoje: hojeISO() });
        }

        const resultado = await pool.query(
            'UPDATE criancas SET nome = $1, data_nascimento = $2, responsavel_id = $3 WHERE id = $4',
            [texto(req.body.nome), texto(req.body.data_nascimento), idValido(req.body.responsavel_id), id]
        );
        if (resultado.rowCount === 0) {
            return res.status(404).render('erro', { titulo: 'Criança não encontrada.', voltar: '/criancas' });
        }
        avisar(req, 'sucesso', 'Criança atualizada com sucesso.');
        res.redirect('/criancas');
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao atualizar criança.');
    }
});

app.post('/criancas/deletar/:id', verificarAutenticacao, async (req, res) => {
    const id = idValido(req.params.id);
    if (!id) return res.redirect('/criancas');

    try {
        const vinculos = await pool.query(`
            SELECT c.nome, COUNT(a.id)::int AS total
            FROM criancas c
            LEFT JOIN atendimentos a ON a.crianca_id = c.id
            WHERE c.id = $1
            GROUP BY c.id
        `, [id]);

        if (vinculos.rows.length === 0) {
            avisar(req, 'erro', 'Criança não encontrada.');
        } else if (vinculos.rows[0].total > 0) {
            const { nome, total } = vinculos.rows[0];
            avisar(req, 'erro', `Não é possível excluir ${nome}: existe(m) ${total} atendimento(s) registrado(s) para esta criança. Exclua os atendimentos antes.`);
        } else {
            await pool.query('DELETE FROM criancas WHERE id = $1', [id]);
            avisar(req, 'sucesso', 'Criança excluída com sucesso.');
        }
        res.redirect('/criancas');
    } catch (err) {
        if (err.code === '23503') {
            avisar(req, 'erro', 'Não é possível excluir: a criança possui atendimentos registrados.');
            return res.redirect('/criancas');
        }
        console.error(err);
        res.status(500).send('Erro ao excluir criança.');
    }
});

app.get('/atendimentos', verificarAutenticacao, async (req, res) => {
    const destaque = req.session.destaque || null;
    if (req.session.destaque) delete req.session.destaque;

    try {
        const resultado = await pool.query(`
            SELECT a.id, a.data_atendimento, a.horario, a.motivo, a.situacao,
                   c.nome AS crianca_nome,
                   r.nome AS responsavel_nome, r.telefone AS responsavel_telefone
            FROM atendimentos a
            INNER JOIN criancas c ON c.id = a.crianca_id
            INNER JOIN responsaveis r ON r.id = c.responsavel_id
            ORDER BY a.data_atendimento ASC, a.horario ASC
        `);
        res.render('atendimentos', { atendimentos: resultado.rows, destaque });
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao buscar atendimentos.');
    }
});

app.get('/atendimentos/novo', verificarAutenticacao, async (req, res) => {
    try {
        const criancas = await listarCriancasSelect();
        res.render('novo-atendimento', { erros: [], dados: { situacao: 'Agendado' }, criancas, situacoes: SITUACOES });
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao carregar formulário de atendimentos.');
    }
});

app.post('/atendimentos/novo', verificarAutenticacao, async (req, res) => {
    try {
        const erros = await validarAtendimento(req.body);
        if (erros.length > 0) {
            const criancas = await listarCriancasSelect();
            return res.status(400).render('novo-atendimento', { erros, dados: req.body, criancas, situacoes: SITUACOES });
        }

        const resultado = await pool.query(`
            INSERT INTO atendimentos (crianca_id, data_atendimento, horario, motivo, situacao)
            VALUES ($1, $2, $3, $4, $5) RETURNING id
        `, [idValido(req.body.crianca_id), texto(req.body.data_atendimento), texto(req.body.horario), texto(req.body.motivo), texto(req.body.situacao)]);

        req.session.destaque = resultado.rows[0].id;
        avisar(req, 'sucesso', 'Atendimento cadastrado com sucesso.');
        res.redirect('/atendimentos');
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao cadastrar atendimento.');
    }
});

app.get('/atendimentos/editar/:id', verificarAutenticacao, async (req, res) => {
    const id = idValido(req.params.id);
    if (!id) return res.status(404).render('erro', { titulo: 'Atendimento não encontrado.', voltar: '/atendimentos' });

    try {
        const resultado = await pool.query('SELECT * FROM atendimentos WHERE id = $1', [id]);
        if (resultado.rows.length === 0) {
            return res.status(404).render('erro', { titulo: 'Atendimento não encontrado.', voltar: '/atendimentos' });
        }
        const dados = { ...resultado.rows[0], horario: String(resultado.rows[0].horario).slice(0, 5) };
        const criancas = await listarCriancasSelect();
        res.render('editar-atendimento', { erros: [], dados, criancas, situacoes: SITUACOES });
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao buscar atendimento para edição.');
    }
});

app.post('/atendimentos/editar/:id', verificarAutenticacao, async (req, res) => {
    const id = idValido(req.params.id);
    if (!id) return res.status(404).render('erro', { titulo: 'Atendimento não encontrado.', voltar: '/atendimentos' });

    try {
        const erros = await validarAtendimento(req.body);
        if (erros.length > 0) {
            const criancas = await listarCriancasSelect();
            return res.status(400).render('editar-atendimento', { erros, dados: { ...req.body, id }, criancas, situacoes: SITUACOES });
        }

        const resultado = await pool.query(`
            UPDATE atendimentos
            SET crianca_id = $1, data_atendimento = $2, horario = $3, motivo = $4, situacao = $5
            WHERE id = $6
        `, [idValido(req.body.crianca_id), texto(req.body.data_atendimento), texto(req.body.horario), texto(req.body.motivo), texto(req.body.situacao), id]);

        if (resultado.rowCount === 0) {
            return res.status(404).render('erro', { titulo: 'Atendimento não encontrado.', voltar: '/atendimentos' });
        }
        req.session.destaque = id;
        avisar(req, 'sucesso', 'Atendimento atualizado com sucesso.');
        res.redirect('/atendimentos');
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao atualizar atendimento.');
    }
});

app.post('/atendimentos/deletar/:id', verificarAutenticacao, async (req, res) => {
    const id = idValido(req.params.id);
    if (!id) return res.redirect('/atendimentos');

    try {
        const resultado = await pool.query('DELETE FROM atendimentos WHERE id = $1', [id]);
        if (resultado.rowCount === 0) avisar(req, 'erro', 'Atendimento não encontrado.');
        else avisar(req, 'sucesso', 'Atendimento excluído com sucesso.');
        res.redirect('/atendimentos');
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao excluir atendimento.');
    }
});

app.use((req, res) => {
    res.status(404).render('erro', { titulo: 'Página não encontrada.', voltar: '/' });
});

app.listen(PORTA, () => {
    console.log(`Clínica Pediátrica Pequenos Passos rodando em http://localhost:${PORTA}`);
    console.log(`Sessão expira em ${SESSAO_MINUTOS} minuto(s).`);
});
