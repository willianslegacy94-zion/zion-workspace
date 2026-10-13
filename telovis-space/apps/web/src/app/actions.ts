"use server";

import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession, safeNext } from "@/lib/auth/session";

export type AuthFormState = { error?: string; email?: string; name?: string } | undefined;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

function field(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
}

export async function signup(_: AuthFormState, form: FormData): Promise<AuthFormState> {
  const name = field(form, "name").trim().slice(0, 32);
  const email = field(form, "email").trim().toLowerCase();
  const password = field(form, "password");
  const keep = { name, email };

  if (name.length < 2) return { ...keep, error: "Informe seu nome (mínimo 2 letras)." };
  if (!EMAIL_RE.test(email)) return { ...keep, error: "E-mail inválido." };
  if (password.length < MIN_PASSWORD) {
    return { ...keep, error: `A senha precisa de pelo menos ${MIN_PASSWORD} caracteres.` };
  }

  let userId: string;
  try {
    const user = await prisma.user.create({
      data: { name, email, passwordHash: await hashPassword(password) },
      select: { id: true },
    });
    userId = user.id;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ...keep, error: "Já existe uma conta com este e-mail." };
    }
    throw err;
  }

  await createSession(userId);
  redirect(safeNext(field(form, "next")));
}

export async function login(_: AuthFormState, form: FormData): Promise<AuthFormState> {
  const email = field(form, "email").trim().toLowerCase();
  const password = field(form, "password");

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  });
  // Mesma mensagem e mesmo custo (um scrypt) para e-mail inexistente e senha
  // errada: nem o texto nem o tempo de resposta revelam quem tem conta.
  const ok = user
    ? await verifyPassword(password, user.passwordHash)
    : (await hashPassword(password), false);
  if (!user || !ok) {
    return { email, error: "E-mail ou senha incorretos." };
  }

  await createSession(user.id);
  redirect(safeNext(field(form, "next")));
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/");
}
