import { formatDate, formatWeekRange, formatWeekday } from "./format";
import type {
  Account,
  Contact,
  FinanceData,
  Invoice,
  Transaction,
  TransactionCategory,
  TransactionType,
  Transfer,
  UpcomingPayment,
} from "./types";

function parseIso(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

export function monthKeyOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export interface DaySeriesPoint {
  day: number;
  gelir: number;
  gider: number;
}

/** İçinde bulunulan ayın günlük gelir/gider serisi (bugüne kadar). */
export function buildMonthlySeries(
  data: FinanceData,
  now = new Date(),
): DaySeriesPoint[] {
  const key = monthKeyOf(now);
  const elapsedDays = now.getDate();
  const points: DaySeriesPoint[] = [];
  const byDay = new Map<number, DaySeriesPoint>();
  for (let day = 1; day <= elapsedDays; day += 1) {
    const point: DaySeriesPoint = { day, gelir: 0, gider: 0 };
    points.push(point);
    byDay.set(day, point);
  }
  for (const tx of data.transactions) {
    const date = parseIso(tx.date);
    if (monthKeyOf(date) !== key) continue;
    const point = byDay.get(date.getDate());
    if (!point) continue;
    if (tx.type === "gelir") point.gelir += tx.amount;
    else point.gider += tx.amount;
  }
  return points;
}

export interface MonthTotals {
  income: number;
  expense: number;
}

export function monthTotals(data: FinanceData, now = new Date()): MonthTotals {
  const key = monthKeyOf(now);
  let income = 0;
  let expense = 0;
  for (const tx of data.transactions) {
    if (monthKeyOf(parseIso(tx.date)) !== key) continue;
    if (tx.type === "gelir") income += tx.amount;
    else expense += tx.amount;
  }
  return { income, expense };
}

export function totalCash(data: FinanceData): number {
  return data.accounts.reduce((sum, account) => sum + account.balance, 0);
}

export function recentTransactions(
  data: FinanceData,
  limit = 7,
): Transaction[] {
  return [...data.transactions]
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
    .slice(0, limit);
}

export function upcomingPaymentsSorted(data: FinanceData): UpcomingPayment[] {
  return [...data.upcomingPayments].sort((a, b) =>
    a.dueDate.localeCompare(b.dueDate),
  );
}

export function accountById(
  data: FinanceData,
  id: string,
): Account | undefined {
  return data.accounts.find((account) => account.id === id);
}

export function daysUntil(iso: string): number {
  const today = new Date();
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const target = parseIso(iso);
  return Math.round((target.getTime() - startOfToday.getTime()) / 86_400_000);
}

export function dueLabel(iso: string): string {
  const days = daysUntil(iso);
  if (days < 0) return `${Math.abs(days)} gün gecikti`;
  if (days === 0) return "Bugün";
  if (days === 1) return "Yarın";
  return `${days} gün kaldı`;
}

/** Vadesi geçmiş ödemeler (en eski önce). */
export function overduePayments(data: FinanceData): UpcomingPayment[] {
  return data.upcomingPayments
    .filter((payment) => daysUntil(payment.dueDate) < 0)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export interface PaymentGroup {
  key: string;
  title: string;
  subtitle: string;
  total: number;
  payments: UpcomingPayment[];
}

/** Pazartesi başlayan haftanın ilk gününü (yerel saat) döndürür. */
function startOfWeek(date: Date): Date {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = (day.getDay() + 6) % 7;
  day.setDate(day.getDate() - offset);
  return day;
}

function isoOf(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Ödemeleri tarihe göre gruplar: Bugün / Yarın / hafta günü. */
export function groupPaymentsByDay(
  data: FinanceData,
  now = new Date(),
): PaymentGroup[] {
  const groups = new Map<string, PaymentGroup>();
  for (const payment of upcomingPaymentsSorted(data)) {
    if (daysUntil(payment.dueDate) < 0) continue; // gecikenler ayrı gösterilir
    const existing = groups.get(payment.dueDate);
    if (existing) {
      existing.total += payment.amount;
      existing.payments.push(payment);
      continue;
    }
    const date = parseIso(payment.dueDate);
    const days = daysUntil(payment.dueDate);
    const title =
      days <= 0 ? "Bugün" : days === 1 ? "Yarın" : formatWeekday(date);
    groups.set(payment.dueDate, {
      key: payment.dueDate,
      title,
      subtitle: formatDate(payment.dueDate),
      total: payment.amount,
      payments: [payment],
    });
  }
  return [...groups.values()];
}

export function contactById(
  data: FinanceData,
  id: string,
): Contact | undefined {
  return data.contacts.find((contact) => contact.id === id);
}

export function contactsSorted(data: FinanceData): Contact[] {
  return [...data.contacts].sort((a, b) => a.name.localeCompare(b.name, "tr"));
}

/** Cariye bağlı ÖDENMEMİŞ faturaların toplamı (müşteri için alacak, tedarikçi için borç). */
export function contactBalance(data: FinanceData, contactId: string): number {
  return data.invoices
    .filter((invoice) => invoice.contactId === contactId && !invoice.paid)
    .reduce((sum, invoice) => sum + invoice.total, 0);
}

/** Tüm müşterilerden tahsil edilecek toplam alacak. */
export function totalAlacak(data: FinanceData): number {
  return data.contacts
    .filter((contact) => contact.type === "musteri")
    .reduce((sum, contact) => sum + contactBalance(data, contact.id), 0);
}

/** Tüm tedarikçilere ödenecek toplam borç. */
export function totalBorc(data: FinanceData): number {
  return data.contacts
    .filter((contact) => contact.type === "tedarikci")
    .reduce((sum, contact) => sum + contactBalance(data, contact.id), 0);
}

/** Ödenmemiş faturalar (en yeni önce). */
export function unpaidInvoices(data: FinanceData): Invoice[] {
  return data.invoices
    .filter((invoice) => !invoice.paid)
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || b.invoiceNo.localeCompare(a.invoiceNo),
    );
}

/** Belli bir cariye bağlı faturalar (en yeni önce). */
export function invoicesForContact(
  data: FinanceData,
  contactId: string,
): Invoice[] {
  return data.invoices
    .filter((invoice) => invoice.contactId === contactId)
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || b.invoiceNo.localeCompare(a.invoiceNo),
    );
}

export function invoicesSorted(data: FinanceData): Invoice[] {
  return [...data.invoices].sort(
    (a, b) => b.date.localeCompare(a.date) || b.invoiceNo.localeCompare(a.invoiceNo),
  );
}

export function transfersSorted(data: FinanceData): Transfer[] {
  return [...data.transfers].sort(
    (a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id),
  );
}

export function monthTotalsByKey(
  data: FinanceData,
  key: string,
): MonthTotals {
  let income = 0;
  let expense = 0;
  for (const tx of data.transactions) {
    if (monthKeyOf(parseIso(tx.date)) !== key) continue;
    if (tx.type === "gelir") income += tx.amount;
    else expense += tx.amount;
  }
  return { income, expense };
}

/** Belirli bir ayın tamamının günlük gelir/gider serisi. */
export function monthSeriesByKey(
  data: FinanceData,
  key: string,
): DaySeriesPoint[] {
  const [year, month] = key.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const points: DaySeriesPoint[] = [];
  const byDay = new Map<number, DaySeriesPoint>();
  for (let day = 1; day <= daysInMonth; day += 1) {
    const point: DaySeriesPoint = { day, gelir: 0, gider: 0 };
    points.push(point);
    byDay.set(day, point);
  }
  for (const tx of data.transactions) {
    const date = parseIso(tx.date);
    if (monthKeyOf(date) !== key) continue;
    const point = byDay.get(date.getDate());
    if (!point) continue;
    if (tx.type === "gelir") point.gelir += tx.amount;
    else point.gider += tx.amount;
  }
  return points;
}

export interface CategoryTotal {
  category: TransactionCategory;
  type: TransactionType;
  total: number;
}

/** Belirli bir ayın kategori bazlı gelir/gider toplamları (büyükten küçüğe). */
export function categoryTotalsByKey(
  data: FinanceData,
  key: string,
): CategoryTotal[] {
  const map = new Map<string, CategoryTotal>();
  for (const tx of data.transactions) {
    if (monthKeyOf(parseIso(tx.date)) !== key) continue;
    const existing = map.get(tx.category);
    if (existing) existing.total += tx.amount;
    else
      map.set(tx.category, {
        category: tx.category,
        type: tx.type,
        total: tx.amount,
      });
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

export interface LedgerEntry {
  id: string;
  date: string;
  description: string;
  kind: "gelir" | "gider" | "virman-giris" | "virman-cikis";
  amount: number;
  balanceAfter: number;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Hesabın tüm hareketlerini (işlem + virman) ve satır satır bakiye dökümünü döndürür. */
export function accountLedger(
  data: FinanceData,
  accountId: string,
): { openingBalance: number; entries: LedgerEntry[] } {
  const entries: LedgerEntry[] = [];
  for (const tx of data.transactions) {
    if (tx.accountId !== accountId) continue;
    entries.push({
      id: tx.id,
      date: tx.date,
      description: tx.description,
      kind: tx.type,
      amount: tx.amount,
      balanceAfter: 0,
    });
  }
  for (const transfer of data.transfers) {
    const from = data.accounts.find((a) => a.id === transfer.fromAccountId);
    const to = data.accounts.find((a) => a.id === transfer.toAccountId);
    if (transfer.fromAccountId === accountId) {
      entries.push({
        id: `trf-${transfer.id}`,
        date: transfer.date,
        description: `Virman — ${to?.name ?? "silinen hesap"}`,
        kind: "virman-cikis",
        amount: transfer.amount,
        balanceAfter: 0,
      });
    }
    if (transfer.toAccountId === accountId) {
      entries.push({
        id: `trf-${transfer.id}`,
        date: transfer.date,
        description: `Virman — ${from?.name ?? "silinen hesap"}`,
        kind: "virman-giris",
        amount: transfer.amount,
        balanceAfter: 0,
      });
    }
  }
  entries.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

  const account = data.accounts.find((a) => a.id === accountId);
  const totalDelta = entries.reduce(
    (sum, entry) =>
      sum +
      (entry.kind === "gelir" || entry.kind === "virman-giris"
        ? entry.amount
        : -entry.amount),
    0,
  );
  const openingBalance = round2((account?.balance ?? 0) - totalDelta);
  let running = openingBalance;
  for (const entry of entries) {
    running = round2(
      running +
        (entry.kind === "gelir" || entry.kind === "virman-giris"
          ? entry.amount
          : -entry.amount),
    );
    entry.balanceAfter = running;
  }
  return { openingBalance, entries: entries.reverse() };
}

/** Hesabı kullanan işlem sayısı (silme engeli için). */
export function accountUsageCount(data: FinanceData, id: string): number {
  return (
    data.transactions.filter((tx) => tx.accountId === id).length +
    data.upcomingPayments.filter((payment) => payment.accountId === id).length +
    data.transfers.filter(
      (transfer) =>
        transfer.fromAccountId === id || transfer.toAccountId === id,
    ).length
  );
}

/** Ödemeleri Pazartesi-başlangıçlı haftalara göre gruplar. */
export function groupPaymentsByWeek(
  data: FinanceData,
  now = new Date(),
): PaymentGroup[] {
  const groups = new Map<string, PaymentGroup>();
  const currentWeek = startOfWeek(now);
  for (const payment of upcomingPaymentsSorted(data)) {
    if (daysUntil(payment.dueDate) < 0) continue; // gecikenler ayrı gösterilir
    const date = parseIso(payment.dueDate);
    const weekStart = startOfWeek(date);
    const key = isoOf(weekStart);
    const existing = groups.get(key);
    if (existing) {
      existing.total += payment.amount;
      existing.payments.push(payment);
      continue;
    }
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekIndex = Math.round(
      (weekStart.getTime() - currentWeek.getTime()) / 604_800_000,
    );
    const title =
      weekIndex === 0
        ? "Bu Hafta"
        : weekIndex === 1
          ? "Gelecek Hafta"
          : formatWeekRange(weekStart, weekEnd);
    const subtitle =
      weekIndex === 0 || weekIndex === 1
        ? formatWeekRange(weekStart, weekEnd)
        : `${weekIndex} hafta sonra`;
    groups.set(key, {
      key,
      title,
      subtitle,
      total: payment.amount,
      payments: [payment],
    });
  }
  return [...groups.values()];
}
