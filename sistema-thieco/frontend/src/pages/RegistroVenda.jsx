import { useState, useEffect } from 'react';
import { Scissors, CheckCircle, AlertCircle, Plus } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

const FORMAS_PAGAMENTO = [
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'pix',      label: 'Pix' },
  { value: 'credito',  label: 'Crédito' },
  { value: 'debito',   label: 'Débito' },
  { value: 'cortesia', label: 'Cortesia' },
];

const SERVICOS_RAPIDOS = ['Corte', 'Barba', 'Corte + Barba', 'Sobrancelha', 'Pigmentação', 'Relaxamento'];

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

const FORM_INICIAL = {
  profissional_id: '',
  servico:         '',
  valor:           '',
  forma_pagamento: 'dinheiro',
  data:            hojeISO(),
  observacao:      '',
};

export default function RegistroVenda() {
  const { user } = useAuth();
  const [barbeiros, setBarbeiros] = useState([]);
  const [form,      setForm]      = useState(FORM_INICIAL);
  const [enviando,  setEnviando]  = useState(false);
  const [sucesso,   setSucesso]   = useState(null);
  const [erro,      setErro]      = useState(null);

  useEffect(() => {
    api.profissionais({ apenas_barbeiros: 'true' })
      .then(setBarbeiros)
      .catch(() => {});
  }, []);

  function onChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    setSucesso(null);
    try {
      const payload = {
        profissional_id: form.profissional_id ? parseInt(form.profissional_id) : undefined,
        servico:         form.servico.trim(),
        valor:           parseFloat(form.valor),
        forma_pagamento: form.forma_pagamento,
        data:            form.data,
        ...(form.observacao.trim() ? { observacao: form.observacao.trim() } : {}),
      };
      const resultado = await api.criarVenda(payload);
      setSucesso(resultado);
      // Mantém o barbeiro selecionado para facilitar lançamentos sequenciais
      setForm((f) => ({ ...FORM_INICIAL, profissional_id: f.profissional_id, data: f.data }));
    } catch (err) {
      setErro(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="max-w-md mx-auto px-4 pb-12 pt-6 animate-fade-in">
      {/* Cabeçalho */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gold/10 border border-gold-dark/40 mb-3 shadow-gold-sm">
          <Scissors size={22} className="text-gold" strokeWidth={1.5} />
        </div>
        <h1 className="font-serif font-bold text-xl text-gold">Registro de Venda</h1>
        <p className="text-[11px] text-gold-muted uppercase tracking-widest mt-1">
          Unidade {user?.unidade ?? 'Mutinga'}
        </p>
      </div>

      {/* Feedback de sucesso */}
      {sucesso && (
        <div className="mb-5 p-4 rounded-xl bg-emerald-900/20 border border-emerald-700/40 text-emerald-400">
          <div className="flex items-center gap-2 font-semibold text-sm mb-1">
            <CheckCircle size={15} />
            Venda registrada!
          </div>
          <p className="text-xs text-emerald-300/70">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(sucesso.valor)}
            {' — '}{sucesso.servico}
          </p>
        </div>
      )}

      {/* Feedback de erro */}
      {erro && (
        <div className="mb-5 flex items-center gap-2 p-4 rounded-xl bg-red-900/20 border border-red-700/40 text-red-400 text-sm">
          <AlertCircle size={15} className="shrink-0" />
          {erro}
        </div>
      )}

      {/* Formulário */}
      <form onSubmit={onSubmit} className="card-premium p-5 space-y-4">
        {/* Barbeiro */}
        <div>
          <label className="block text-[11px] text-gold-muted uppercase tracking-wider mb-1.5">
            Barbeiro *
          </label>
          <select
            name="profissional_id"
            value={form.profissional_id}
            onChange={onChange}
            required
            className="input-dark w-full"
          >
            <option value="">Selecione o barbeiro</option>
            {barbeiros.map((b) => (
              <option key={b.id} value={b.id}>{b.nome}</option>
            ))}
          </select>
        </div>

        {/* Serviço */}
        <div>
          <label className="block text-[11px] text-gold-muted uppercase tracking-wider mb-1.5">
            Serviço *
          </label>
          <input
            type="text"
            name="servico"
            value={form.servico}
            onChange={onChange}
            required
            placeholder="Ex.: Corte + Barba"
            list="servicos-list"
            className="input-dark w-full"
          />
          <datalist id="servicos-list">
            {SERVICOS_RAPIDOS.map((s) => <option key={s} value={s} />)}
          </datalist>
        </div>

        {/* Valor + Forma de pagamento */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] text-gold-muted uppercase tracking-wider mb-1.5">
              Valor (R$) *
            </label>
            <input
              type="number"
              name="valor"
              value={form.valor}
              onChange={onChange}
              required
              min="0"
              step="0.01"
              placeholder="0,00"
              className="input-dark w-full"
            />
          </div>
          <div>
            <label className="block text-[11px] text-gold-muted uppercase tracking-wider mb-1.5">
              Pagamento *
            </label>
            <select
              name="forma_pagamento"
              value={form.forma_pagamento}
              onChange={onChange}
              className="input-dark w-full"
            >
              {FORMAS_PAGAMENTO.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Data */}
        <div>
          <label className="block text-[11px] text-gold-muted uppercase tracking-wider mb-1.5">
            Data *
          </label>
          <input
            type="date"
            name="data"
            value={form.data}
            onChange={onChange}
            required
            className="input-dark w-full"
          />
        </div>

        {/* Observação */}
        <div>
          <label className="block text-[11px] text-gold-muted uppercase tracking-wider mb-1.5">
            Observação <span className="normal-case text-gold-muted/50">(opcional)</span>
          </label>
          <input
            type="text"
            name="observacao"
            value={form.observacao}
            onChange={onChange}
            placeholder="Produto, desconto…"
            className="input-dark w-full"
          />
        </div>

        <button
          type="submit"
          disabled={enviando}
          className="btn-gold w-full justify-center py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {enviando ? (
            <span className="w-4 h-4 border-2 border-onix/30 border-t-onix rounded-full animate-spin" />
          ) : (
            <Plus size={15} />
          )}
          {enviando ? 'Registrando…' : 'Registrar Venda'}
        </button>
      </form>
    </main>
  );
}
