import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  categoryTotalsByKey,
  monthSeriesByKey,
  monthTotalsByKey,
} from "@/lib/finance/dashboard";
import {
  formatMonthName,
  formatMonthYear,
  formatTRY,
} from "@/lib/finance/format";
import { useFinanceData } from "@/lib/finance/store";
import { cn } from "@/lib/utils";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Scale,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

function monthKeyOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

const chartConfig = {
  gelir: {
    label: "Gelir",
    theme: { light: "oklch(0.145 0 0)", dark: "oklch(0.985 0 0)" },
  },
  gider: {
    label: "Gider",
    theme: { light: "oklch(0.556 0 0)", dark: "oklch(0.556 0 0)" },
  },
} satisfies ChartConfig;

export default function Rapor() {
  const data = useFinanceData();
  const now = new Date();
  const currentKey = monthKeyOf(now);

  const [offset, setOffset] = useState(0);
  const month = new Date(now.getFullYear(), now.getMonth() - offset, 1);
  const key = monthKeyOf(month);
  const atCurrent = offset === 0;

  const totals = monthTotalsByKey(data, key);
  const series = monthSeriesByKey(data, key);
  const categories = categoryTotalsByKey(data, key);

  const net = totals.income - totals.expense;
  const margin = totals.income > 0 ? (net / totals.income) * 100 : 0;
  const monthName = formatMonthName(month);

  const gelirCategories = categories.filter((c) => c.type === "gelir");
  const giderCategories = categories.filter((c) => c.type === "gider");
  const maxGelir = Math.max(...gelirCategories.map((c) => c.total), 0);
  const maxGider = Math.max(...giderCategories.map((c) => c.total), 0);

  return (
    <div className="min-h-screen bg-background pl-64 text-foreground">
      <AppHeader />

      <main className="mx-auto max-w-6xl px-6 pb-20 pt-10">
        {/* Sayfa başlığı */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground">
              Rapor
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              Kâr / Zarar
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Kaydedilmiş gelir ve gider işlemlerine göre
          </p>
        </div>

        {/* Ay seçici */}
        <div className="mt-8 flex items-center justify-between gap-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={atCurrent}
            onClick={() => setOffset((prev) => Math.min(prev + 1, 120))}
          >
            <ArrowLeft className="size-3.5" />
            Önceki
          </Button>
          <div className="text-center">
            <p className="text-sm font-semibold text-foreground">
              {formatMonthYear(month)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {atCurrent ? "İçinde bulunulan ay" : `${offset} ay önce`}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={atCurrent}
            onClick={() => setOffset((prev) => Math.max(prev - 1, 0))}
          >
            Sonraki
            <ArrowRight className="size-3.5" />
          </Button>
        </div>

        {/* KPI kartları */}
        <div className="mt-6 grid grid-cols-1 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-3">
          <div className="bg-card p-5">
            <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <ArrowUpRight className="size-4" />
              Gelir
            </p>
            <p className="mt-2.5 font-mono text-[22px] font-medium tabular-nums tracking-tight text-foreground">
              {formatTRY(totals.income)}
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {monthName} ayı gelirleri
            </p>
          </div>
          <div className="bg-card p-5">
            <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <ArrowDownRight className="size-4" />
              Gider
            </p>
            <p className="mt-2.5 font-mono text-[22px] font-medium tabular-nums tracking-tight text-foreground">
              {formatTRY(totals.expense)}
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {monthName} ayı giderleri
            </p>
          </div>
          <div className="bg-card p-5">
            <p
              className={cn(
                "flex items-center gap-2 text-xs font-medium",
                net >= 0 ? "text-muted-foreground" : "text-destructive",
              )}
            >
              <Scale className="size-4" />
              Net {net >= 0 ? "Kâr" : "Zarar"}
            </p>
            <p
              className={cn(
                "mt-2.5 font-mono text-[22px] font-medium tabular-nums tracking-tight",
                net >= 0 ? "text-foreground" : "text-destructive",
              )}
            >
              {formatTRY(Math.abs(net))}
            </p>
            <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
              {net >= 0 ? (
                <TrendingUp className="size-3.5" />
              ) : (
                <TrendingDown className="size-3.5" />
              )}
              {Number.isFinite(margin) ? `%${margin.toFixed(1)} marj` : "marj yok"}
            </p>
          </div>
        </div>

        {/* Günlük grafik */}
        <section className="mt-6 rounded-lg border bg-card p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Günlük Gelir / Gider
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatMonthYear(month)} — tüm günler
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-[1px] bg-foreground" />
                Gelir
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-[1px] bg-muted-foreground" />
                Gider
              </span>
            </div>
          </div>
          <ChartContainer config={chartConfig} className="mt-6 h-64 w-full">
            <BarChart data={series} barGap={2}>
              <CartesianGrid
                vertical={false}
                strokeDasharray="3 3"
                stroke="var(--border)"
              />
              <XAxis
                dataKey="day"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                dy={6}
              />
              <YAxis hide />
              <ChartTooltip
                cursor={{ fill: "var(--muted)", opacity: 0.45 }}
                content={
                  <ChartTooltipContent
                    labelFormatter={(label) => (
                      <span className="font-medium text-foreground">
                        {label} {monthName}
                      </span>
                    )}
                    formatter={(value, name) => (
                      <div className="flex w-full items-center justify-between gap-8">
                        <span className="text-muted-foreground">
                          {name === "gelir" ? "Gelir" : "Gider"}
                        </span>
                        <span className="font-mono tabular-nums text-foreground">
                          {formatTRY(Number(value))}
                        </span>
                      </div>
                    )}
                  />
                }
              />
              <Bar
                dataKey="gelir"
                fill="var(--color-gelir)"
                radius={[2, 2, 0, 0]}
                maxBarSize={10}
              />
              <Bar
                dataKey="gider"
                fill="var(--color-gider)"
                radius={[2, 2, 0, 0]}
                maxBarSize={10}
              />
            </BarChart>
          </ChartContainer>
        </section>

        {/* Kategori dökümü */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-lg border bg-card">
            <header className="border-b border-border/70 px-5 py-4">
              <h2 className="text-sm font-semibold text-foreground">
                Gelir Kategorileri
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {monthName} — en yüksekten en düşüğe
              </p>
            </header>
            {gelirCategories.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                Bu ay gelir kaydı yok.
              </p>
            ) : (
              <ul className="divide-y divide-border/70">
                {gelirCategories.map((category) => (
                  <li key={category.category} className="px-5 py-3.5">
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-sm font-medium text-foreground">
                        {category.category}
                      </p>
                      <p className="font-mono text-sm tabular-nums text-foreground">
                        {formatTRY(category.total)}
                      </p>
                    </div>
                    <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-foreground"
                        style={{
                          width: `${(category.total / maxGelir) * 100}%`,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-lg border bg-card">
            <header className="border-b border-border/70 px-5 py-4">
              <h2 className="text-sm font-semibold text-foreground">
                Gider Kategorileri
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {monthName} — en yüksekten en düşüğe
              </p>
            </header>
            {giderCategories.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                Bu ay gider kaydı yok.
              </p>
            ) : (
              <ul className="divide-y divide-border/70">
                {giderCategories.map((category) => (
                  <li key={category.category} className="px-5 py-3.5">
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-sm font-medium text-foreground">
                        {category.category}
                      </p>
                      <p className="font-mono text-sm tabular-nums text-muted-foreground">
                        {formatTRY(category.total)}
                      </p>
                    </div>
                    <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-muted-foreground"
                        style={{
                          width: `${(category.total / maxGider) * 100}%`,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <footer className="mt-14 border-t border-border/70 pt-6 text-center text-xs text-muted-foreground">
          Mizan — rapor, kaydedilmiş gelir/gider hareketlerine dayanır;
          faturalar ödendiğinde tahsilat/ödeme kaydı olarak bu rapora yansır.
        </footer>
      </main>
    </div>
  );
}
