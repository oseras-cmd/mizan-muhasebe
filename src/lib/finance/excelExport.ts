/**
 * Excel'e aktarım — tüm listeler tek bir XLSX dosyasında sayfa sayfa.
 * (xlsx / SheetJS ile; dosya doğrudan indirilir.)
 */

import * as XLSX from "xlsx";
import type { FinanceData } from "./types";

const MONEY_FMT = "#,##0.00";

function autoCols(rows: Record<string, unknown>[]): XLSX.ColInfo[] {
  if (rows.length === 0) return [];
  return Object.keys(rows[0]).map((key) => {
    const maxLen = rows.reduce(
      (max, row) => Math.max(max, String(row[key] ?? "").length),
      key.length,
    );
    return { wch: Math.min(Math.max(maxLen + 2, 8), 42) };
  });
}

function addSheet(
  wb: XLSX.WorkBook,
  name: string,
  rows: Record<string, string | number | boolean | null>[],
  moneyCols: string[] = [],
) {
  const ws = XLSX.utils.json_to_sheet(rows);
  if (rows.length > 0) {
    // Para kolonlarına sayı biçimi uygula
    const header = Object.keys(rows[0]);
    moneyCols.forEach((col) => {
      const idx = header.indexOf(col);
      if (idx === -1) return;
      const colLetter = XLSX.utils.encode_col(idx);
      const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
      for (let row = range.s.r + 1; row <= range.e.r; row++) {
        const cell = ws[`${colLetter}${row + 1}`];
        if (cell && typeof cell.v === "number") cell.z = MONEY_FMT;
      }
    });
    ws["!cols"] = autoCols(rows);
  }
  XLSX.utils.book_append_sheet(wb, ws, name);
}

/** Tüm veriyi içeren çalışma kitabını oluşturur (indirmeden). */
export function buildFinanceWorkbook(data: FinanceData): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  /* İşlemler */
  addSheet(
    wb,
    "İşlemler",
    data.transactions.map((t) => ({
      Tarih: t.date,
      Tür: t.type === "gelir" ? "Gelir" : "Gider",
      Açıklama: t.description,
      Kategori: t.category,
      Tutar: t.amount,
    })),
    ["Tutar"],
  );

  /* Ödemeler */
  addSheet(
    wb,
    "Ödemeler",
    data.upcomingPayments.map((p) => ({
      Açıklama: p.label,
      Vade: p.dueDate,
      "Para Birimi": p.currency ?? "TRY",
      Tutar: p.amount,
      Ödenen: p.paidAmount ?? 0,
      Kalan: Math.max(0, p.amount - (p.paidAmount ?? 0)),
      Tekrar:
        p.recurringType === "yok" || !p.recurringType
          ? "Tekrar yok"
          : p.recurringType,
    })),
    ["Tutar", "Ödenen", "Kalan"],
  );

  /* Cariler */
  addSheet(
    wb,
    "Cariler",
    data.contacts.map((c) => ({
      Ad: c.name,
      Tür: c.type === "musteri" ? "Müşteri" : "Tedarikçi",
      "Vergi No": c.taxNo ?? "",
      Telefon: c.phone ?? "",
      "E-posta": c.email ?? "",
    })),
  );

  /* Hesaplar */
  addSheet(
    wb,
    "Hesaplar",
    data.accounts.map((a) => ({
      "Hesap Adı": a.name,
      Tür: a.type === "kasa" ? "Kasa" : "Banka",
      "Para Birimi": a.currency ?? "TRY",
      Bakiye: a.balance,
    })),
    ["Bakiye"],
  );

  /* Faturalar */
  addSheet(
    wb,
    "Faturalar",
    data.invoices.map((inv) => ({
      "Fatura No": inv.invoiceNo,
      Tarih: inv.date,
      Matrah: inv.subtotal,
      KDV: inv.kdvTotal,
      Toplam: inv.total,
      Durum: inv.paid ? "Ödendi" : "Bekliyor",
    })),
    ["Matrah", "KDV", "Toplam"],
  );

  /* Görevler */
  addSheet(
    wb,
    "Görevler",
    data.todos.map((t) => ({
      Başlık: t.title,
      Durum: t.completed ? "Tamamlandı" : "Devam Ediyor",
      Vade: t.dueDate ?? "",
      Öncelik: t.priority,
    })),
  );

  /* Virmanlar */
  addSheet(
    wb,
    "Virmanlar",
    data.transfers.map((tr) => {
      const from = data.accounts.find((a) => a.id === tr.fromAccountId);
      const to = data.accounts.find((a) => a.id === tr.toAccountId);
      return {
        Tarih: tr.date,
        Kaynak: from?.name ?? "",
        Hedef: to?.name ?? "",
        Tutar: tr.amount,
        Not: tr.note ?? "",
      };
    }),
    ["Tutar"],
  );

  return wb;
}

/** Çalışma kitabını `mizan-<tarih>.xlsx` olarak indirir. */
export function exportAllExcel(data: FinanceData): string {
  const wb = buildFinanceWorkbook(data);
  const date = new Date().toISOString().slice(0, 10);
  const filename = `mizan-rapor-${date}.xlsx`;
  XLSX.writeFile(wb, filename);
  return filename;
}
