/**
 * CSV dışa aktarma yardımcıları
 * Tüm listeleri CSV formatında dışa aktarır.
 */

import { formatCurrency, formatTRY, todayIso } from "./format";

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function downloadCSV(csv: string, filename: string) {
  const BOM = "\uFEFF"; // UTF-8 BOM for Excel
  const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toCSVRow(values: (string | number)[]): string {
  return values.map((v) => escapeCSV(String(v))).join(",");
}

/* ---- Cariler ---- */
export function exportContactsCSV(
  contacts: { name: string; type: string; taxNo?: string; phone?: string; email?: string }[],
) {
  const header = toCSVRow(["Ad", "Tür", "Vergi No", "Telefon", "E-posta"]);
  const rows = contacts.map((c) =>
    toCSVRow([c.name, c.type === "musteri" ? "Müşteri" : "Tedarikçi", c.taxNo ?? "", c.phone ?? "", c.email ?? ""]),
  );
  downloadCSV([header, ...rows].join("\n"), `mizan-cariler-${todayIso()}.csv`);
}

/* ---- Ödemeler ---- */
export function exportPaymentsCSV(
  payments: { label: string; amount: number; dueDate: string; paidAmount?: number; recurringType?: string }[],
) {
  const header = toCSVRow(["Açıklama", "Tutar", "Vade", "Ödenen", "Kalan", "Tekrarlama"]);
  const rows = payments.map((p) => {
    const paid = p.paidAmount ?? 0;
    const remaining = Math.max(0, p.amount - paid);
    const recurringMap: Record<string, string> = { yok: "Tekrar yok", gunluk: "Her gün", haftalik: "Her hafta", aylik: "Her ay", yillik: "Her yıl" };
    return toCSVRow([p.label, p.amount, p.dueDate, paid, remaining, recurringMap[p.recurringType ?? "yok"] ?? ""]);
  });
  downloadCSV([header, ...rows].join("\n"), `mizan-odemeler-${todayIso()}.csv`);
}

/* ---- Görevler ---- */
export function exportTodosCSV(
  todos: { title: string; priority: number; dueDate?: string; completed: boolean; sectionId?: string }[],
  sections: { id: string; name: string }[],
) {
  const header = toCSVRow(["Başlık", "Öncelik", "Vade", "Durum", "Bölüm"]);
  const sectionMap = new Map(sections.map((s) => [s.id, s.name]));
  const priorityLabels: Record<number, string> = { 1: "Yüksek", 2: "Orta", 3: "Düşük", 4: "Normal" };
  const rows = todos.map((t) =>
    toCSVRow([
      t.title,
      priorityLabels[t.priority] ?? "Normal",
      t.dueDate ?? "",
      t.completed ? "Tamamlandı" : "Devam Ediyor",
      sectionMap.get(t.sectionId ?? "") ?? "",
    ]),
  );
  downloadCSV([header, ...rows].join("\n"), `mizan-gorevler-${todayIso()}.csv`);
}

/* ---- İşlemler ---- */
export function exportTransactionsCSV(
  transactions: {
    type: string;
    description: string;
    category: string;
    amount: number;
    date: string;
    proje?: string;
    accountName?: string;
    company?: string;
  }[],
) {
  const header = toCSVRow(["Tür", "Tarih", "Açıklama", "Kategori", "Proje", "Hesap", "Şirket", "Tutar"]);
  const rows = transactions.map((t) =>
    toCSVRow([
      t.type === "gelir" ? "Gelir" : "Gider",
      t.date,
      t.description,
      t.category,
      t.proje ?? "",
      t.accountName ?? "",
      t.company ?? "",
      formatTRY(t.amount),
    ]),
  );
  downloadCSV([header, ...rows].join("\n"), `mizan-islemler-${todayIso()}.csv`);
}

/* ---- Hesaplar ---- */
export function exportAccountsCSV(
  accounts: { name: string; type: string; balance: number; currency?: string }[],
) {
  const header = toCSVRow(["Hesap Adı", "Tür", "Para Birimi", "Bakiye"]);
  const typeMap: Record<string, string> = { kasa: "Kasa", banka: "Banka", kredi_karti: "Kredi Kartı" };
  const rows = accounts.map((a) => toCSVRow([a.name, typeMap[a.type] ?? a.type, a.currency ?? "TRY", formatCurrency(a.balance, a.currency ?? "TRY")]));
  downloadCSV([header, ...rows].join("\n"), `mizan-hesaplar-${todayIso()}.csv`);
}

/* ---- Tüm Veriler ---- */
export function exportAllDataCSV(
  contacts: { name: string; type: string; taxNo?: string; phone?: string; email?: string }[],
  payments: { label: string; amount: number; dueDate: string; paidAmount?: number; recurringType?: string }[],
  todos: { title: string; priority: number; dueDate?: string; completed: boolean; sectionId?: string }[],
  sections: { id: string; name: string }[],
  transactions: { type: string; description: string; category: string; amount: number; date: string }[],
  accounts: { name: string; type: string; balance: number; currency?: string }[],
) {
  exportContactsCSV(contacts);
  exportPaymentsCSV(payments);
  exportTodosCSV(todos, sections);
  exportTransactionsCSV(transactions);
  exportAccountsCSV(accounts);
}
