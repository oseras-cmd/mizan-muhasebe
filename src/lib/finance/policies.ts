import { useSyncExternalStore } from "react";

export type PolicyType = "Binek Araç" | "Ticari Araç" | "İşyeri Poliçesi";

export interface SavedPolicy {
  id: number;
  type: string;
  account: string;
  number: string;
  date: string;
  amount: number;
  savedAt: string;
}

export interface PolicyMonthRow {
  year: number;
  monthIndex: number;
  monthName: string;
  days: number;
  amount: number;
  quarter: number;
  periodLabel: string;
  accountCode: string;
}

export interface PolicySchedule {
  rows: PolicyMonthRow[];
  kkegAmount: number;
  totals: Record<string, number>;
}

const MONTH_NAMES = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

/**
 * Yıllık poliçe tutarını aylara ve muhasebe hesaplarına dağıtır:
 * ilk ay seçilen gider hesabına (770/730/740/760), yıl içi 180'e,
 * yıl dönümünde (Ocak) 280'e yazılır. Binek araçta %30 K.K.E.G. (689) ayrılır.
 *
 * Gün bazlı dağılımda ilk ay başlangıç gününden ay sonuna, aradaki aylar
 * takvim ayının tamamına karşılık gelir; son ay 365 güne tamamlanır
 * (takvim ayını aşmaz).
 */
export function computePolicySchedule(input: {
  type: string;
  account: string;
  startDate: string;
  amount: number;
}): PolicySchedule {
  const start = new Date(`${input.startDate}T00:00:00`);
  const startYear = start.getFullYear();
  const startMonth = start.getMonth();
  const startDay = start.getDate();

  const isBinek = input.type === "Binek Araç";
  const kkegAmount = isBinek ? input.amount * 0.3 : 0;
  const baseAmount = input.amount - kkegAmount;
  const dailyAmount = baseAmount / 365;

  const rows: PolicyMonthRow[] = [];
  const totals: Record<string, number> = {
    [input.account]: 0,
    180: 0,
    280: 0,
    kkeg: kkegAmount,
  };

  // 12 ay boyunca gün bazlı dağılım hesaplama
  for (let i = 0; i < 12; i++) {
    const current = new Date(startYear, startMonth + i, 1);
    const year = current.getFullYear();
    const month = current.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // İlk ay için poliçenin başladığı günden ay sonuna kadar olan gün sayısını al
    let days: number;
    if (i === 0) {
      days = daysInMonth - startDay + 1;
    } else if (i === 11) {
      // Son ay, ilk ayın eksik kalan günlerini tamamlar (365 güne tamamlama)
      const previousTotalDays = rows.reduce((acc, r) => acc + r.days, 0);
      days = Math.min(daysInMonth, 365 - previousTotalDays);
      if (days < 0) days = 0;
    } else {
      days = daysInMonth;
    }

    const amount = dailyAmount * days;
    const quarter = Math.floor(month / 3) + 1;

    let accountCode: string;
    if (i === 0) accountCode = input.account;
    else if (year > startYear && month === 0) accountCode = "280";
    else accountCode = "180";

    totals[accountCode] = (totals[accountCode] ?? 0) + amount;

    rows.push({
      year,
      monthIndex: month,
      monthName: MONTH_NAMES[month],
      days,
      amount,
      quarter,
      periodLabel: `${year} / ${quarter}. Dönem`,
      accountCode,
    });
  }

  return { rows, kkegAmount, totals };
}

/* ------------------------- Kayıtlı poliçeler (localStorage) ------------------------- */

const STORAGE_KEY = "denge-saved-policies-v1";

function loadPolicies(): SavedPolicy[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is SavedPolicy =>
        typeof p === "object" &&
        p !== null &&
        typeof (p as SavedPolicy).number === "string" &&
        typeof (p as SavedPolicy).amount === "number",
    );
  } catch {
    return [];
  }
}

let policies: SavedPolicy[] = loadPolicies();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit() {
  for (const listener of listeners) listener();
}

function persist() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(policies));
  } catch {
    // Depolama dolu ya da erişilemezse sessizce devam et.
  }
}

export function getSavedPolicies(): SavedPolicy[] {
  return policies;
}

export function useSavedPolicies(): SavedPolicy[] {
  return useSyncExternalStore(subscribe, getSavedPolicies);
}

export function savePolicy(input: {
  type: string;
  account: string;
  number: string;
  date: string;
  amount: number;
}): SavedPolicy {
  const policy: SavedPolicy = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    type: input.type,
    account: input.account,
    number: input.number.trim(),
    date: input.date,
    amount: input.amount,
    savedAt: new Date().toLocaleString("tr-TR"),
  };
  policies = [policy, ...policies];
  persist();
  emit();
  return policy;
}

export function deleteSavedPolicy(id: number) {
  policies = policies.filter((p) => p.id !== id);
  persist();
  emit();
}
