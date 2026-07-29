import "dotenv/config";
import { prisma } from "../src/lib/prisma";

// Dados fictícios para demonstração — nenhuma pessoa real.

function diasAPartirDeHoje(dias: number): Date {
  const data = new Date();
  data.setDate(data.getDate() + dias);
  return data;
}

function nascidoComIdade(idade: number): Date {
  const data = new Date();
  data.setFullYear(data.getFullYear() - idade);
  data.setMonth(5, 15); // dia fixo (15/jun) só pra não depender do dia de hoje
  return data;
}

type AlunoDemo = {
  nome: string;
  modalidade: string;
  graduacaoFaixa: string;
  statusPagamento: string;
  aptoExame: boolean;
  idade: number;
  cidade: string;
  telefoneSufixo: string;
  vencimentoEmDias: number;
  lesoes?: string;
};

const ALUNOS_DEMO: AlunoDemo[] = [
  { nome: "Pedro Henrique Lima", modalidade: "Kids", graduacaoFaixa: "Faixa Branca", statusPagamento: "Em dia", aptoExame: false, idade: 10, cidade: "São Paulo", telefoneSufixo: "0001", vencimentoEmDias: 20 },
  { nome: "Ana Beatriz Souza", modalidade: "Capoeira", graduacaoFaixa: "Faixa Azul", statusPagamento: "Em dia", aptoExame: true, idade: 14, cidade: "Osasco", telefoneSufixo: "0002", vencimentoEmDias: 15 },
  { nome: "Carlos Eduardo Ferreira", modalidade: "Boxe/Muay Thai", graduacaoFaixa: "Iniciante", statusPagamento: "Pendente", aptoExame: false, idade: 16, cidade: "Barueri", telefoneSufixo: "0003", vencimentoEmDias: -2 },
  { nome: "Juliana Alves Costa", modalidade: "Musculação/Personal", graduacaoFaixa: "Faixa Roxa", statusPagamento: "Em dia", aptoExame: false, idade: 19, cidade: "Carapicuíba", telefoneSufixo: "0004", vencimentoEmDias: 25 },
  { nome: "Rafael Santos Oliveira", modalidade: "Capoeira", graduacaoFaixa: "Faixa Marrom", statusPagamento: "Atrasado", aptoExame: false, idade: 22, cidade: "Santana de Parnaíba", telefoneSufixo: "0005", vencimentoEmDias: -5, lesoes: "Entorse no tornozelo direito (recuperando, sem impacto por enquanto)" },
  { nome: "Camila Rodrigues Pereira", modalidade: "Boxe/Muay Thai", graduacaoFaixa: "Intermediário", statusPagamento: "Em dia", aptoExame: false, idade: 24, cidade: "Jandira", telefoneSufixo: "0006", vencimentoEmDias: 18 },
  { nome: "Bruno Martins Silva", modalidade: "Musculação/Personal", graduacaoFaixa: "Faixa Preta", statusPagamento: "Em dia", aptoExame: true, idade: 28, cidade: "São Paulo", telefoneSufixo: "0007", vencimentoEmDias: 1 },
  { nome: "Fernanda Cardoso Rocha", modalidade: "Capoeira", graduacaoFaixa: "Avançado", statusPagamento: "Pendente", aptoExame: false, idade: 31, cidade: "Osasco", telefoneSufixo: "0008", vencimentoEmDias: 0 },
  { nome: "Lucas Gabriel Nascimento", modalidade: "Boxe/Muay Thai", graduacaoFaixa: "Faixa Azul", statusPagamento: "Em dia", aptoExame: false, idade: 33, cidade: "Barueri", telefoneSufixo: "0009", vencimentoEmDias: 12 },
  { nome: "Mariana Teixeira Barbosa", modalidade: "Musculação/Personal", graduacaoFaixa: "Faixa Preta", statusPagamento: "Em dia", aptoExame: true, idade: 38, cidade: "Carapicuíba", telefoneSufixo: "0010", vencimentoEmDias: 3 },
  { nome: "Thiago Almeida Ribeiro", modalidade: "Capoeira", graduacaoFaixa: "Avançado", statusPagamento: "Atrasado", aptoExame: false, idade: 42, cidade: "Santana de Parnaíba", telefoneSufixo: "0011", vencimentoEmDias: -1 },
  { nome: "Beatriz Correia Duarte", modalidade: "Aula para Idosos", graduacaoFaixa: "Graduado", statusPagamento: "Em dia", aptoExame: false, idade: 50, cidade: "Jandira", telefoneSufixo: "0012", vencimentoEmDias: 28 },
  { nome: "Gustavo Henrique Nunes", modalidade: "Aula para Idosos", graduacaoFaixa: "Faixa Roxa", statusPagamento: "Em dia", aptoExame: false, idade: 55, cidade: "São Paulo", telefoneSufixo: "0013", vencimentoEmDias: 10 },
  { nome: "Larissa Fontes Moreira", modalidade: "Kids", graduacaoFaixa: "Iniciante", statusPagamento: "Pendente", aptoExame: false, idade: 12, cidade: "Osasco", telefoneSufixo: "0014", vencimentoEmDias: 5 },
  { nome: "Diego Cavalcanti Freitas", modalidade: "Boxe/Muay Thai", graduacaoFaixa: "Faixa Marrom", statusPagamento: "Em dia", aptoExame: false, idade: 27, cidade: "Barueri", telefoneSufixo: "0015", vencimentoEmDias: 22 },
  { nome: "Isabela Monteiro Vieira", modalidade: "Musculação/Personal", graduacaoFaixa: "Faixa Azul", statusPagamento: "Em dia", aptoExame: false, idade: 20, cidade: "Carapicuíba", telefoneSufixo: "0016", vencimentoEmDias: 17 },
  { nome: "Rodrigo Pinheiro Azevedo", modalidade: "Capoeira", graduacaoFaixa: "Iniciante", statusPagamento: "Atrasado", aptoExame: false, idade: 35, cidade: "Santana de Parnaíba", telefoneSufixo: "0017", vencimentoEmDias: -3 },
  { nome: "Vitória Campos Andrade", modalidade: "Kids", graduacaoFaixa: "Faixa Branca", statusPagamento: "Em dia", aptoExame: false, idade: 15, cidade: "Jandira", telefoneSufixo: "0018" , vencimentoEmDias: 9 },
];

function emailDemo(nome: string): string {
  const semAcento = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(" ");
  return `${semAcento[0]}.${semAcento[semAcento.length - 1]}@exemplo.com`;
}

async function main() {
  let criados = 0;
  let ignorados = 0;

  for (const a of ALUNOS_DEMO) {
    const existente = await prisma.aluno.findFirst({ where: { nome: a.nome } });
    if (existente) {
      ignorados++;
      continue;
    }

    const dataMatricula = diasAPartirDeHoje(a.vencimentoEmDias - 30);

    await prisma.aluno.create({
      data: {
        nome: a.nome,
        modalidade: a.modalidade,
        graduacaoFaixa: a.graduacaoFaixa,
        statusPagamento: a.statusPagamento,
        aptoExame: a.aptoExame,
        dataMatricula,
        dataVencimento: diasAPartirDeHoje(a.vencimentoEmDias),
        dataNascimento: nascidoComIdade(a.idade),
        telefone: `(11) 98765-${a.telefoneSufixo}`,
        email: emailDemo(a.nome),
        cidade: a.cidade,
        lesoes: a.lesoes ?? null,
      },
    });
    criados++;
  }

  console.log(
    `Seed demo concluído: ${criados} aluno(s) criado(s), ${ignorados} já existiam (nome duplicado, ignorado).`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
