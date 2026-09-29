import { AppHeader } from "@/components/AppHeader";
import { FormattedInput } from "@/components/FormattedInput";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  accountById,
  buildMonthlySeries,

  dueLabel,
  monthTotals,
  overduePayments,
  recentTransactions,


  totalCash,
  upcomingPaymentsSorted,
} from "@/lib/finance/dashboard";
import {
  formatDate,
  formatFullDate,
  formatMonthName,
  formatMonthYear,
  formatTRY,
} from "@/lib/finance/format";
import { addTransaction, useFinanceData } from "@/lib/finance/store";
import { buildCashflowProjection } from "@/lib/finance/cashflow";
import { useTcmbRates, POPULAR_CODES, CURRENCY_SYMBOLS, rateChange, sourceLabel } from "@/lib/finance/tcmbRates";
import { takvimSiradaki, AY_ADLARI } from "@/components/calculators/engine/vergiTakvimi";
import { cn } from "@/lib/utils";
import type { TransactionCategory } from "@/lib/finance/types";
import { companyLabel } from "@/lib/finance/types";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  CalendarClock,
  ChevronRight,
  Globe,
  Minus,
  Plus,
  RefreshCw,
  ReceiptText,
  Scale,
  TrendingDown,
  TrendingUp,

  Wallet,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

const CATEGORY_OPTIONS: TransactionCategory[] = ["Satış", "Hizmet", "Tahsilat", "Maaş", "Kira", "Fatura", "Vergi", "Malzeme", "Ulaşım", "Ödeme", "Diğer"];
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

const chartConfig = {
  gelir: {
    label: "Gelir",
    color: "oklch(0.55 0.13 165)",
  },
  gider: {
    label: "Gider",
    color: "oklch(0.62 0.17 20)",
  },
} satisfies ChartConfig;

interface KpiCardProps {
  label: string;
  value: string;
  caption: string;
  icon: React.ReactNode;
  tone?: "default" | "income" | "expense" | "primary";
}

const kpiWash = {
  default: "from-transparent to-transparent",
  primary: "from-primary/[0.08] via-primary/[0.03] to-transparent",
  income: "from-emerald-500/[0.09] via-emerald-500/[0.03] to-transparent",
  expense: "from-rose-500/[0.09] via-rose-500/[0.03] to-transparent",
};

const kpiValueTone = {
  default: "text-foreground",
  primary: "text-primary",
  income: "text-emerald-700 dark:text-emerald-400",
  expense: "text-rose-700 dark:text-rose-400",
};

function KpiCard({ label, value, caption, icon, tone = "default" }: KpiCardProps) {
  return (
    <div className="relative overflow-hidden bg-card p-5 transition-shadow duration-200 hover:card-shadow-lg">
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-br",
          kpiWash[tone],
        )}
      />
      <div className="relative">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
          <span
            className={cn(
              "flex size-8 items-center justify-center rounded-lg border [&>svg]:size-4",
              tone === "income"
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : tone === "expense"
                  ? "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                  : tone === "primary"
                    ? "border-primary/20 bg-primary/10 text-primary"
                    : "border-border/70 bg-muted/40 text-muted-foreground",
            )}
          >
            {icon}
          </span>
        </div>
        <p
          className={cn(
            "mt-3 font-mono text-[26px] font-bold tabular-nums tracking-tight",
            kpiValueTone[tone],
          )}
        >
          {value}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{caption}</p>
      </div>
    </div>
  );
}

function CashflowSection() {
  const data = useFinanceData();
  const projection = useMemo(() => buildCashflowProjection(data, 30), [data]);
  const chartData = projection.points;
  const min = Math.min(...chartData.map((p) => p.balance), 0);
  const max = Math.max(...chartData.map((p) => p.balance), 1);

  const cashflowConfig = {
    balance: {
      label: "Tahmini Kasa",
      color: "oklch(0.55 0.13 165)",
    },
  } satisfies ChartConfig;

  return (
    <section className="mt-6 rounded-xl border border-border/70 bg-card p-5 card-shadow transition-shadow duration-200 hover:card-shadow-lg sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Nakit Akış Projeksiyonu
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Önümüzdeki 30 gün — planlı ödemeler ve gelir tahminine göre
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="text-muted-foreground">
            Gün sonu:{" "}
            <span className="font-mono font-semibold tabular-nums text-foreground">
              {formatTRY(projection.endBalance)}
            </span>
          </span>
          <span className="text-muted-foreground">
            En düşük:{" "}
            <span
              className={cn(
                "font-mono font-semibold tabular-nums",
                projection.hasShortfall ? "text-destructive" : "text-foreground",
              )}
            >
              {formatTRY(projection.minBalance)}
            </span>
          </span>
        </div>
      </div>

      {projection.hasShortfall && (
        <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/[0.05] px-4 py-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <p className="text-xs text-foreground">
            <strong>Nakit açığı riski:</strong> projeksiyonda kasa
            {projection.minBalanceDate ? ` ${new Date(projection.minBalanceDate).toLocaleDateString("tr-TR")}` : ""} tarihinde{" "}
            <span className="font-mono tabular-nums">{formatTRY(projection.minBalance)}</span>
            seviyesine düşüyor — çıkışları yeniden planlayın.
          </p>
        </div>
      )}

      <ChartContainer config={cashflowConfig} className="mt-5 h-56 w-full">
        <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <defs>
            <linearGradient id="cashflowFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-balance)" stopOpacity={0.25} />
              <stop offset="100%" stopColor="var(--color-balance)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
            interval={4}
            dy={6}
          />
          <YAxis
            hide
            domain={[Math.floor(min * 1.05), Math.ceil(max * 1.05)]}
          />
          <ChartTooltip
            cursor={{ stroke: "var(--muted-foreground)", strokeOpacity: 0.3 }}
            content={
              <ChartTooltipContent
                labelFormatter={(label) => (
                  <span className="font-medium text-foreground">{label}</span>
                )}
                formatter={(value, _name, item) => {
                  const p = item?.payload as { incoming?: number; outgoing?: number } | undefined;
                  return (
                    <div className="w-full space-y-1">
                      <div className="flex items-center justify-between gap-8">
                        <span className="text-muted-foreground">Tahmini Kasa</span>
                        <span className="font-mono tabular-nums text-foreground">
                          {formatTRY(Number(value))}
                        </span>
                      </div>
                      {p && (
                        <div className="flex items-center justify-between gap-8 text-[11px]">
                          <span className="text-muted-foreground">Giriş / Çıkış</span>
                          <span className="font-mono tabular-nums text-muted-foreground">
                            +{formatTRY(p.incoming ?? 0)} / −{formatTRY(p.outgoing ?? 0)}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                }}
              />
            }
          />
          <Area
            type="monotone"
            dataKey="balance"
            stroke="var(--color-balance)"
            strokeWidth={2}
            fill="url(#cashflowFill)"
            dot={false}
          />
        </AreaChart>
      </ChartContainer>
      <p className="mt-3 text-[11px] leading-4 text-muted-foreground">
        Projeksiyon; mevcut kasa bakiyesi, planlı ödemelerin kalan tutarları,
        son 90 günün ortalama günlük geliri ve bugünün işlemlerine dayanır.
      </p>
    </section>
  );
}

const KATEGORI_RENK = {
  KDV: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  Vergi: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  SGK: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  "E-Belge": "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
} as const;

/** Ana sayfa vergi takvimi — sıradaki son tarih + yaklaşan yükümlülükler + yıllık şerit. */
function VergiTakvimiSection() {
  const bugun = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const siradaki = useMemo(() => takvimSiradaki({ periyot: "tumu" }, bugun), [bugun]);
  const liste = siradaki.slice(0, 5);
  const sonraki = liste[0];

  const fmtTarih = (d: Date) => `${String(d.getDate()).padStart(2, "0")} ${AY_ADLARI[d.getMonth()]}`;

  return (
    <section className="mt-6 overflow-hidden rounded-xl border border-border/70 bg-card card-shadow transition-shadow duration-200 hover:card-shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-5 py-4 sm:px-6">
        <div className="flex items-center gap-2">
          <CalendarClock className="size-4 text-muted-foreground" />
          <div>
            <h2 className="text-sm font-semibold text-foreground">Vergi Takvimi</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              2026 beyanname ve bildirim son tarihleri
            </p>
          </div>
        </div>
        <Link
          to="/hesaplayicilar?tab=takvim"
          className="flex items-center gap-0.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Tam Takvim
          <ChevronRight className="size-3.5" />
        </Link>
        </div>

      {siradaki.length === 0 ? (
        <div className="px-5 py-10 text-center sm:px-6">
          <p className="text-sm font-medium text-foreground">Sırada bekleyen yükümlülük yok 🎉</p>
          <p className="mt-1 text-xs text-muted-foreground">
            2026 takvimindeki tüm son tarihler geçti.
          </p>
        </div>
      ) : (
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
          {/* Yaklaşan yükümlülükler */}
          <ul className="divide-y divide-border/70 lg:border-r lg:border-border/70">
            {liste.map((x) => (
              <li
                key={`${x.kayit.ad}-${x.kalanGun}`}
                className={cn(
                  "flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/40 sm:px-6",
                  x.kalanGun === 0 && "bg-amber-50/60 dark:bg-amber-950/20",
                )}
              >
                <div
                  className={cn(
                    "flex size-11 shrink-0 flex-col items-center justify-center rounded-lg border",
                    x.kalanGun <= 3
                      ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40"
                      : "border-border/70 bg-background",
                  )}
                >
                  <span className="font-mono text-base font-bold leading-none tabular-nums text-foreground">
                    {String(x.tarih.getDate()).padStart(2, "0")}
                  </span>
                  <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {AY_ADLARI[x.tarih.getMonth()].slice(0, 3)}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium leading-snug text-foreground">
                    {x.kayit.ad}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {fmtTarih(x.tarih)}{x.kayit.periyot !== "Aylık" ? ` · ${x.kayit.periyot}` : ""}
                  </p>
                </div>
                <span className={cn("hidden shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold sm:inline-block", KATEGORI_RENK[x.kayit.kategori])}>
                  {x.kayit.kategori}
                </span>
                <span
                  className={cn(
                    "w-14 shrink-0 text-right text-xs font-semibold tabular-nums",
                    x.kalanGun === 0
                      ? "text-amber-700 dark:text-amber-400"
                      : x.kalanGun <= 5
                        ? "text-red-600 dark:text-red-400"
                        : "text-muted-foreground",
                  )}
                >
                  {x.kalanGun === 0 ? "Bugün" : x.kalanGun === 1 ? "Yarın" : `${x.kalanGun} gün`}
                </span>
              </li>
            ))}
          </ul>

          {/* Sıradaki son tarih — büyük sayaç kartı */}
          <div className="flex flex-col items-center justify-center gap-3 border-t border-border/70 bg-muted/30 px-6 py-6 lg:border-t-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Sıradaki Son Tarih
            </p>
            {sonraki && (
              <>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-mono text-5xl font-bold tabular-nums tracking-tight text-foreground">
                    {sonraki.kalanGun}
                  </span>
                  <span className="text-sm font-medium text-muted-foreground">gün</span>
                </div>
                <p className="max-w-[240px] text-center text-[13px] font-medium leading-snug text-foreground">
                  {sonraki.kayit.ad}
                </p>
                <p className="text-xs text-muted-foreground">
                  {String(sonraki.tarih.getDate()).padStart(2, "0")} {AY_ADLARI[sonraki.tarih.getMonth()]} {sonraki.tarih.getFullYear()}
                </p>
                <span className={cn("rounded px-2 py-0.5 text-[10px] font-semibold", KATEGORI_RENK[sonraki.kayit.kategori])}>
                  {sonraki.kayit.kategori}
                </span>
              </>
            )}
            <p className="mt-1 text-[10px] leading-4 text-muted-foreground/70">
              Son gün tatile denk gelirse süre ilk iş gününe uzar.
            </p>
          </div>
        </div>
      )}

      {/* Yıllık şerit — her ayın yükümlülük sayısı */}
      <div className="border-t border-border/70 px-5 py-3.5 sm:px-6">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
          2026 Yıllık Görünüm
        </p>
        <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-12">
          {AY_ADLARI.map((m, idx) => {
            const ay = idx + 1;
            const sayi = siradaki.filter((x) => x.tarih.getMonth() + 1 === ay).length;
            const gecmis = ay < bugun.getMonth() + 1;
            return (
              <div
                key={m}
                title={`${m}: ${sayi} yükümlülük`}
                className={cn(
                  "rounded-md border px-1 py-1.5 text-center transition-colors",
                  sayi === 0
                    ? "border-border/50 bg-muted/20"
                    : "border-border/70 bg-background hover:bg-muted/40",
                  gecmis && "opacity-40",
                )}
              >
                <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">{m.slice(0, 3)}</p>
                <p className={cn("font-mono text-sm font-bold tabular-nums", sayi > 0 ? "text-foreground" : "text-muted-foreground/40")}>
                  {sayi}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default function Dashboard() {
  const data = useFinanceData();
  const now = new Date();

  const cash = totalCash(data);
  const totals = monthTotals(data, now);
  const series = buildMonthlySeries(data, now);
  const upcoming = upcomingPaymentsSorted(data);
  const recent = recentTransactions(data);
  const monthName = formatMonthName(now);

  const overdue = overduePayments(data);
  const overdueTotal = overdue.reduce((sum, payment) => sum + payment.amount, 0);

  const { data: tcmbData, prevData: tcmbPrevData, loading: ratesLoading, error: ratesError, lastUpdated, refresh: refreshRates, nextRefreshAt } = useTcmbRates();
  const [showAllRates, setShowAllRates] = useState(false);
  const [countdown, setCountdown] = useState("");
  const [quickType, setQuickType] = useState<"gelir" | "gider">("gider");
  const [quickDesc, setQuickDesc] = useState("");
  const [quickAmount, setQuickAmount] = useState(0);
  const [quickCategory, setQuickCategory] = useState<TransactionCategory>("Diğer");
  const [quickAccount, setQuickAccount] = useState(data.accounts[0]?.id ?? "");
  const [showQuick, setShowQuick] = useState(false);

  const handleQuickTransaction = useCallback(() => {
    if (!quickDesc.trim() || quickAmount <= 0 || !quickAccount) {
      toast.error("Lütfen tüm alanları doldurun.");
      return;
    }
    addTransaction({
      type: quickType,
      description: quickDesc.trim(),
      category: quickCategory,
      accountId: quickAccount,
      amount: quickAmount,
      date: new Date().toISOString().slice(0, 10),
    });
    toast.success(`${quickType === "gelir" ? "Gelir" : "Gider"} kaydedildi — ${formatTRY(quickAmount)}`);
    setQuickDesc("");
    setQuickAmount(0);
    setShowQuick(false);
  }, [quickType, quickDesc, quickAmount, quickCategory, quickAccount]);

  // Geri sayım sayacı
  useEffect(() => {
    if (!nextRefreshAt) return;
    const tick = () => {
      const diff = Math.max(0, nextRefreshAt.getTime() - Date.now());
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setCountdown(mins > 0 ? `${mins}dk ${secs}s` : `${secs}s`);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [nextRefreshAt]);

  const displayRates = tcmbData
    ? showAllRates
      ? tcmbData.rates
      : tcmbData.rates.filter((r) => POPULAR_CODES.includes(r.code))
    : [];



  const kpis = [
    {
      label: "Toplam Kasa",
      value: formatTRY(cash),
      caption: `${data.accounts.length} hesap — kasa ve bankalar`,
      icon: <Wallet className="size-4" />,
      tone: "primary" as const,
    },
    {
      label: "Bu Ay Gelir",
      value: formatTRY(totals.income),
      caption: "Satış ve hizmet gelirleri",
      icon: <ArrowUpRight className="size-4" />,
      tone: "income" as const,
    },
    {
      label: "Bu Ay Gider",
      value: formatTRY(totals.expense),
      caption: "Maaş, kira ve faturalar",
      icon: <ArrowDownRight className="size-4" />,
      tone: "expense" as const,
    },
    {
      label: "Net Bakiye",
      value: formatTRY(totals.income - totals.expense),
      caption:
        totals.income - totals.expense >= 0
          ? "Gelir eksi gider — pozitif bakiye"
          : "Gelir eksi gider — negatif bakiye",
      icon: <Scale className="size-4" />,
      tone: (totals.income - totals.expense >= 0 ? "income" : "expense") as "income" | "expense",
    },
  ];

  return (
    <div className="min-h-screen bg-background pl-64 text-foreground">
      <AppHeader />

      <main className="mx-auto max-w-7xl px-8 pb-20 pt-8">
        {/* Sayfa başlığı */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary">
              {formatMonthYear(now)}
            </p>
            <h1 className="mt-1.5 text-3xl font-bold tracking-tight">
              Genel Bakış
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <p className="hidden text-sm text-muted-foreground sm:block">
              {formatFullDate(now)}
            </p>
            {!showQuick && (
              <Button type="button" size="sm" onClick={() => setShowQuick(true)} className="shadow-sm">
                <Plus className="mr-1 size-3.5" /> Hızlı İşlem
              </Button>
            )}
          </div>
        </div>

        {/* Döviz Kurları — Anlık */}
        <section className="mt-6 rounded-xl border border-border/70 bg-card p-5 card-shadow transition-shadow duration-200 hover:card-shadow-lg sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Globe className="size-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-foreground">
                  Döviz Kurları
                </h2>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {tcmbData?.source === "tcmb" ? "TCMB" : sourceLabel(tcmbData?.source ?? "fallback")} —{" "}
                {tcmbData?.date ?? "..."}
                {tcmbData?.source === "tcmb" && tcmbData.bulletinNo && (
                  <span className="ml-1">· Bülten {tcmbData.bulletinNo}</span>
                )}
                {countdown && (
                  <span className="ml-2 text-muted-foreground/50">
                    · {countdown} sonra güncellenecek
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {lastUpdated && (
                <span className="text-[11px] text-muted-foreground/70">
                  {lastUpdated.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })} güncellendi
                </span>
              )}
              <button
                type="button"
                onClick={refreshRates}
                disabled={ratesLoading}
                className="flex items-center gap-1 rounded-md border border-border/70 px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
              >
                <RefreshCw className={cn("size-3", ratesLoading && "animate-spin")} />
                Yenile
              </button>
            </div>
          </div>

          {ratesLoading && !tcmbData ? (
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="animate-pulse rounded-lg border border-border/50 bg-muted/30 p-4">
                  <div className="h-3 w-12 rounded bg-muted" />
                  <div className="mt-2 h-5 w-20 rounded bg-muted" />
                  <div className="mt-1 h-3 w-16 rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* Kompakt yatay kur şeridi */}
              <div className="mt-4 flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:thin]">
                {displayRates.map((rate) => {
                  const prevRate = tcmbPrevData?.rates.find((r) => r.code === rate.code);
                  const change = rateChange(rate.forexSelling, prevRate?.forexSelling);
                  const up = change.direction === "up";
                  return (
                    <div
                      key={rate.code}
                      title={rate.unit > 1 ? `${rate.unit} birim` : `Alış ${formatTRY(rate.forexBuying)}`}
                      className="flex shrink-0 items-center gap-3 rounded-full border border-border/60 bg-muted/30 py-2 pl-3.5 pr-4 transition-colors hover:bg-muted/50"
                    >
                      <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                        {rate.code}
                      </span>
                      <span className="font-mono text-sm font-semibold tabular-nums tracking-tight text-foreground">
                        {formatTRY(rate.forexSelling)}
                      </span>
                      {change.direction === "same" ? (
                        <Minus className="size-3 text-muted-foreground/40" />
                      ) : (
                        <span
                          className={cn(
                            "flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-semibold tabular-nums",
                            up ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/10 text-rose-600 dark:text-rose-400",
                          )}
                        >
                          {up ? <ArrowUp className="size-2.5" /> : <ArrowDown className="size-2.5" />}
                          {Math.abs(change.delta).toFixed(2)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              {tcmbData && tcmbData.rates.length > POPULAR_CODES.length && (
                <button
                  type="button"
                  onClick={() => setShowAllRates((s) => !s)}
                  className="mt-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showAllRates ? "Daha az göster" : `Tüm kurları gör (${tcmbData.rates.length})`}
                </button>
              )}
            </>
          )}

          {ratesError && (
            <p className="mt-2 text-xs text-muted-foreground">
              {ratesError}
            </p>
          )}
          {tcmbData?.source === "tcmb" && (
            <p className="mt-2 text-[11px] text-muted-foreground/60">
              Kaynak: TCMB resmî günlük kur listesi — muhasebe kayıtlarında esas alınabilecek
              resmî değerlerdir.
            </p>
          )}
          {tcmbData && tcmbData.source !== "tcmb" && (
            <p className="mt-2 text-[11px] text-muted-foreground/60">
              Resmî kur gerektiren hesaplamalarda TCMB günlük bültenini esas alın.
            </p>
          )}
        </section>

        {/* Vergi takvimi — sıradaki son tarihler */}
        <VergiTakvimiSection />

        {/* Geciken ödeme uyarısı */}
        {overdue.length > 0 && (
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/[0.05] px-5 py-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {overdue.length} ödemenin vadesi geçti
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Toplam{" "}
                  <span className="font-mono tabular-nums">
                    {formatTRY(overdueTotal)}
                  </span>{" "}
                  — ödemeleri tamamlamayı unutmayın
                </p>
              </div>
            </div>
            <Link
              to="/odemeler"
              className="flex items-center gap-0.5 text-xs font-medium text-destructive transition-opacity hover:opacity-80"
            >
              İncele
              <ChevronRight className="size-3.5" />
            </Link>
          </div>
        )}

        {/* KPI kartları */}
        <div className="mt-8 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-border/70 bg-border card-shadow sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((kpi) => (
            <KpiCard key={kpi.label} {...kpi} />
          ))}
        </div>

        {/* Hızlı İşlem + Bütçe Özeti */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* Hızlı İşlem */}
          <section className="rounded-xl border border-border/70 bg-card p-5 card-shadow transition-shadow duration-200 hover:card-shadow-lg sm:p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="size-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-foreground">Hızlı İşlem</h2>
              </div>
            </div>
            {showQuick ? (
              <div className="mt-4 grid gap-3">
                <div className="flex gap-1 rounded-md border border-border/70 p-0.5">
                  {(["gider", "gelir"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={cn("flex-1 rounded-sm px-3 py-1.5 text-xs font-medium transition-colors", quickType === t ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted")}
                      onClick={() => setQuickType(t)}
                    >
                      {t === "gelir" ? "Gelir" : "Gider"}
                    </button>
                  ))}
                </div>
                <input type="text" placeholder="Açıklama" className="rounded-md border border-border/70 bg-background px-3 py-2 text-sm" value={quickDesc} onChange={(e) => setQuickDesc(e.target.value)} />
                <FormattedInput placeholder="0,00" value={quickAmount} onChange={setQuickAmount} />
                <select className="rounded-md border border-border/70 bg-background px-3 py-2 text-sm" value={quickCategory} onChange={(e) => setQuickCategory(e.target.value as TransactionCategory)}>
                  {CATEGORY_OPTIONS.map((c) => (<option key={c} value={c}>{c}</option>))}
                </select>
                <select className="rounded-md border border-border/70 bg-background px-3 py-2 text-sm" value={quickAccount} onChange={(e) => setQuickAccount(e.target.value)}>
                  {data.accounts.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
                </select>
                <div className="flex gap-2">
                  <Button type="button" variant="default" size="sm" className="flex-1" onClick={handleQuickTransaction}>Kaydet</Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowQuick(false)}>İptal</Button>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">Tek tıkla gelir veya gider ekleyin</p>
            )}
          </section>

          {/* Bütçe Özeti */}
          <section className="rounded-xl border border-border/70 bg-card p-5 card-shadow transition-shadow duration-200 hover:card-shadow-lg sm:p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Scale className="size-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-foreground">Bütçe Özeti</h2>
              </div>
              <Link to="/rapor" className="flex items-center gap-0.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
                Detay <ChevronRight className="size-3.5" />
              </Link>
            </div>
            <div className="mt-4 grid gap-3">
              {(() => {
                const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
                const targets = data.budgetTargets.filter((bt) => bt.month === month);
                if (targets.length === 0) return <p className="text-xs text-muted-foreground">Bu ay için bütçe hedefi tanımlanmamış</p>;
                return targets.map((bt) => {
                  const actual = data.transactions
                    .filter((tx) => tx.category === bt.category && tx.type === bt.type && tx.date.startsWith(month))
                    .reduce((sum, tx) => sum + tx.amount, 0);
                  const pct = bt.targetAmount > 0 ? Math.min(100, Math.round((actual / bt.targetAmount) * 100)) : 0;
                  const isOver = actual > bt.targetAmount;
                  return (
                    <div key={bt.id}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-foreground">{bt.category}</span>
                        <span className={cn("font-mono tabular-nums", isOver ? "text-destructive" : "text-muted-foreground")}>
                          {formatTRY(actual)} / {formatTRY(bt.targetAmount)}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className={cn("h-full rounded-full transition-all", isOver ? "bg-destructive" : "bg-foreground")} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </section>
        </div>

        {/* Gelir / Gider grafiği */}
        <section className="mt-6 rounded-xl border border-border/70 bg-card p-5 card-shadow transition-shadow duration-200 hover:card-shadow-lg sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Bu Ayki Gelir / Gider
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatMonthYear(now)} — günlük toplamlar
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-[2px] bg-emerald-500" />
                Gelir
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-[2px] bg-rose-500" />
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
                radius={[4, 4, 0, 0]}
                maxBarSize={12}
              />
              <Bar
                dataKey="gider"
                fill="var(--color-gider)"
                radius={[4, 4, 0, 0]}
                maxBarSize={12}
              />
            </BarChart>
          </ChartContainer>
        </section>

        {/* Nakit akış projeksiyonu */}
        <CashflowSection />

        {/* Yaklaşan ödemeler + son işlemler */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-border/70 bg-card card-shadow transition-shadow duration-200 hover:card-shadow-lg">
            <header className="flex items-center justify-between gap-4 border-b border-border/70 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Yaklaşan Ödemeler
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Önümüzdeki 30 gün içindeki ödemeler
                </p>
              </div>
              <Link
                to="/odemeler"
                className="flex items-center gap-0.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Tümünü Gör
                <ChevronRight className="size-3.5" />
              </Link>
            </header>
            <ul className="divide-y divide-border/70">
              {upcoming.map((payment) => {
                const account = payment.accountId ? accountById(data, payment.accountId) : undefined;
                return (
                  <li
                    key={payment.id}
                    className="flex items-center justify-between gap-4 px-5 py-4"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-background">
                        <span className="font-mono text-xs font-medium tabular-nums text-foreground">
                          {Number(payment.dueDate.slice(8, 10))}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {payment.label}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {formatDate(payment.dueDate)}
                          {payment.company ? ` · ${companyLabel(payment.company)}` : account ? ` · ${account.name}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-mono text-sm tabular-nums text-foreground">
                        {formatTRY(payment.amount)}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {dueLabel(payment.dueDate)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="rounded-xl border border-border/70 bg-card card-shadow transition-shadow duration-200 hover:card-shadow-lg">
            <header className="flex items-center justify-between gap-4 border-b border-border/70 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Son İşlemler
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  En son kaydedilen hareketler
                </p>
              </div>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ReceiptText className="size-3.5" />
                {recent.length} hareket
              </span>
            </header>
            <ul className="divide-y divide-border/70">
              {recent.map((tx) => {
                const account = tx.accountId ? accountById(data, tx.accountId) : undefined;
                const isIncome = tx.type === "gelir";
                return (
                  <li
                    key={tx.id}
                    className="flex items-center justify-between gap-4 px-5 py-4"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border",
                          isIncome
                            ? "border-foreground/15 bg-foreground/[0.04]"
                            : "border-border bg-background",
                        )}
                      >
                        {isIncome ? (
                          <ArrowUpRight className="size-4 text-foreground" />
                        ) : (
                          <ArrowDownRight className="size-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {tx.description}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {tx.category}
                          {tx.company ? ` · ${companyLabel(tx.company)}` : account ? ` · ${account.name}` : ""} ·{" "}
                          {formatDate(tx.date)}
                        </p>
                      </div>
                    </div>
                    <p
                      className={cn(
                        "shrink-0 font-mono text-sm font-medium tabular-nums",
                        isIncome ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400",
                      )}
                    >
                      {isIncome ? "+" : "−"}
                      {formatTRY(tx.amount)}
                    </p>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        <footer className="mt-14 border-t border-border/70 pt-6 text-center text-xs text-muted-foreground">
          Mizan — verileriniz bu tarayıcıda güvenle saklanır ve sayfa
          yenilense de korunur.
        </footer>
      </main>
    </div>
  );
}
