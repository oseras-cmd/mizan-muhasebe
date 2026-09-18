import { AppHeader } from "@/components/AppHeader";
import { FormattedInput } from "@/components/FormattedInput";
import {
  formatDate,
  formatTRY,
  parseTurkishNumber,
  todayIso,
} from "@/lib/finance/format";
import { useFinanceData } from "@/lib/finance/store";
import { accountById } from "@/lib/finance/dashboard";
import { cn } from "@/lib/utils";
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Clock,
  History,
  Info,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";

interface HistoryEntry {
  id: string;
  date: string;
  label: string;
  amount: number;
  currency: "TRY" | "USD" | "EUR";
  accountName: string;
  kind: "odeme" | "gelir";
}

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

function monthLabel(key: string): string {
  const months = [
    "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
  ];
  const [y, m] = key.split("-");
  return `${months[Number(m) - 1] ?? m} ${y}`;
}

export default function OdemeGecmisi() {
  const data = useFinanceData();

  /* Elindeki para hesabı */
  const [cash, setCash] = useState(0);

  /* Filtre: arama + dönem */
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState<"hepsi" | "ay">("hepsi");
  const [month, setMonth] = useState<string>(monthKey(todayIso()));

  /** Ödeme etiketi içeren gider işlemleri (planlı ödemeler + kısmi ödemeler) */
  const history = useMemo<HistoryEntry[]>(() => {
    return data.transactions
      .filter(
        (tx) =>
          tx.type === "gider" &&
          (tx.description.toLowerCase().includes("planlı ödeme") ||
            tx.description.toLowerCase().includes("kısmi ödeme")),
      )
      .map((tx) => {
        // "Planlı ödeme — X" / "Kısmi ödeme — X (…)" etiketini ayıkla
        let label = tx.description;
        const dashIdx = tx.description.indexOf("—");
        if (dashIdx >= 0) label = tx.description.slice(dashIdx + 1).trim();
        const parenIdx = label.indexOf(" (");
        if (parenIdx > 0) label = label.slice(0, parenIdx).trim();
        return {
          id: tx.id,
          date: tx.date,
          label,
          amount: tx.amount,
          currency: "TRY" as const,
          accountName: accountById(data, tx.accountId)?.name ?? "—",
          kind: "odeme" as const,
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  }, [data]);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      history.filter((e) => {
        if (q && !e.label.toLowerCase().includes(q) && !e.accountName.toLowerCase().includes(q)) {
          return false;
        }
        if (period === "ay" && e.date.slice(0, 7) !== month) return false;
        return true;
      }),
    [history, q, period, month],
  );

  /* Gelir işlemleri (kasa girişleri) — aynı dönem filtresiyle */
  const income = useMemo(
    () =>
      data.transactions
        .filter((tx) => tx.type === "gelir")
        .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)),
    [data],
  );

  const availableMonths = useMemo(() => {
    const keys = new Set<string>();
    for (const e of history) keys.add(monthKey(e.date));
    for (const tx of income) keys.add(monthKey(tx.date));
    return [...keys].sort((a, b) => b.localeCompare(a));
  }, [history, income]);

  const filteredIncome = useMemo(
    () =>
      income.filter((tx) => {
        if (q && !tx.description.toLowerCase().includes(q)) return false;
        if (period === "ay" && tx.date.slice(0, 7) !== month) return false;
        return true;
      }),
    [income, q, period, month],
  );

  const totalPaid = filtered.reduce((s, e) => s + e.amount, 0);
  const totalIncome = filteredIncome.reduce((s, tx) => s + tx.amount, 0);
  const netFlow = totalIncome - totalPaid;

  /* Gruplama: ay + gün */
  const grouped = useMemo(() => {
    const map = new Map<string, HistoryEntry[]>();
    for (const entry of filtered) {
      const key = entry.date.slice(0, 7);
      const list = map.get(key) ?? [];
      list.push(entry);
      map.set(key, list);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const cashValue = parseTurkishNumber(String(cash).replace(".", ","));
  const remainingTotal = data.upcomingPayments.reduce(
    (sum, p) => sum + (p.amount - (p.paidAmount ?? 0)),
    0,
  );
  const afterPayments = cashValue - remainingTotal;
  const needMore = afterPayments < 0;

  return (
    <div className="min-h-screen bg-background pl-64 text-foreground">
      <AppHeader />

      <main className="mx-auto max-w-6xl px-6 pb-20 pt-10">
        {/* Sayfa başlığı */}
        <div>
          <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground">
            Modül
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Ödeme Geçmişi
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Yapmış olduğunuz tüm ödemeler burada listelenir — vade tarihleri,
            tutarları ve hangi hesaptan ödendiği ile birlikte.
          </p>
        </div>

        {/* Özet kartları */}
        <div className="mt-8 grid grid-cols-1 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-3">
          <div className="bg-card p-5">
            <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <ArrowDownRight className="size-4 text-rose-500" />
              Toplam Ödenen {period === "ay" ? `(${monthLabel(month)})` : "(tüm dönem)"}
            </p>
            <p className="mt-2.5 font-mono text-[22px] font-medium tabular-nums tracking-tight text-foreground">
              {formatTRY(totalPaid)}
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {filtered.length} ödeme kaydı
            </p>
          </div>
          <div className="bg-card p-5">
            <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <ArrowUpRight className="size-4 text-emerald-600" />
              Toplam Gelir
            </p>
            <p className="mt-2.5 font-mono text-[22px] font-medium tabular-nums tracking-tight text-foreground">
              {formatTRY(totalIncome)}
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {filteredIncome.length} gelir kaydı
            </p>
          </div>
          <div className="bg-card p-5">
            <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Wallet className="size-4" />
              Net Nakit Akışı
            </p>
            <p
              className={cn(
                "mt-2.5 font-mono text-[22px] font-medium tabular-nums tracking-tight",
                netFlow >= 0 ? "text-emerald-600" : "text-rose-600",
              )}
            >
              {netFlow >= 0 ? "+" : "−"}
              {formatTRY(Math.abs(netFlow))}
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">gelir − ödemeler</p>
          </div>
        </div>

        {/* Elindeki para hesabı */}
        <section className="mt-6 rounded-lg border bg-card">
          <header className="border-b border-border/70 px-5 py-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Banknote className="size-4" />
              Elindeki Para ile Hesap
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Elinizdeki parayı yazın — bekleyen ödemeler toplamından düşülüp
              ne kadar paraya ihtiyacınız olduğunu gösterir
            </p>
          </header>
          <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,280px)_1fr]">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="cash-input"
                className="text-xs font-medium text-muted-foreground"
              >
                Elindeki Para (₺)
              </label>
              <FormattedInput
                value={cash}
                onChange={setCash}
                placeholder="0,00"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-border/50 bg-background p-3">
                <p className="text-xs text-muted-foreground">Bekleyen Ödemeler</p>
                <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-orange-600">
                  {formatTRY(remainingTotal)}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {data.upcomingPayments.filter((p) => (p.paidAmount ?? 0) < p.amount).length} kalem
                </p>
              </div>
              <div className="rounded-md border border-border/50 bg-background p-3">
                <p className="text-xs text-muted-foreground">
                  {needMore ? "Eksik Para" : "Ödemeler Sonrası Kalan"}
                </p>
                <p
                  className={cn(
                    "mt-1 font-mono text-sm font-semibold tabular-nums",
                    needMore ? "text-destructive" : "text-emerald-600",
                  )}
                >
                  {formatTRY(Math.abs(afterPayments))}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  elindeki para {needMore ? "−" : "−"} bekleyen ödemeler
                </p>
              </div>
              <div
                className={cn(
                  "rounded-md border p-3",
                  needMore
                    ? "border-destructive/40 bg-destructive/[0.06]"
                    : "border-emerald-500/40 bg-emerald-500/[0.06]",
                )}
              >
                <p className="text-xs font-medium text-muted-foreground">Sonuç</p>
                <p
                  className={cn(
                    "mt-1 font-mono text-sm font-semibold",
                    needMore ? "text-destructive" : "text-emerald-600",
                  )}
                >
                  {needMore
                    ? `${formatTRY(Math.abs(afterPayments))} paraya ihtiyacın var`
                    : "Tüm ödemeleri karşılayabilirsin"}
                </p>
              </div>
            </div>
          </div>
          <p className="flex items-start gap-1.5 border-t border-border/70 px-5 py-3 text-[11px] text-muted-foreground">
            <Info className="mt-0.5 size-3 shrink-0" />
            Hesaplama, ödeme listesindeki henüz tam ödenmemiş tüm kalemleri
            kapsar; kısmi ödenenlerden kalan tutarlar dahildir.
          </p>
        </section>

        {/* Filtre çubuğu */}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ödeme ara (açıklama veya hesap)..."
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 pr-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            />
          </div>
          <div className="grid grid-cols-2 gap-px rounded-md border bg-border p-px">
            <button
              type="button"
              onClick={() => setPeriod("hepsi")}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-[5px] px-3 py-1.5 text-xs font-medium transition-colors",
                period === "hepsi"
                  ? "bg-background text-foreground shadow-sm"
                  : "bg-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              Tümü
            </button>
            <button
              type="button"
              onClick={() => setPeriod("ay")}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-[5px] px-3 py-1.5 text-xs font-medium transition-colors",
                period === "ay"
                  ? "bg-background text-foreground shadow-sm"
                  : "bg-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Clock className="size-3.5" />
              Ay Seç
            </button>
          </div>
          {period === "ay" && (
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring"
            >
              {availableMonths.length === 0 && (
                <option value={month}>{monthLabel(month)}</option>
              )}
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Ödeme geçmişi listesi */}
        {filtered.length === 0 ? (
          <section className="mt-4 rounded-lg border bg-card px-6 py-16 text-center">
            <History className="mx-auto size-6 text-muted-foreground/60" />
            <p className="mt-3 text-sm font-medium text-foreground">
              {q || period === "ay" ? "Bu filtreye uyan ödeme yok" : "Henüz ödeme kaydı yok"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Ödemeler sayfasında bir ödemeyi "Öde" olarak işaretlediğinizde
              burada görünür.
            </p>
          </section>
        ) : (
          grouped.map(([key, entries]) => {
            const monthTotal = entries.reduce((s, e) => s + e.amount, 0);
            return (
              <section
                key={key}
                className="mt-4 overflow-hidden rounded-lg border bg-card"
              >
                <header className="flex items-center justify-between border-b border-border/70 px-5 py-3">
                  <h2 className="text-sm font-semibold text-foreground">
                    {monthLabel(key)}
                  </h2>
                  <span className="font-mono text-sm tabular-nums text-muted-foreground">
                    {formatTRY(monthTotal)}
                  </span>
                </header>
                <ul className="divide-y divide-border/70">
                  {entries.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex items-center justify-between gap-4 px-5 py-3.5"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-background">
                          <span className="font-mono text-xs font-medium tabular-nums text-foreground">
                            {Number(entry.date.slice(8, 10))}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {entry.label}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {formatDate(entry.date)} · {entry.accountName} hesabından
                          </p>
                        </div>
                      </div>
                      <p className="shrink-0 font-mono text-sm tabular-nums text-foreground">
                        −{formatTRY(entry.amount)}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })
        )}

        {/* Gelir (kasa girişleri) */}
        <section className="mt-8 overflow-hidden rounded-lg border bg-card">
          <header className="flex items-center justify-between border-b border-border/70 px-5 py-3">
            <h2 className="text-sm font-semibold text-foreground">
              Gelir (Kasa Girişleri)
            </h2>
            <span className="font-mono text-sm tabular-nums text-muted-foreground">
              {formatTRY(totalIncome)}
            </span>
          </header>
          {filteredIncome.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <p className="text-sm font-medium text-foreground">
                Gelir kaydı yok
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Dashboard veya Gelir/Gider bölümünden gelir ekleyin.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border/70">
              {filteredIncome.slice(0, 50).map((tx) => (
                <li
                  key={tx.id}
                  className="flex items-center justify-between gap-4 px-5 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-background">
                      <ArrowUpRight className="size-3.5 text-emerald-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm text-foreground">
                        {tx.description}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatDate(tx.date)} · {tx.category} ·{" "}
                        {accountById(data, tx.accountId)?.name ?? "—"}
                      </p>
                    </div>
                  </div>
                  <p className="shrink-0 font-mono text-sm tabular-nums text-emerald-600">
                    +{formatTRY(tx.amount)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {filteredIncome.length > 50 && (
            <p className="border-t border-border/70 px-5 py-2 text-[11px] text-muted-foreground">
              İlk 50 gelir gösteriliyor — toplam {filteredIncome.length} kayıt.
            </p>
          )}
        </section>

        <footer className="mt-14 border-t border-border/70 pt-6 text-center text-xs text-muted-foreground">
          Mizan — verileriniz bu tarayıcıda güvenle saklanır ve sayfa
          yenilense de korunur.
        </footer>
      </main>
    </div>
  );
}
