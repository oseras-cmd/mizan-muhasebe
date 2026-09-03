const currencyFormatter = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dayMonthFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
});

const fullDateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const monthYearFormatter = new Intl.DateTimeFormat("tr-TR", {
  month: "long",
  year: "numeric",
});

const monthFormatter = new Intl.DateTimeFormat("tr-TR", { month: "long" });

const weekdayFormatter = new Intl.DateTimeFormat("tr-TR", { weekday: "long" });

function parseIso(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const eurFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatters: Record<string, Intl.NumberFormat> = {
  TRY: currencyFormatter,
  USD: usdFormatter,
  EUR: eurFormatter,
};

export function formatTRY(amount: number): string {
  return currencyFormatter.format(amount);
}

export function formatUSD(amount: number): string {
  return usdFormatter.format(amount);
}

export function formatCurrency(amount: number, currency: string): string {
  return (formatters[currency] ?? currencyFormatter).format(amount);
}

export function formatDate(iso: string): string {
  return dayMonthFormatter.format(parseIso(iso));
}

export function formatFullDate(date: Date): string {
  return fullDateFormatter.format(date);
}

export function formatMonthYear(date: Date): string {
  return monthYearFormatter.format(date);
}

export function formatMonthName(date: Date): string {
  return monthFormatter.format(date);
}

export function formatWeekday(date: Date): string {
  return weekdayFormatter.format(date);
}

/** Pazartesi başlayan hafta aralığını "11 – 17 Ağustos" biçiminde döndürür. */
export function formatWeekRange(start: Date, end: Date): string {
  if (
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth()
  ) {
    return `${start.getDate()} – ${end.getDate()} ${monthFormatter.format(start)}`;
  }
  return `${dayMonthFormatter.format(start)} – ${dayMonthFormatter.format(end)}`;
}

export function todayIso(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Türkçe sayı girişini (örn. "1.234,56") sayıya çevirir; geçersizse NaN döner. */
export function parseTurkishNumber(raw: string): number {
  const normalized = raw.trim().replace(/\./g, "").replace(",", ".");
  return Number(normalized);
}

/** 
 * Ham sayıyı Türk formatında göster (100.000,00)
 * Input alanları için kullanılır
 */
export function formatInputValue(value: string): string {
  if (!value) return "";
  // Mevcut nokta/virgüllü girdiyi normalize et
  const raw = value.replace(/[^\d,]/g, "");
  if (!raw) return "";
  // Virgül varsa ondalık bölümü ayır
  const parts = raw.split(",");
  const intPart = parts[0] ?? "";
  const decPart = parts[1];
  // Binlik ayraçları ekle (nokta ile)
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return decPart !== undefined ? `${formatted},${decPart}` : formatted;
}

/** Input değerinden sayısal değeri çıkar */
export function parseInputValue(formatted: string): number {
  const cleaned = formatted.replace(/[^\d,]/g, "").replace(",", ".");
  if (!cleaned) return 0;
  return Number(cleaned);
}
