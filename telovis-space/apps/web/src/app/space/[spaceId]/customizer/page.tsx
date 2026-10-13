import Link from "next/link";
import { requireUser } from "@/lib/auth/session";

// Editor de avatar (spec, seção 4) — ainda não implementado.
export default async function CustomizerPage({
  params,
}: {
  params: Promise<{ spaceId: string }>;
}) {
  const { spaceId } = await params;
  await requireUser(`/space/${spaceId}/customizer`);
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-semibold">Editor de avatar</h1>
      <p className="mt-2 text-slate-400">
        Seleção de sprite, roupas e cores. Pendente de implementação.
      </p>
      <Link href={`/space/${spaceId}`} className="mt-6 inline-block text-emerald-400 underline">
        Voltar ao escritório
      </Link>
    </main>
  );
}
