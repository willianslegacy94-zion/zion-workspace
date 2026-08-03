"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { calcularVencimento } from "@/lib/vencimento";
import { gerarUsernameUnico, criarUsuarioAluno } from "@/lib/acesso-portal";
import { matricularAlunoEmAula, MatriculaError } from "@/lib/matricula";

async function origemAtual() {
  const hdrs = await headers();
  return `${hdrs.get("x-forwarded-proto") ?? "http"}://${hdrs.get("host")}`;
}

function campoOpcional(formData: FormData, nome: string) {
  const valor = String(formData.get(nome) ?? "").trim();
  return valor || null;
}

function erro(mensagem: string): never {
  redirect("/cadastro-aluno?erro=" + encodeURIComponent(mensagem));
}

export async function criarAlunoAutocadastro(formData: FormData) {
  const nome = String(formData.get("nome") ?? "").trim();
  const telefone = String(formData.get("telefone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  // Uma linha por modalidade (a primeira é a principal); os 3 campos são
  // repetidos na mesma ordem pelo SeletorModalidadesMultiplas.
  const modalidades = formData.getAll("modalidade").map((v) => String(v).trim());
  const agendaAulaIds = formData.getAll("agendaAulaId").map((v) => String(v).trim());
  const faixas = formData.getAll("graduacaoFaixa").map((v) => String(v).trim());

  const [modalidadePrincipal, ...modalidadesExtras] = modalidades;
  const agendaAulaReferenciaId = agendaAulaIds[0] || null;
  const graduacaoFaixaPrincipal = faixas[0] || "A definir";

  if (!nome || !modalidadePrincipal || !telefone || !email) {
    erro("Preencha nome, telefone, e-mail e modalidade.");
  }
  if (!agendaAulaReferenciaId) {
    erro("Escolha um horário pra sua modalidade principal.");
  }

  const extras = modalidadesExtras.map((modalidade, i) => ({
    modalidade,
    agendaAulaId: agendaAulaIds[i + 1] || "",
    graduacaoFaixa: faixas[i + 1] || "A definir",
  }));

  if (extras.some((e) => !e.agendaAulaId)) {
    erro("Escolha um horário pra cada modalidade extra adicionada.");
  }

  const pacoteComboId = campoOpcional(formData, "pacoteComboId");
  const dataMatricula = new Date();

  let alunoId: string;
  try {
    alunoId = await prisma.$transaction(async (tx) => {
      const aluno = await tx.aluno.create({
        data: {
          nome,
          modalidade: modalidadePrincipal,
          graduacaoFaixa: graduacaoFaixaPrincipal,
          statusPagamento: "Pendente",
          dataMatricula,
          dataVencimento: calcularVencimento(dataMatricula),
          telefone,
          email,
          cidade: campoOpcional(formData, "cidade"),
          lesoes: campoOpcional(formData, "lesoes"),
          dataNascimento: (() => {
            const valor = String(formData.get("dataNascimento") ?? "").trim();
            return valor ? new Date(valor) : null;
          })(),
          agendaAulaReferenciaId,
        },
      });

      for (const extra of extras) {
        await matricularAlunoEmAula(aluno.id, extra.agendaAulaId, undefined, tx);
        await tx.alunoFaixaModalidade.create({
          data: {
            alunoId: aluno.id,
            modalidade: extra.modalidade,
            graduacaoFaixa: extra.graduacaoFaixa,
          },
        });
      }

      // Combo escolhido pelo próprio aluno (catálogo sem membro ainda) —
      // vincula com o desconto padrão definido pelo admin na criação do pacote.
      if (pacoteComboId && extras.length > 0) {
        const pacote = await tx.pacote.findUnique({
          where: { id: pacoteComboId, tipo: "COMBO_MODALIDADES" },
        });
        if (pacote) {
          await tx.pacoteMembro.create({
            data: {
              alunoId: aluno.id,
              pacoteId: pacote.id,
              descontoPercentual: pacote.descontoPadrao ?? 0,
              titular: true,
            },
          });
        }
      }

      return aluno.id;
    });
  } catch (error) {
    if (error instanceof MatriculaError) {
      erro(error.message);
    }
    throw error;
  }

  revalidatePath("/alunos");

  try {
    const username = await gerarUsernameUnico(nome);
    const link = await criarUsuarioAluno({
      alunoId,
      username,
      email,
      origin: await origemAtual(),
    });
    redirect(
      `/cadastro-aluno?sucesso=1&acessoLink=${encodeURIComponent(link)}`,
    );
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      erro(
        "Esse e-mail já está em uso no portal. Se você já tem acesso, use 'Esqueci minha senha'. Se não, fale com a recepção.",
      );
    }
    throw error;
  }
}
