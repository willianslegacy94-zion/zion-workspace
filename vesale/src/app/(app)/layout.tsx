import { auth } from "@/auth";
import { AppShell } from "@/components/shared/AppShell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <AppShell userName={session?.user?.name} papel={session?.user?.papel}>
      {children}
    </AppShell>
  );
}
