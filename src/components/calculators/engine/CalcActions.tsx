/**
 * Hesaplama aksiyon çubuğu — her hesaplayıcıda "Kaydet" ve
 * "Kayıtlar" seçeneklerini Excel/PDF/Yazdır dışa aktarımının önüne ekler.
 *
 * Kaydet: o anki girdi + sonuç tablosunu tarayıcı deposuna kaydeder.
 * Kayıtlar: kayıtları listeler, Excel'e aktarır ve siler.
 */
import { useState } from "react";
import { FolderOpen, Save, Trash2, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { exportExcel, type ExcelSection } from "./calcExport";
import { ExportButtons, type ExportButtonsProps } from "./ExportButtons";
import {
  deleteCalculation,
  listSavedCalculations,
  saveCalculation,
  clearCalculations,
  type SavedCalculation,
} from "./calcSave";

export interface CalcActionsProps extends ExportButtonsProps {
  /**
   * Kayıt anahtarı — hesaplayıcı başına benzersiz (ör. "kdv", "maas").
   * Verilmezse excelName'den türetilir ("mizan-kdv" → "kdv").
   */
  calcId?: string;
}

function calcKeyFromExcelName(excelName: string): string {
  return excelName.replace(/^mizan-/, "");
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" });
}

/** Kaydın içindeki tüm satırları (başlıklar dâhil) tek düzlemde sayar. */
function countRows(sections: ExcelSection[]): number {
  return sections.reduce(
    (n, s) => n + (s.headers?.length ?? 0) + s.rows.length + (s.footers?.length ?? 0),
    0,
  );
}

/** Kayıtlar dialogu — kayıtları listeler, Excel'e aktarır, siler. */
function SavedCalculationsDialog({
  calcId,
  title,
  open,
  onOpenChange,
  onChange,
}: {
  calcId: string;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Kayıt silme/temizleme sonrası üst bileşen listeyi tazeler. */
  onChange: () => void;
}) {
  // Dialog açıkken her yeniden çizimde depodan okunur (liste boyutu sınırlı);
  // kayıt silme/temizleme `onChange` ile üst bileşeni yeniden çizdirir.
  const records = open ? listSavedCalculations(calcId) : [];

  const handleExport = (record: SavedCalculation) => {
    try {
      exportExcel({
        fileName: `${calcKey(record)}-kayit`,
        sheetName: record.sheet,
        mainTitle: `${record.title} — ${formatDate(record.savedAt)}`,
        sections: record.sections,
      });
    } catch (e) {
      console.error("Kayıt Excel export hatası", e);
      toast.error("Kayıt Excel'e aktarılamadı.");
    }
  };

  const handleDelete = (id: string) => {
    deleteCalculation(id);
    toast.success("Kayıt silindi.");
    onChange();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title} — Kayıtlar</DialogTitle>
          <DialogDescription>
            Kaydedilmiş hesaplamalar. Kaydı Excel'e aktarabilir veya silebilirsiniz.
          </DialogDescription>
        </DialogHeader>

        {records.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Bu hesaplayıcı için henüz kayıt yok. Hesapladıktan sonra "Kaydet"
            butonuyla kayıt ekleyebilirsiniz.
          </p>
        ) : (
          <>
            <div className="grid gap-2">
              {records.map((record) => (
                <div key={record.id} className="rounded-md border border-border/70">
                  <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {record.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(record.savedAt)} · {countRows(record.sections)} satır
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => handleExport(record)}
                        title="Kaydı Excel olarak indir"
                      >
                        <FileSpreadsheet className="size-3.5" />
                        Excel
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(record.id)}
                        title="Kaydı sil"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                  <details className="border-t border-border/60">
                    <summary className="cursor-pointer px-3 py-1.5 text-xs text-muted-foreground select-none hover:text-foreground">
                      İçeriği göster
                    </summary>
                    <div className="max-h-56 overflow-y-auto px-3 pb-3">
                      {record.sections.map((section, si) => (
                        <div key={si} className="mt-2">
                          {section.title && (
                            <p className="text-xs font-semibold text-foreground">
                              {section.title}
                            </p>
                          )}
                          <table className="mt-1 w-full text-xs">
                            {section.headers && (
                              <thead>
                                <tr className="border-b border-border/60 text-left text-muted-foreground">
                                  {section.headers.map((h, hi) => (
                                    <th key={hi} className="py-1 pr-2 font-medium">{h}</th>
                                  ))}
                                </tr>
                              </thead>
                            )}
                            <tbody>
                              {section.rows.map((row, ri) => (
                                <tr key={ri} className="border-b border-border/40 last:border-0">
                                  {row.map((cell, ci) => (
                                    <td key={ci} className="py-1 pr-2 tabular-nums text-foreground">
                                      {cell === null ? "—" : String(cell)}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {(section.footers ?? []).map((f, fi) => (
                            <p key={`f-${fi}`} className="mt-1 text-xs font-medium text-foreground">
                              {f}
                            </p>
                          ))}
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5 text-destructive hover:text-destructive"
                onClick={() => {
                  clearCalculations(calcId);
                  toast.success("Tüm kayıtlar silindi.");
                  onChange();
                }}
              >
                <Trash2 className="size-3.5" />
                Tümünü sil
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function calcKey(record: SavedCalculation): string {
  return record.calcId.replace(/[^a-zA-Z0-9_-]+/g, "-") || "mizan";
}

/**
 * Kaydet + Kayıtlar + Excel/PDF/Yazdır — hesaplayıcı başlıklarında
 * tek bileşen olarak kullanılır.
 */
export function CalcActions({
  calcId: calcIdProp,
  className,
  ...exportProps
}: CalcActionsProps) {
  const calcId = calcIdProp ?? calcKeyFromExcelName(exportProps.excelName ?? "mizan-hesaplama");
  const [dialogOpen, setDialogOpen] = useState(false);
  // Sayacın kendisi okunmaz; artırılması dialog listesini yeniden çizdirir.
  const [, setRenew] = useState(0);
  const [savedFlash, setSavedFlash] = useState(false);

  const handleSave = () => {
    if (exportProps.disabled) return;
    const record = saveCalculation({
      calcId,
      title: exportProps.excelTitle,
      sheet: exportProps.excelSheet,
      sections: exportProps.excelSections,
    });
    if (record) {
      setRenew((v) => v + 1);
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1500);
      toast.success("Hesaplama kaydedildi.", {
        description: "Kayıtlar butonundan görebilir, Excel'e aktarabilirsiniz.",
      });
    } else {
      toast.error("Kayıt oluşturulamadı.", {
        description: "Tarayıcı deposu dolu veya kapalı olabilir.",
      });
    }
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5 print-hide", className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        disabled={exportProps.disabled}
        onClick={handleSave}
        title="Bu hesaplamayı kaydet"
      >
        <Save className={cn("size-3.5", savedFlash && "text-emerald-600")} />
        Kaydet
      </Button>
      <SavedCalculationsDialog
        calcId={calcId}
        title={exportProps.excelTitle}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onChange={() => setRenew((v) => v + 1)}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => {
          setRenew((v) => v + 1);
          setDialogOpen(true);
        }}
        title="Kayıtlı hesaplamalar"
      >
        <FolderOpen className="size-3.5" />
        Kayıtlar
      </Button>
      <ExportButtons {...exportProps} />
    </div>
  );
}

export type { ExcelSection } from "./calcExport";
