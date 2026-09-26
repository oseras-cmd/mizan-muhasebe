import { Button } from "@/components/ui/button";
import { FileSpreadsheet, FileText, Printer, Download } from "lucide-react";
import { useState } from "react";
import { exportExcel, type ExcelSection } from "./calcExport";
import { cn } from "@/lib/utils";

export type { ExcelSection };

interface ExportButtonsProps {
  /** Excel dosya adı (tarih otomatik eklenir) */
  excelName?: string;
  /** Excel bölümleri — hesaplayıcı kendi verisinden üretir */
  excelSections: ExcelSection[];
  excelTitle: string;
  excelSheet: string;
  /** PDF'e aktarılacak DOM alanı (print-area). Verilmezse PDF butonu gizlenir. */
  pdfTargetRef?: React.RefObject<HTMLElement | null>;
  pdfName?: string;
  /** Yazdır butonu görünsün mü (print-area olan sayfalarda anlamlı) */
  showPrint?: boolean;
  className?: string;
  disabled?: boolean;
}

export function ExportButtons({
  excelName,
  excelSections,
  excelTitle,
  excelSheet,
  pdfTargetRef,
  pdfName,
  showPrint = true,
  className,
  disabled = false,
}: ExportButtonsProps) {
  const [pdfBusy, setPdfBusy] = useState(false);

  const handleExcel = () => {
    try {
      exportExcel({
        fileName: excelName ?? "mizan-hesaplama",
        sheetName: excelSheet,
        mainTitle: excelTitle,
        sections: excelSections,
      });
    } catch (e) {
      console.error("Excel export hatası", e);
      alert("Excel dosyası oluşturulamadı.");
    }
  };

  const handlePdf = async () => {
    const el = pdfTargetRef?.current;
    if (!el || pdfBusy) return;
    setPdfBusy(true);
    try {
      const { exportElementToPdf } = await import("./calcExport");
      await exportElementToPdf({ fileName: pdfName ?? "mizan-hesaplama", element: el, title: excelTitle });
    } catch (e) {
      console.error("PDF export hatası", e);
      alert("PDF dosyası oluşturulamadı. Yazdır seçeneğini kullanabilirsiniz.");
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <div className={cn("flex items-center gap-1.5 print-hide", className)} data-print-area-tools>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        disabled={disabled}
        onClick={handleExcel}
        title="Sonuçları Excel (.xlsx) olarak indir"
      >
        <FileSpreadsheet className="size-3.5" />
        Excel
      </Button>
      {pdfTargetRef && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={disabled || pdfBusy}
          onClick={handlePdf}
          title="Sonuçları PDF olarak indir"
        >
          <FileText className="size-3.5" />
          {pdfBusy ? "PDF hazırlanıyor…" : "PDF"}
        </Button>
      )}
      {showPrint && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={disabled}
          onClick={() => window.print()}
          title="Tarayıcı yazdırma"
        >
          <Printer className="size-3.5" />
          Yazdır
        </Button>
      )}
      <span className="hidden" aria-hidden="true"><Download className="size-3" /></span>
    </div>
  );
}
