import { AlertCircle } from 'lucide-react';
import FilterBar from '../components/FilterBar';
import GraficoProjecao from '../components/GraficoProjecao';
import BreakEvenCard from '../components/BreakEvenCard';
import TicketMedioCard from '../components/TicketMedioCard';
import { useInteligencia } from '../hooks/useInteligencia';

export default function IntelFinanceira() {
  const { dados, loading, erro, filtros, setFiltros, recarregar } = useInteligencia();

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 pb-12 animate-fade-in">
      <FilterBar filtros={filtros} onChange={setFiltros} onRecarregar={recarregar} loading={loading} />

      {erro && (
        <div className="flex items-center gap-3 p-4 mb-6 rounded-xl bg-red-900/20 border border-red-800/50 text-red-400 text-sm">
          <AlertCircle size={16} className="shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      {/* Projeção de faturamento */}
      <section className="mb-6">
        <GraficoProjecao dados={dados?.projecao ?? []} loading={loading} />
      </section>

      {/* Break-even + Ticket médio */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BreakEvenCard breakEven={dados?.break_even} loading={loading} />
        <TicketMedioCard barbeiros={dados?.ticket_medio_barbeiros ?? []} loading={loading} />
      </section>
    </main>
  );
}
