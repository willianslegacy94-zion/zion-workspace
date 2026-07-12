import { Dumbbell } from "lucide-react";
import { criarPreCadastro } from "./actions";

export default async function MatriculeSePage({
  searchParams,
}: {
  searchParams: Promise<{ sucesso?: string }>;
}) {
  const { sucesso } = await searchParams;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className="mb-8 text-center animate-fade-in">
        <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-full border border-secondary/50 bg-primary/10">
          <Dumbbell size={24} strokeWidth={1.5} className="text-primary" />
        </div>

        <div className="gold-divider mx-auto mb-1 w-48">
          <span className="text-xs uppercase tracking-[0.35em] text-secondary">
            Academia
          </span>
        </div>

        <h1 className="font-serif text-4xl font-black leading-none tracking-widest text-gold-shimmer">
          Prof. Sandro
        </h1>

        <span className="mt-3 inline-block text-[10px] uppercase tracking-[0.3em] text-foreground/40">
          Matricule-se
        </span>
      </div>

      <div className="card-premium w-full max-w-sm animate-slide-up p-8">
        {sucesso ? (
          <div className="text-center">
            <h2 className="mb-2 font-serif text-lg font-bold text-primary">
              Cadastro recebido!
            </h2>
            <p className="text-sm text-foreground/70">
              Em breve entraremos em contato para confirmar sua matrícula.
            </p>
          </div>
        ) : (
          <>
            <h2 className="mb-1 text-center font-serif text-lg font-bold text-primary">
              Faça parte da equipe
            </h2>
            <div className="mb-6 h-px bg-gradient-to-r from-transparent via-secondary/40 to-transparent" />

            <form action={criarPreCadastro} className="flex flex-col gap-4">
              <div>
                <label className="mb-1.5 block text-xs uppercase tracking-wider text-foreground/50">
                  Nome
                </label>
                <input
                  name="nome"
                  required
                  autoFocus
                  className="input-dark w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs uppercase tracking-wider text-foreground/50">
                    Idade
                  </label>
                  <input
                    name="idade"
                    type="number"
                    min="0"
                    max="120"
                    className="input-dark w-full"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs uppercase tracking-wider text-foreground/50">
                    Nascimento
                  </label>
                  <input
                    name="dataNascimento"
                    type="date"
                    className="input-dark w-full"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs uppercase tracking-wider text-foreground/50">
                  Telefone (WhatsApp)
                </label>
                <input
                  name="telefone"
                  required
                  placeholder="Ex: 11987654321"
                  className="input-dark w-full"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs uppercase tracking-wider text-foreground/50">
                  E-mail
                </label>
                <input name="email" type="email" className="input-dark w-full" />
              </div>

              <div>
                <label className="mb-1.5 block text-xs uppercase tracking-wider text-foreground/50">
                  Cidade
                </label>
                <input name="cidade" className="input-dark w-full" />
              </div>

              <div>
                <label className="mb-1.5 block text-xs uppercase tracking-wider text-foreground/50">
                  Lesões (opcional)
                </label>
                <textarea
                  name="lesoes"
                  rows={2}
                  placeholder="Alguma lesão ou restrição que devemos saber?"
                  className="input-dark w-full"
                />
              </div>

              <button type="submit" className="btn-gold mt-2 w-full">
                <span aria-hidden="true">🥋</span>
                Enviar cadastro
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
