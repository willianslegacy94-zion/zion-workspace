"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, signup } from "@/app/actions";

const inputClass =
  "rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 outline-none focus:border-emerald-500";

export default function AuthForm({
  mode,
  next,
  email,
}: {
  mode: "login" | "signup";
  next: string;
  /** Pré-preenchido (ex.: vindo de um convite). */
  email?: string;
}) {
  const [state, action, pending] = useActionState(mode === "login" ? login : signup, undefined);
  const other = mode === "login" ? "/signup" : "/login";
  const params = new URLSearchParams();
  if (next !== "/") params.set("next", next);
  if (email) params.set("email", email);
  const nextQuery = params.size ? `?${params}` : "";

  return (
    <form action={action} className="mt-8 flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />

      {mode === "signup" && (
        <>
          <label className="text-sm text-slate-300" htmlFor="name">
            Nome (aparece sobre o seu avatar)
          </label>
          <input
            id="name"
            name="name"
            required
            minLength={2}
            maxLength={32}
            autoComplete="name"
            defaultValue={state?.name}
            className={inputClass}
          />
        </>
      )}

      <label className="text-sm text-slate-300" htmlFor="email">
        E-mail
      </label>
      <input
        id="email"
        name="email"
        type="email"
        required
        autoComplete="email"
        defaultValue={state?.email ?? email}
        className={inputClass}
      />

      <label className="text-sm text-slate-300" htmlFor="password">
        Senha
      </label>
      <input
        id="password"
        name="password"
        type="password"
        required
        minLength={mode === "signup" ? 8 : undefined}
        autoComplete={mode === "login" ? "current-password" : "new-password"}
        className={inputClass}
      />

      {state?.error && (
        <p role="alert" className="text-sm text-red-400">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-lg bg-emerald-500 px-3 py-2 font-medium text-black hover:bg-emerald-400 disabled:opacity-50"
      >
        {pending ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar conta"}
      </button>

      <p className="text-center text-sm text-slate-400">
        {mode === "login" ? "Ainda não tem conta? " : "Já tem conta? "}
        <Link href={`${other}${nextQuery}`} className="text-emerald-400 hover:underline">
          {mode === "login" ? "Criar conta" : "Entrar"}
        </Link>
      </p>
    </form>
  );
}
