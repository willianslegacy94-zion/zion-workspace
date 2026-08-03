import Link from "next/link";
import { notFound } from "next/navigation";
import { UserPlus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { rejeitarPreCadastro } from "../actions";

function Campo({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wider text-foreground/50">
        {label}
      </span>
      <span className="text-sm text-foreground">{valor}</span>
    </div>
  );
}

export default async function FichaPreCadastroPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const preCadastro = await prisma.preCadastro.findUnique({ where: { id } });

  if (!preCadastro) {
    notFound();
  }

  const rejeitarComId = rejeitarPreCadastro.bind(null, preCadastro.id);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12">
      <PageHeader
        icon={UserPlus}
        title="Ficha do pré-cadastro"
        subtitle="Todas as informações enviadas pelo link público de pré-matrícula"
      />

      <div className="grid grid-cols-1 gap-4 rounded-lg border border-foreground/10 p-6 sm:grid-cols-2">
        <Campo label="Nome" valor={preCadastro.nome} />
        <Campo label="Telefone (WhatsApp)" valor={preCadastro.telefone} />
        <Campo label="E-mail" valor={preCadastro.email ?? "—"} />
        <Campo
          label="Idade"
          valor={preCadastro.idade != null ? String(preCadastro.idade) : "—"}
        />
        <Campo
          label="Data de nascimento"
          valor={
            preCadastro.dataNascimento
              ? new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
                  preCadastro.dataNascimento,
                )
              : "—"
          }
        />
        <Campo label="Cidade" valor={preCadastro.cidade ?? "—"} />
        <Campo
          label="Modalidade de interesse"
          valor={preCadastro.modalidadeInteresse ?? "Ainda não sabe"}
        />
        <Campo
          label="Aula experimental"
          valor={
            preCadastro.dataAulaExperimental
              ? new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
                  preCadastro.dataAulaExperimental,
                )
              : "Não agendou"
          }
        />
        <Campo
          label="Termos aceitos"
          valor={
            preCadastro.termosAceitos && preCadastro.termosAceitosEm
              ? `Sim, em ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(preCadastro.termosAceitosEm)}`
              : "Não"
          }
        />
        <Campo
          label="Recebido em"
          valor={new Intl.DateTimeFormat("pt-BR").format(preCadastro.criadoEm)}
        />
        <Campo label="Status" valor={preCadastro.status} />
        <div className="sm:col-span-2">
          <Campo label="Lesões" valor={preCadastro.lesoes ?? "Nenhuma informada"} />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href={`/alunos/novo?preCadastroId=${preCadastro.id}`}
          className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-secondary"
        >
          Aprovar e completar cadastro
        </Link>
        <form action={rejeitarComId}>
          <button
            type="submit"
            className="rounded-md border border-error/30 px-5 py-2 text-sm font-medium text-error transition-colors hover:bg-error/10"
          >
            Rejeitar
          </button>
        </form>
        <Link
          href="/pre-cadastros"
          className="rounded-md border border-foreground/20 px-5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-foreground/5"
        >
          Voltar
        </Link>
      </div>
    </div>
  );
}
