import bcrypt from 'bcrypt';

const senhaPlana = process.argv[2];
const saltRounds = 10;

async function gerarHashSenha() {
    if (!senhaPlana) {
        console.log('Informe a senha: node gerar-hash.js MinhaSenha');
        return;
    }
    try {
        const hash = await bcrypt.hash(senhaPlana, saltRounds);
        console.log('====================================================');
        console.log(`Hash Seguro Gerado para o Banco: ${hash}`);
        console.log('====================================================');
    } catch (erro) {
        console.error('Erro ao gerar hash:', erro);
    }
}

gerarHashSenha();
