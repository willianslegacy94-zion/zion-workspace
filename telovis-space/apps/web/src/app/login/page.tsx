import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { getCurrentUser, safeNext } from "@/lib/auth/session";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeNext((await searchParams).next);
  if (await getCurrentUser()) redirect(next);

  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold">Entrar</h1>
        <p className="mt-2 text-slate-400">TeloVis Space</p>
        <AuthForm mode="login" next={next} />
      </div>
    </main>
  );
}
