import { formatInputValue } from "@/lib/finance/format";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Printer } from "lucide-react";
import type { ReactNode } from "react";
import { formatFullDate } from "@/lib/finance/format";

/**
 * Yazdır butonu — hesaplamanın o anki sonucunu .print-area olarak basar.
 * Yönetici raporlarında anlaşılır, kâğıt dostu bir görünüm sağlar.
 */
export function PrintButton({
  className,
  label = "Yazdır",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("print-hide gap-1.5", className)}
      onClick={() => window.print()}
    >
      <Printer className="size-3.5" />
      {label}
    </Button>
  );
}

/**
 * Basılı sayfada en üstte görünen rapor başlığı — ekranda gizli, yazdırmada görünür.
 */
export function PrintHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="screen-hide mb-4 pb-3 border-b border-neutral-300">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-lg font-bold tracking-tight text-neutral-900">{title}</h2>
        <span className="text-xs text-neutral-600 whitespace-nowrap">
          {formatFullDate(new Date())}
        </span>
      </div>
      {subtitle && <p className="mt-1 text-xs text-neutral-600">{subtitle}</p>}
      <p className="mt-1 text-[10px] text-neutral-500">Mizan — Profesyonel Muhasebe Yazılımı</p>
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function CalcCard({
  title,
  subtitle,
  actions,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "print-avoid-break rounded-lg border bg-card",
        className,
      )}
    >
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            {subtitle && (
              <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          {actions}
        </header>
      )}
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

export function ResultBox({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "divide-y divide-border/70 rounded-lg border bg-card",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ResultRow({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-mono text-sm font-medium tabular-nums text-foreground",
          valueClassName,
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function ResultTotalRow({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 bg-muted/40 px-5 py-4">
      <span className="text-sm font-semibold text-foreground">{label}</span>
      <span
        className={cn(
          "font-mono text-lg font-semibold tabular-nums text-foreground",
          valueClassName,
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-px rounded-md border bg-border p-px",
        className,
      )}
      style={{
        gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
      }}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-[5px] py-2 text-sm font-medium transition-colors",
            value === option.value
              ? "bg-background text-foreground shadow-sm"
              : "bg-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function InfoNote({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border-l-2 border-foreground/40 bg-muted/50 px-4 py-3 text-xs leading-5 text-muted-foreground">
      {children}
    </div>
  );
}

/** tr-TR sayı formatı (ör. 1234.5 → "1.234,50"). */
export function formatNumber(
  value: number,
  minFraction = 2,
  maxFraction = 2,
): string {
  return value.toLocaleString("tr-TR", {
    minimumFractionDigits: minFraction,
    maximumFractionDigits: maxFraction,
  });
}
