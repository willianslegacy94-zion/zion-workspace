import type { LucideIcon } from "lucide-react";

export function PageHeader({
  icon: Icon,
  title,
  subtitle,
  action,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-surface-border pb-6">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-secondary/30 bg-primary/10">
          <Icon size={22} className="text-primary" />
        </div>
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-0.5 text-sm text-foreground/50">{subtitle}</p>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}
