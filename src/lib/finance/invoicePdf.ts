import { jsPDF } from "jspdf";
import type { Contact, Invoice } from "./types";

/**
 * jsPDF standart fontları WinAnsi kodlaması kullandığından Türkçe karakterleri
 * (ğ, ş, ı, İ vb.) doğru çizemez. PDF metinlerinde ASCII karşılıkları kullanılır.
 */
const TR_CHARS: Record<string, string> = {
  ç: "c",
  Ç: "C",
  ğ: "g",
  Ğ: "G",
  ı: "i",
  İ: "I",
  ö: "o",
  Ö: "O",
  ş: "s",
  Ş: "S",
  ü: "u",
  Ü: "U",
};

export function trToAscii(text: string): string {
  return text.replace(/[çÇğĞıİöÖşŞüÜ]/g, (ch) => TR_CHARS[ch] ?? ch);
}

const trNumber = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function money(amount: number): string {
  return `${trNumber.format(amount)} TL`;
}

function formatPdfDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  return trToAscii(
    date.toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
  );
}

const MARGIN = 40;

interface Column {
  label: string;
  x: number;
  w: number;
  align?: "left" | "right" | "center";
}

export function buildInvoicePdf(invoice: Invoice, contact: Contact): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const right = pageWidth - MARGIN;

  /* Üst başlık */
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(20, 20, 20);
  doc.text(trToAscii("DENGE"), MARGIN, 48);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(trToAscii("Mizan — Profesyonel Muhasebe Yazilimi"), MARGIN, 62);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(20, 20, 20);
  doc.text(trToAscii("FATURA"), right, 48, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(`No: ${invoice.invoiceNo}`, right, 62, { align: "right" });
  doc.text(`Tarih: ${formatPdfDate(invoice.date)}`, right, 74, {
    align: "right",
  });

  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.8);
  doc.line(MARGIN, 88, right, 88);

  /* Cari bilgisi */
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(
    trToAscii(contact.type === "tedarikci" ? "TEDARIKCI" : "MUSTERI"),
    MARGIN,
    114,
  );
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text(trToAscii(contact.name), MARGIN, 130);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  let y = 146;
  if (contact.taxNo) {
    doc.text(`Vergi No: ${contact.taxNo}`, MARGIN, y);
    y += 14;
  }
  if (contact.phone) {
    doc.text(`Telefon: ${trToAscii(contact.phone)}`, MARGIN, y);
    y += 14;
  }
  if (contact.email) {
    doc.text(`E-posta: ${trToAscii(contact.email)}`, MARGIN, y);
    y += 14;
  }

  /* Kalem tablosu */
  const columns: Column[] = [
    { label: "Aciklama", x: MARGIN, w: 240, align: "left" },
    { label: "Miktar", x: MARGIN + 240, w: 60, align: "right" },
    { label: "Birim Fiyat", x: MARGIN + 300, w: 80, align: "right" },
    { label: "KDV (%)", x: MARGIN + 380, w: 45, align: "right" },
    { label: "Tutar", x: MARGIN + 425, w: 90, align: "right" },
  ];
  const rowHeight = 24;

  const tableTop = y + 26;
  doc.setFillColor(245, 245, 245);
  doc.rect(MARGIN, tableTop, right - MARGIN, rowHeight, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(80, 80, 80);
  for (const column of columns) {
    doc.text(
      trToAscii(column.label),
      column.x + (column.align === "right" ? column.w : 0),
      tableTop + 15,
      {
        align: column.align ?? "left",
        baseline: "middle",
      },
    );
  }

  let rowY = tableTop + rowHeight;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(40, 40, 40);
  for (const item of invoice.items) {
    const lineTotal = item.quantity * item.unitPrice;
    doc.text(trToAscii(item.description), columns[0].x, rowY + 15, {
      baseline: "middle",
    });
    doc.text(String(item.quantity), columns[1].x + columns[1].w, rowY + 15, {
      align: "right",
      baseline: "middle",
    });
    doc.text(money(item.unitPrice), columns[2].x + columns[2].w, rowY + 15, {
      align: "right",
      baseline: "middle",
    });
    doc.text(`${item.kdvRate}%`, columns[3].x + columns[3].w, rowY + 15, {
      align: "right",
      baseline: "middle",
    });
    doc.text(money(lineTotal), columns[4].x + columns[4].w, rowY + 15, {
      align: "right",
      baseline: "middle",
    });
    doc.setDrawColor(230, 230, 230);
    doc.line(MARGIN, rowY + rowHeight, right, rowY + rowHeight);
    rowY += rowHeight;
  }

  /* Toplamlar */
  const totalsX = right;
  let totalY = rowY + 18;
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  doc.text(trToAscii("Ara Toplam"), totalsX - 130, totalY, { align: "left" });
  doc.text(money(invoice.subtotal), totalsX, totalY, { align: "right" });
  totalY += 16;
  doc.text(trToAscii("KDV Toplami"), totalsX - 130, totalY, { align: "left" });
  doc.text(money(invoice.kdvTotal), totalsX, totalY, { align: "right" });
  totalY += 6;
  doc.setDrawColor(200, 200, 200);
  doc.line(totalsX - 130, totalY, totalsX, totalY);
  totalY += 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text(trToAscii("Genel Toplam"), totalsX - 130, totalY, { align: "left" });
  doc.text(money(invoice.total), totalsX, totalY, { align: "right" });

  /* Alt bilgi */
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(
    trToAscii("Mizan — Profesyonel Muhasebe Yazilimi tarafindan olusturuldu."),
    pageWidth / 2,
    815,
    { align: "center" },
  );

  return doc;
}
