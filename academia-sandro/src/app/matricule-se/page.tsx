import Image from "next/image";
import { MODALIDADES } from "@/lib/modalidades";
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
        <div className="mb-6 flex flex-col items-center gap-5 sm:gap-6">
          <Image
            src="/logos/sandro-freire-personal.png"
            alt="Sandro Freire Personal"
            width={212}
            height={160}
            preload
            className="h-16 w-auto object-contain drop-shadow-[0_4px_14px_rgba(212,175,55,0.25)] transition-transform duration-300 hover:scale-105 sm:h-20 md:h-24"
          />
          <div className="flex items-center justify-center gap-6 sm:gap-8 md:gap-10">
            <Image
              src="/logos/capoeira-senzala.png"
              alt="Capoeira Senzala"
              width={140}
              height={140}
              preload
              className="h-14 w-auto object-contain drop-shadow-[0_4px_14px_rgba(212,175,55,0.2)] transition-transform duration-300 hover:scale-105 sm:h-16 md:h-20"
            />
            <Image
              src="/logos/matos-fight-team.png"
              alt="Matos Fight Team"
              width={140}
              height={140}
              preload
              className="h-14 w-auto object-contain drop-shadow-[0_4px_14px_rgba(212,175,55,0.2)] transition-transform duration-300 hover:scale-105 sm:h-16 md:h-20"
            />
          </div>
        </div>

        <h1 className="font-serif text-3xl font-black leading-tight tracking-wide text-gold-shimmer sm:text-4xl">
          Centro de Treinamento Sandro Ferreira
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

              <div>
                <label className="mb-1.5 block text-xs uppercase tracking-wider text-foreground/50">
                  Modalidade de interesse
                </label>
                <select
                  name="modalidadeInteresse"
                  defaultValue=""
                  className="input-dark w-full"
                >
                  <option value="">Ainda não sei / quero saber mais</option>
                  {MODALIDADES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
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
