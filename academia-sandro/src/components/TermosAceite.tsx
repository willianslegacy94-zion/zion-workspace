// Consentimento LGPD coletado no pré-cadastro público — texto padrão
// genérico (não é o texto jurídico final; recomenda-se revisão por um
// advogado antes de tratar como compliance formal).
export function TermosAceite() {
  return (
    <div className="flex flex-col gap-2 text-xs text-foreground/60">
      <details className="rounded-lg border border-foreground/10 p-3">
        <summary className="cursor-pointer text-foreground/70">
          Termos de uso e política de privacidade
        </summary>
        <p className="mt-2 leading-relaxed">
          Ao enviar este formulário, você concorda que o Centro de
          Treinamento Sandro Freire colete e armazene seus dados (nome,
          telefone, e-mail, data de nascimento, cidade e informações de
          saúde/lesões que você opcionalmente informar) com a finalidade
          exclusiva de avaliar sua pré-matrícula, entrar em contato sobre
          modalidades e horários, e organizar sua eventual aula experimental.
          Seus dados não são vendidos nem compartilhados com terceiros para
          fins de marketing. Você pode solicitar a exclusão dos seus dados a
          qualquer momento entrando em contato com a recepção do CT.
        </p>
      </details>
      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          name="termosAceitos"
          required
          className="mt-0.5 h-4 w-4 accent-primary"
        />
        Li e aceito os termos de uso e a política de privacidade acima.
      </label>
    </div>
  );
}
