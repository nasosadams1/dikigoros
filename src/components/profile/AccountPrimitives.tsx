import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const Metric = ({ label, value, helper }: { label: string; value: string; helper: string }) => (
  <div className="rounded-lg border border-border bg-secondary/50 p-3">
    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
    <p className="mt-1 text-xl font-bold text-foreground">{value}</p>
    <p className="mt-1 text-xs font-semibold text-muted-foreground">{helper}</p>
  </div>
);

export const Panel = ({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) => (
  <section className="rounded-lg border border-border bg-card p-4 shadow-lg shadow-foreground/[0.03]">
    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{eyebrow}</p>
    <h2 className="mt-1 font-serif text-xl tracking-tight text-foreground">{title}</h2>
    <div className="mt-4">{children}</div>
  </section>
);

export const EmptyState = ({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) => (
  <div className="rounded-lg border border-dashed border-border bg-secondary/35 px-4 py-6 text-center">
    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-card text-muted-foreground">
      <Icon className="h-5 w-5" />
    </div>
    <p className="mt-3 font-bold text-foreground">{title}</p>
    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
    {action ? <div className="mt-4">{action}</div> : null}
  </div>
);

export const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="block">
    <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
    <span className="mt-2 block">{children}</span>
  </label>
);

export const SettingToggle = ({
  icon: Icon,
  title,
  description,
  enabled,
  onToggle,
  secondary = false,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
  secondary?: boolean;
}) => (
  <button
    type="button"
    onClick={onToggle}
    role="switch"
    aria-checked={enabled}
    className={cn(
      "flex w-full items-start justify-between gap-3 rounded-lg border p-3 text-left transition hover:border-primary/25",
      secondary ? "border-border/70 bg-secondary/25" : "border-border bg-card",
    )}
  >
    <div className="flex gap-3">
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", secondary ? "bg-card text-muted-foreground" : "bg-secondary text-foreground")}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-sm font-bold text-foreground">{title}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
    </div>
    <span className={cn("mt-1 inline-flex h-6 w-11 shrink-0 items-center rounded-full p-1 transition", enabled ? "bg-sage" : "bg-border")}>
      <span className={cn("h-4 w-4 rounded-full bg-white transition", enabled ? "translate-x-5" : "translate-x-0")} />
    </span>
  </button>
);

export const ComparisonLine = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between gap-3">
    <span>{label}</span>
    <span className="font-bold text-foreground">{value}</span>
  </div>
);
