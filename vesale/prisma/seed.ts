import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Usuários — gestor e operador de caixa (RN-001).
  const gestorEmail = (process.env.GESTOR_EMAIL ?? "gestor@vesale.local").toLowerCase();
  const gestorSenha = process.env.GESTOR_SENHA ?? "troque-esta-senha";
  await prisma.usuario.upsert({
    where: { email: gestorEmail },
    update: {},
    create: {
      nome: process.env.GESTOR_NOME ?? "Gestor Vesale",
      email: gestorEmail,
      senhaHash: await bcrypt.hash(gestorSenha, 12),
      papel: "GESTOR",
    },
  });

  const operadorEmail = (process.env.OPERADOR_EMAIL ?? "operador@vesale.local").toLowerCase();
  const operadorSenha = process.env.OPERADOR_SENHA ?? "troque-esta-senha";
  await prisma.usuario.upsert({
    where: { email: operadorEmail },
    update: {},
    create: {
      nome: process.env.OPERADOR_NOME ?? "Operador Balcão",
      email: operadorEmail,
      senhaHash: await bcrypt.hash(operadorSenha, 12),
      papel: "OPERADOR_CAIXA",
    },
  });

  // Categorias de produto.
  const categorias = ["Medicamento Genérico", "Medicamento Referência", "Perfumaria", "Outros"];
  const categoriaIds: Record<string, string> = {};
  for (const nome of categorias) {
    const categoria = await prisma.categoriaProduto.upsert({
      where: { nome },
      update: {},
      create: { nome },
    });
    categoriaIds[nome] = categoria.id;
  }

  // Formas de pagamento (com taxa aproximada de maquininha, editável depois).
  const formasPagamento: Array<{ nome: string; taxaPercentual: number | null }> = [
    { nome: "Dinheiro", taxaPercentual: null },
    { nome: "PIX", taxaPercentual: 0 },
    { nome: "Cartão de Débito", taxaPercentual: 1.5 },
    { nome: "Cartão de Crédito", taxaPercentual: 3.5 },
  ];
  for (const forma of formasPagamento) {
    await prisma.formaPagamento.upsert({
      where: { nome: forma.nome },
      update: {},
      create: forma,
    });
  }

  // Produtos de exemplo — dados fictícios só para validar o fluxo do PDV.
  // Nenhum destes é catálogo real da cliente (ver pendência em
  // registro-de-decisoes-vesale.md: catálogo real ainda não foi fornecido).
  const produtos = [
    {
      nome: "Dipirona 500mg 10cp",
      codigoBarras: "7891234500011",
      categoria: "Medicamento Genérico",
      custoTravado: 4.2,
      precoVenda: 8.9,
      quantidadeEstoque: 50,
      estoqueMinimo: 10,
    },
    {
      nome: "Paracetamol 750mg 20cp",
      codigoBarras: "7891234500028",
      categoria: "Medicamento Genérico",
      custoTravado: 6.1,
      precoVenda: 12.5,
      quantidadeEstoque: 40,
      estoqueMinimo: 10,
    },
    {
      nome: "Losartana 50mg 30cp",
      codigoBarras: "7891234500035",
      categoria: "Medicamento Referência",
      custoTravado: 9.8,
      precoVenda: 18.9,
      quantidadeEstoque: 30,
      estoqueMinimo: 8,
    },
    {
      // Fixture de medicamento controlado (RN-013/RN-014) — exige confirmação
      // de receita na venda e lote+validade na conciliação de nota fiscal.
      nome: "Clonazepam 2mg 30cp",
      codigoBarras: "7891234500080",
      categoria: "Medicamento Referência",
      custoTravado: 11.4,
      precoVenda: 22.9,
      quantidadeEstoque: 12,
      estoqueMinimo: 5,
      medicamentoControlado: true,
    },
    {
      nome: "Protetor Solar FPS 60 120ml",
      codigoBarras: "7891234500042",
      categoria: "Perfumaria",
      custoTravado: 32.0,
      precoVenda: 59.9,
      quantidadeEstoque: 15,
      estoqueMinimo: 5,
    },
    {
      nome: "Sabonete Líquido 250ml",
      codigoBarras: "7891234500059",
      categoria: "Perfumaria",
      custoTravado: 7.5,
      precoVenda: 14.9,
      quantidadeEstoque: 25,
      estoqueMinimo: 5,
    },
    {
      nome: "Álcool em Gel 70% 500ml",
      codigoBarras: "7891234500066",
      categoria: "Outros",
      custoTravado: 8.0,
      // Preço propositalmente abaixo do custo — exemplo vivo do alerta de
      // margem negativa (RF-021) assim que a tela de Precificação existir.
      precoVenda: 7.5,
      quantidadeEstoque: 20,
      estoqueMinimo: 5,
    },
    {
      nome: "Máscara Descartável (cx 50un)",
      codigoBarras: "7891234500073",
      categoria: "Outros",
      custoTravado: null,
      precoVenda: null,
      quantidadeEstoque: 0,
      estoqueMinimo: 5,
    },
  ];

  const produtoIds: Record<string, string> = {};
  for (const produto of produtos) {
    const registro = await prisma.produto.upsert({
      where: { codigoBarras: produto.codigoBarras },
      update: {},
      create: {
        nome: produto.nome,
        codigoBarras: produto.codigoBarras,
        categoriaId: categoriaIds[produto.categoria],
        custoTravado: produto.custoTravado ?? undefined,
        precoVenda: produto.precoVenda ?? undefined,
        quantidadeEstoque: produto.quantidadeEstoque,
        estoqueMinimo: produto.estoqueMinimo,
        medicamentoControlado: "medicamentoControlado" in produto ? produto.medicamentoControlado : false,
      },
    });
    produtoIds[produto.codigoBarras] = registro.id;
  }

  // Lote de exemplo do medicamento controlado — só pra a tela de Estoque não
  // nascer sem nenhum alerta de validade pra mostrar.
  const clonazepamId = produtoIds["7891234500080"];
  if (clonazepamId) {
    const validade = new Date();
    validade.setDate(validade.getDate() + 45);
    await prisma.loteProduto.upsert({
      where: { produtoId_numeroLote: { produtoId: clonazepamId, numeroLote: "L2409A" } },
      update: {},
      create: {
        produtoId: clonazepamId,
        numeroLote: "L2409A",
        validade,
        quantidade: 12,
      },
    });
  }

  // Categorias financeiras (RF-026 — natureza fixa/variável do DRE simplificado).
  const categoriasFinanceiras: Array<{ nome: string; natureza: "FIXA" | "VARIAVEL" }> = [
    { nome: "Aluguel", natureza: "FIXA" },
    { nome: "Energia", natureza: "FIXA" },
    { nome: "Fornecedores", natureza: "VARIAVEL" },
  ];
  const categoriaFinanceiraIds: Record<string, string> = {};
  for (const categoria of categoriasFinanceiras) {
    // CategoriaFinanceira não tem @unique em nome — checa antes de criar
    // pra reseed não duplicar.
    const existente = await prisma.categoriaFinanceira.findFirst({ where: { nome: categoria.nome } });
    const registro = existente ?? (await prisma.categoriaFinanceira.create({ data: categoria }));
    categoriaFinanceiraIds[categoria.nome] = registro.id;
  }

  // Contas de exemplo — só para a tela de Financeiro não nascer vazia.
  const contaAluguelExiste = await prisma.contaFinanceira.findFirst({
    where: { descricao: "Aluguel do ponto — mês corrente" },
  });
  if (!contaAluguelExiste) {
    const vencimento = new Date();
    vencimento.setDate(10);
    vencimento.setMonth(vencimento.getMonth() + 1);
    await prisma.contaFinanceira.create({
      data: {
        tipo: "PAGAR",
        categoriaId: categoriaFinanceiraIds["Aluguel"],
        descricao: "Aluguel do ponto — mês corrente",
        valor: 3200,
        vencimento,
      },
    });
  }

  console.log("Seed concluído.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
