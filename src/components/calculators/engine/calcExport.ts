/**
 * Hesaplayıcı çıktı dışa aktarma — Excel (xlsx) ve PDF (snapdom + jsPDF).
 * Her hesaplayıcı "Excel" ve "PDF" butonlarıyla bu yardımcıları kullanır.
 */
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import { snapdom } from "@zumer/snapdom";
import { todayIso } from "@/lib/finance/format";

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export interface ExcelSection {
  /** Bölüm başlığı (sayfa içinde koyu satır). */
  title?: string;
  /** Tablo başlıkları. */
  headers?: string[];
  /** Satır hücreleri (string | number | null). */
  rows: (string | number | null)[][];
  /** Toplam/bilgi satırları (tablo altı). */
  footers?: string[];
  /** Bölüm altı notlar. */
  notes?: string[];
}

/**
 * Çok bölümlü tek sayfalık Excel dosyası üretir.
 * Tutar satırları sayı olarak yazılır (Excel'de hesaplanabilir).
 */
export function exportExcel(opts: {
  fileName: string;
  sheetName: string;
  mainTitle: string;
  sections: ExcelSection[];
}) {
  const wb = XLSX.utils.book_new();
  const aoa: (string | number | null)[][] = [];
  aoa.push([opts.mainTitle]);
  aoa.push([`Mizan — Profesyonel Muhasebe Yazılımı · ${todayIso()}`]);
  aoa.push([]);
  for (const s of opts.sections) {
    if (s.title) {
      aoa.push([s.title]);
    }
    if (s.headers) {
      aoa.push(s.headers);
    }
    for (const r of s.rows) aoa.push(r);
    if (s.footers) for (const f of s.footers) aoa.push([f]);
    if (s.notes) {
      aoa.push([]);
      for (const n of s.notes) aoa.push([n]);
    }
    aoa.push([]);
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 44 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ws, opts.sheetName.slice(0, 30));
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  downloadBlob(
    new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `${opts.fileName}-${todayIso()}.xlsx`,
  );
}

/**
 * DOM elementini snapdom ile yakalayıp A4 PDF'e aktarır; uzun içerik çok sayfaya bölünür.
 */
export async function exportElementToPdf(opts: {
  fileName: string;
  element: HTMLElement;
  title: string;
}) {
  const canvas = await snapdom.toCanvas(opts.element, { scale: 2 });
  const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
  const pageW = 210;
  const pageH = 297;
  const margin = 10;
  const contentW = pageW - margin * 2;

  // Başlık sayfası üstüne
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.setTextColor(20, 20, 20);
  pdf.text(opts.title, margin, margin + 2);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(110, 110, 110);
  pdf.text(`Mizan — Profesyonel Muhasebe Yazılımı · ${todayIso()}`, margin, margin + 7);

  const topOffset = margin + 11; // görselin başladığı y
  const availH = pageH - topOffset - margin;

  const imgWmm = contentW;
  const imgHmmFull = (canvas.height / canvas.width) * imgWmm;

  if (imgHmmFull <= availH) {
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", margin, topOffset, imgWmm, imgHmmFull);
  } else {
    // Sayfalara böl
    const pxPerMm = canvas.width / imgWmm;
    const sliceHpx = Math.floor(availH * pxPerMm);
    let y = 0;
    let first = true;
    while (y < canvas.height) {
      const h = Math.min(sliceHpx, canvas.height - y);
      const tmp = document.createElement("canvas");
      tmp.width = canvas.width;
      tmp.height = h;
      const ctx = tmp.getContext("2d");
      if (!ctx) break;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, tmp.width, tmp.height);
      ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
      if (!first) pdf.addPage();
      pdf.addImage(tmp.toDataURL("image/jpeg", 0.92), "JPEG", margin, first ? topOffset : margin, imgWmm, (h / canvas.width) * imgWmm);
      first = false;
      y += h;
    }
  }
  pdf.save(`${opts.fileName}-${todayIso()}.pdf`);
}

/** CSV indirme (tablo içe aktarma/çıktılarında kullanılır). */
export function exportCsv(csv: string, fileName: string) {
  const BOM = "\uFEFF";
  downloadBlob(new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" }), `${fileName}-${todayIso()}.csv`);
}
