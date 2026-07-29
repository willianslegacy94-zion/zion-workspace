import Link from "next/link";
import { UserPlus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { rejeitarPreCadastro } from "./actions";

export default async function PreCadastrosPage() {
  const preCadastros = await prisma.preCadastro.findMany({
    where: { status: "Pendente" },
    orderBy: { criadoEm: "desc" },
  });

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-12">
      <PageHeader
        icon={UserPlus}
        title="Pré-cadastros"
        subtitle="Solicitações de matrícula recebidas pelo link público"
      />

      <div className="overflow-x-auto rounded-lg border border-surface-border">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-surface-border text-foreground/60">
            <tr>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">Modalidade</th>
              <th className="px-4 py-3 font-medium">Telefone</th>
              <th className="px-4 py-3 font-medium">Cidade</th>
              <th className="px-4 py-3 font-medium">Recebido em</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {preCadastros.map((pc) => (
              <tr
                key={pc.id}
                className="border-b border-surface-border last:border-0"
              >
                <td className="px-4 py-3">{pc.nome}</td>
                <td className="px-4 py-3">{pc.modalidadeInteresse ?? "—"}</td>
                <td className="px-4 py-3">{pc.telefone}</td>
                <td className="px-4 py-3">{pc.cidade ?? "—"}</td>
                <td className="px-4 py-3">
                  {new Intl.DateTimeFormat("pt-BR").format(pc.criadoEm)}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-3">
                    <Link
                      href={`/alunos/novo?preCadastroId=${pc.id}`}
                      className="text-primary hover:underline"
                    >
                      Aprovar
                    </Link>
                    <form action={rejeitarPreCadastro.bind(null, pc.id)}>
                      <button
                        type="submit"
                        className="text-error hover:underline"
                      >
                        Rejeitar
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {preCadastros.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-6 text-center text-foreground/50"
                >
                  Nenhum pré-cadastro pendente.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
