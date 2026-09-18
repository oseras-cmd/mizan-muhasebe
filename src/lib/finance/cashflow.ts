/**
 * Nakit akış projeksiyonu — günlük tahmini kasa grafiği.
 *
 * Başlangıç: mevcut toplam kasa bakiyesi.
 * Giderler : planlı ödemeler (kalan tutar, kendi vadesinde).
 * Gelirler : tekrarlı planlı gelirler + geçmiş 90 günün ortalama günlük geliri.
 * Ayrıca mevcut gün içindeki nakit işlemleri de günün bakiyesine yansıtılır.
 */

import type { FinanceData, RecurringType } from "./types";

const round2 = (v: number): number => Math.round((v + Number.EPSILON) * 100) / 100;

function parseIso(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

function isoOf(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** ISO tarihi günler ileri kaydırır. */
function addDaysIso(iso: string, days: number): string {
  const d = parseIso(iso);
  d.setDate(d.getDate() + days);
  return isoOf(d);
}

/** Tekrarlı bir işlemin verilen tarihte düşüp düşmeyeceğini ve tutarını hesaplar. */
function recurringAmount(type: RecurringType, anchorIso: string, targetIso: string): number {
  switch (type) {
    case "gunluk":
      return 1;
    case "haftalik": {
      const a = parseIso(anchorIso);
      const t = parseIso(targetIso);
      return Math.abs(Math.round((t.getTime() - a.getTime()) / 604_800_000)) % 7 === 0 ? 1 : 0;
    }
    case "aylik": {
      const a = parseIso(anchorIso);
      const t = parseIso(targetIso);
      return a.getDate() === t.getDate() ? 1 : 0;
    }
    case "yillik": {
      const a = parseIso(anchorIso);
      const t = parseIso(targetIso);
      return a.getDate() === t.getDate() && a.getMonth() === t.getMonth() ? 1 : 0;
    }
    default:
      return 0;
  }
}

export interface CashflowPoint {
  /** ISO tarih (yyyy-aa-gg) */
  date: string;
  /** Gün etiketi (gün ay kısa) */
  label: string;
  /** O gün gerçekleşen net değişim */
  net: number;
  /** Gün sonu tahmini kasa bakiyesi */
  balance: number;
  /** O günkü toplam tahmini çıkış */
  outgoing: number;
  /** O günkü toplam tahmini giriş */
  incoming: number;
}

export interface CashflowResult {
  points: CashflowPoint[];
  startingBalance: number;
  /** Projeksiyonun son günündeki bakiye */
  endBalance: number;
  /** Dönemdeki en düşük bakiye */
  minBalance: number;
  /** En düşük bakiyenin tarihi (ISO) */
  minBalanceDate: string | null;
  /** En düşük bakiye negatif mi (nakit açığı uyarısı) */
  hasShortfall: boolean;
  /** Toplam tahmini çıkış (dönem boyunca) */
  totalOutgoing: number;
  /** Toplam tahmini giriş (dönem boyunca) */
  totalIncoming: number;
}

/**
 * Günün günü itibarıyla 30 günlük nakit akış projeksiyonu üretir.
 * Bugün gerçekleşen nakit işlemleri de hesaba katılır.
 */
export function buildCashflowProjection(
  data: FinanceData,
  days = 30,
  now = new Date(),
): CashflowResult {
  const todayIso = isoOf(now);
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Bugün içindeki nakit işlemleri (bugüne kadar girilmiş olanlar)
  let todayIncome = 0;
  let todayExpense = 0;
  for (const tx of data.transactions) {
    if (tx.date !== todayIso) continue;
    if (tx.type === "gelir") todayIncome += tx.amount;
    else todayExpense += tx.amount;
  }

  // Başlangıç: mevcut kasa − bugünün hareketleri (gün başındaki bakiye)
  const currentCash = data.accounts.reduce((sum, a) => sum + a.balance, 0);
  const dayStart = round2(currentCash - todayIncome + todayExpense);

  // Planlı ödemeleri tarihe göre grupla (kalan tutarlar)
  const outflowByDay = new Map<string, number>();
  let totalOutgoing = 0;
  for (const payment of data.upcomingPayments) {
    const remaining = round2(payment.amount - (payment.paidAmount ?? 0));
    if (remaining <= 0) continue;
    const day = payment.dueDate < todayIso ? todayIso : payment.dueDate;
    outflowByDay.set(day, round2((outflowByDay.get(day) ?? 0) + remaining));
    totalOutgoing = round2(totalOutgoing + remaining);
  }

  // Tekrarlı işlemler (aylık kira vb.) — her tekrar tarihinde tekrar uygulanır
  const recurringIncomeByDay = new Map<string, number>();
  for (const tx of data.transactions) {
    if (tx.type !== "gelir") continue;
    if (!tx.description) continue;
    const recurring = (tx as { recurringType?: RecurringType }).recurringType;
    if (!recurring || recurring === "yok") continue;
    // Tekrarlı işlemler tekrar grubuyla işaretlenmez; yalnızca açıkça işaretliyse say
    const marked = (tx as { isRecurringTemplate?: boolean }).isRecurringTemplate;
    if (!marked) continue;
    const anchor = tx.date;
    for (let i = 0; i < days; i++) {
      const dayIso = addDaysIso(todayIso, i);
      if (dayIso < anchor) continue;
      if (recurringAmount(recurring, anchor, dayIso) === 1) {
        recurringIncomeByDay.set(
          dayIso,
          round2((recurringIncomeByDay.get(dayIso) ?? 0) + tx.amount),
        );
      }
    }
  }

  // Ortalama günlük gelir (son 90 gün, bugün hariç)
  const cutoff = addDaysIso(todayIso, -90);
  let windowIncome = 0;
  let windowDays = 0;
  for (const tx of data.transactions) {
    if (tx.type !== "gelir") continue;
    if (tx.date >= cutoff && tx.date < todayIso) windowIncome += tx.amount;
  }
  windowDays = 90;
  const avgDailyIncome = windowIncome > 0 ? windowIncome / windowDays : 0;

  // Seriyi üret
  const points: CashflowPoint[] = [];
  let running = dayStart;
  let minBalance = Number.POSITIVE_INFINITY;
  let minBalanceDate: string | null = null;
  let totalIncoming = 0;

  // Bugün
  const todayIn = round2(todayIncome + (recurringIncomeByDay.get(todayIso) ?? 0) + avgDailyIncome);
  const todayOut = round2(todayExpense + (outflowByDay.get(todayIso) ?? 0));
  running = round2(running + todayIn - todayOut);
  totalIncoming = round2(totalIncoming + todayIn);
  points.push({
    date: todayIso,
    label: `Bugün`,
    net: round2(todayIn - todayOut),
    balance: running,
    outgoing: todayOut,
    incoming: todayIn,
  });
  if (running < minBalance) {
    minBalance = running;
    minBalanceDate = todayIso;
  }

  // Gelecek günler
  const monthFormatter = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short" });
  for (let i = 1; i < days; i++) {
    const dayIso = addDaysIso(todayIso, i);
    const income = round2((recurringIncomeByDay.get(dayIso) ?? 0) + avgDailyIncome);
    const outgoing = round2(outflowByDay.get(dayIso) ?? 0);
    running = round2(running + income - outgoing);
    totalIncoming = round2(totalIncoming + income);
    points.push({
      date: dayIso,
      label: monthFormatter.format(parseIso(dayIso)),
      net: round2(income - outgoing),
      balance: running,
      outgoing,
      incoming: income,
    });
    if (running < minBalance) {
      minBalance = running;
      minBalanceDate = dayIso;
    }
  }

  return {
    points,
    startingBalance: dayStart,
    endBalance: running,
    minBalance: Number.isFinite(minBalance) ? minBalance : running,
    minBalanceDate,
    hasShortfall: minBalance < 0,
    totalOutgoing,
    totalIncoming,
  };
}
