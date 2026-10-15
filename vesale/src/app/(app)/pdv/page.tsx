import { buscarSessaoCaixaAberta, listarFormasPagamento } from "@/server/actions/pdv";
import { AbrirCaixaForm } from "@/components/pdv/AbrirCaixaForm";
import { PdvClient } from "@/components/pdv/PdvClient";

export default async function PdvPage() {
  const sessaoCaixa = await buscarSessaoCaixaAberta();

  if (!sessaoCaixa) {
    return <AbrirCaixaForm />;
  }

  const formasPagamento = await listarFormasPagamento();

  return (
    <PdvClient
      sessaoCaixaId={sessaoCaixa.id}
      valorAbertura={sessaoCaixa.valorAbertura}
      formasPagamento={formasPagamento}
    />
  );
}
