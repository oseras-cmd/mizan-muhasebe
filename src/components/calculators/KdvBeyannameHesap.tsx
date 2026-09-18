import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  formatInputValue,
  parseTurkishNumber,
  formatTRY,
} from "@/lib/finance/format";
import {
  hesaplaKdvBeyanname,
  EMPTY_KDV_INPUT,
  KDV_KONTROL_LISTESI,
  type KdvBeyannameInput,
  type KdvTableRow,
} from "@/lib/finance/kdvBeyanname";
import { cn } from "@/lib/utils";
import {
  CalendarRange,
  CheckCircle2,
  FileText,
  Landmark,
  Printer,
  ReceiptText,
  Scale,
} from "lucide-react";

const MONTHS = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

const fmt = (v: number) => formatTRY(v).replace("₺", "").trim();

function Row({
  label,
  value,
  onChange,
  bold,
}: {
  label: string;
  value: number | null;
  onChange?: (v: number) => void;
  bold?: boolean;
}) {
  return (
    <tr
      className={cn(
        "border-b border-border/40",
        bold && "bg-muted/40 font-semibold",
      )}
    >
      <td className={cn("px-4 py-2.5", bold ? "text-foreground" : "text-muted-foreground")}>
        {label}
      </td>
      <td className="px-4 py-2.5 text-right">
        {value === null ? (
          <span className="text-muted-foreground">—</span>
        ) : value === 0 ? (
          <span className="tabular-nums text-muted-foreground">0,00</span>
        ) : (
          <span className="font-mono tabular-nums text-foreground">{fmt(value)}</span>
        )}
      </td>
      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-foreground">
        {value === null || value === 0 ? "0,00" : fmt(value)}
      </td>
      {onChange ? (
        <td className="w-36 px-4 py-1.5">
          <Input
            value={value ? formatInputValue(String(value)) : ""}
            onChange={(e) => onChange(parseTurkishNumber(e.target.value))}
            placeholder="0,00"
            inputMode="decimal"
            className="h-8 text-right text-sm tabular-nums"
          />
        </td>
      ) : null}
    </tr>
  );
}

function sectionHeader(title: string, icon: React.ReactNode) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <span className="text-sm font-semibold text-foreground">{title}</span>
    </div>
  );
}

export function KdvBeyannameHesap() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [input, setInput] = useState<KdvBeyannameInput>({ ...EMPTY_KDV_INPUT });
  const [checked, setChecked] = useState<boolean[]>(() => KDV_KONTROL_LISTESI.map(() => false));

  const sonuc = useMemo(() => hesaplaKdvBeyanname(input), [input]);

  const set = (patch: Partial<KdvBeyannameInput>) => setInput((prev) => ({ ...prev, ...patch }));

  const reset = () => {
    setInput({ ...EMPTY_KDV_INPUT });
    setChecked(KDV_KONTROL_LISTESI.map(() => false));
  };

  const renderTableRows = (rows: KdvTableRow[]) =>
    rows.map((row, i) =>
      row.matrah === null && Number.isNaN(row.kdv) ? (
        <tr key={`sec-${i}`} className="border-b border-border/40 bg-muted/20">
          <td colSpan={3} className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {row.kalem}
          </td>
        </tr>
      ) : (
        <tr
          key={`row-${i}`}
          className={cn("border-b border-border/40", row.isTotal && "bg-muted/40 font-semibold")}
        >
          <td className={cn("px-4 py-2.5", row.isTotal ? "text-foreground" : "text-muted-foreground")}>
            {row.kalem}
          </td>
          <td className="px-4 py-2.5 text-right font-mono tabular-nums text-foreground">
            {row.matrah === null ? "—" : fmt(row.matrah)}
          </td>
          <td className="px-4 py-2.5 text-right font-mono tabular-nums text-foreground">
            {fmt(row.kdv)}
          </td>
        </tr>
      ),
    );

  return (
    <div className="space-y-6">
      {/* Beyanname Dönemi */}
      <section className="rounded-lg border bg-card">
        <div className="border-b border-border/70 px-5 py-4">
          {sectionHeader("Beyanname Dönemi", <CalendarRange className="size-4 text-muted-foreground" />)}
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Ay</Label>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring"
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i}>{m}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Yıl</Label>
            <Input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="h-9"
            />
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-2">
            <strong>{MONTHS[month]} {year}</strong> dönemine ait KDV-1 beyannamesi —
            beyanname son tarihi: takip eden ayın <strong>28'i</strong>.
          </p>
        </div>
      </section>

      {/* Satışlar + Alışlar */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border bg-card">
          <div className="border-b border-border/70 px-5 py-4">
            {sectionHeader("Satışlar (Hesaplanan KDV)", <ReceiptText className="size-4 text-muted-foreground" />)}
          </div>
          <div className="grid gap-4 p-5">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground">%1 KDV'li Satış Matrahı</Label>
              <Input
                value={input.satis1 ? formatInputValue(String(input.satis1)) : ""}
                onChange={(e) => set({ satis1: parseTurkishNumber(e.target.value) })}
                placeholder="0,00"
                inputMode="decimal"
                className="text-right tabular-nums"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground">%10 KDV'li Satış Matrahı</Label>
              <Input
                value={input.satis10 ? formatInputValue(String(input.satis10)) : ""}
                onChange={(e) => set({ satis10: parseTurkishNumber(e.target.value) })}
                placeholder="0,00"
                inputMode="decimal"
                className="text-right tabular-nums"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground">%20 KDV'li Satış Matrahı</Label>
              <Input
                value={input.satis20 ? formatInputValue(String(input.satis20)) : ""}
                onChange={(e) => set({ satis20: parseTurkishNumber(e.target.value) })}
                placeholder="0,00"
                inputMode="decimal"
                className="text-right tabular-nums"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground">KDV'den İstisna Satışlar</Label>
              <Input
                value={input.istisnaSatis ? formatInputValue(String(input.istisnaSatis)) : ""}
                onChange={(e) => set({ istisnaSatis: parseTurkishNumber(e.target.value) })}
                placeholder="0,00"
                inputMode="decimal"
                className="text-right tabular-nums"
              />
              <p className="text-[11px] text-muted-foreground">Bilgi amaçlı — KDV hesaplanmaz</p>
            </div>
          </div>
        </section>

        <section className="rounded-lg border bg-card">
          <div className="border-b border-border/70 px-5 py-4">
            {sectionHeader("Alışlar (İndirilecek KDV)", <Scale className="size-4 text-muted-foreground" />)}
          </div>
          <div className="grid gap-4 p-5">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground">%1 KDV'li Alış Matrahı</Label>
              <Input
                value={input.alis1 ? formatInputValue(String(input.alis1)) : ""}
                onChange={(e) => set({ alis1: parseTurkishNumber(e.target.value) })}
                placeholder="0,00"
                inputMode="decimal"
                className="text-right tabular-nums"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground">%10 KDV'li Alış Matrahı</Label>
              <Input
                value={input.alis10 ? formatInputValue(String(input.alis10)) : ""}
                onChange={(e) => set({ alis10: parseTurkishNumber(e.target.value) })}
                placeholder="0,00"
                inputMode="decimal"
                className="text-right tabular-nums"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground">%20 KDV'li Alış Matrahı</Label>
              <Input
                value={input.alis20 ? formatInputValue(String(input.alis20)) : ""}
                onChange={(e) => set({ alis20: parseTurkishNumber(e.target.value) })}
                placeholder="0,00"
                inputMode="decimal"
                className="text-right tabular-nums"
              />
            </div>
          </div>
        </section>
      </div>

      {/* Ek Bilgiler */}
      <section className="rounded-lg border bg-card">
        <div className="border-b border-border/70 px-5 py-4">
          {sectionHeader("Ek Bilgiler", <FileText className="size-4 text-muted-foreground" />)}
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Önceki Dönemden Devreden KDV</Label>
            <Input
              value={input.devredenOnceki ? formatInputValue(String(input.devredenOnceki)) : ""}
              onChange={(e) => set({ devredenOnceki: parseTurkishNumber(e.target.value) })}
              placeholder="0,00"
              inputMode="decimal"
              className="text-right tabular-nums"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Tevkifata Tabi Satış KDV'si (Alıcı Kesintisi)</Label>
            <Input
              value={input.tevkifatSatis ? formatInputValue(String(input.tevkifatSatis)) : ""}
              onChange={(e) => set({ tevkifatSatis: parseTurkishNumber(e.target.value) })}
              placeholder="0,00"
              inputMode="decimal"
              className="text-right tabular-nums"
            />
          </div>
        </div>
      </section>

      {/* Sonuç */}
      <section
        className={cn(
          "rounded-lg border-2 bg-card p-5",
          sonuc.odenecek > 0 ? "border-red-200 dark:border-red-900/50" : "border-emerald-200 dark:border-emerald-900/50",
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Sonuç</p>
            <p
              className={cn(
                "mt-1 text-lg font-semibold",
                sonuc.odenecek > 0 ? "text-red-600" : "text-emerald-600",
              )}
            >
              {sonuc.odenecek > 0 ? "Ödenecek KDV" : "Sonraki Aya Devreden KDV"}
            </p>
          </div>
          <p
            className={cn(
              "font-mono text-3xl font-bold tabular-nums tracking-tight",
              sonuc.odenecek > 0 ? "text-red-600" : "text-emerald-600",
            )}
          >
            {fmt(sonuc.odenecek > 0 ? sonuc.odenecek : sonuc.devreden)} ₺
          </p>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {sonuc.odenecek > 0
            ? "Bu tutarı beyanname son günü (ayın 28'i) ödemeniz gerekir"
            : "Bu tutar sonraki dönem beyannamesine devredecektir"}
        </p>
      </section>

      {/* KDV Hesaplama Tablosu */}
      <section className="rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
          {sectionHeader("KDV Hesaplama Tablosu", <ReceiptText className="size-4 text-muted-foreground" />)}
          <Button type="button" variant="outline" size="sm" onClick={reset}>
            Temizle
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/70 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2.5">Kalem</th>
                <th className="px-4 py-2.5 text-right">Matrah</th>
                <th className="px-4 py-2.5 text-right">KDV</th>
              </tr>
            </thead>
            <tbody>{renderTableRows(sonuc.tablo)}</tbody>
          </table>
        </div>
      </section>

      {/* Muhasebe Kaydı */}
      {sonuc.muhasebeKaydi.length > 0 && (
        <section className="rounded-lg border bg-card">
          <div className="border-b border-border/70 px-5 py-4">
            {sectionHeader("Muhasebe Kaydı (KDV Beyannamesi)", <Landmark className="size-4 text-muted-foreground" />)}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/70 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2.5">Hesap</th>
                  <th className="px-4 py-2.5">Hesap Adı</th>
                  <th className="px-4 py-2.5 text-right">Borç</th>
                  <th className="px-4 py-2.5 text-right">Alacak</th>
                </tr>
              </thead>
              <tbody>
                {sonuc.muhasebeKaydi.map((row) => (
                  <tr key={`${row.hesap}-${row.hesapAdi}`} className="border-b border-border/40">
                    <td className="px-4 py-2.5 font-mono font-semibold text-foreground">{row.hesap}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{row.hesapAdi}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-foreground">
                      {row.borc > 0 ? fmt(row.borc) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-foreground">
                      {row.alacak > 0 ? fmt(row.alacak) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Kontrol Listesi */}
      <section className="rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
          {sectionHeader("Beyanname Kontrol Listesi", <CheckCircle2 className="size-4 text-muted-foreground" />)}
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => window.print()}>
            <Printer className="size-3.5" />
            Yazdır
          </Button>
        </div>
        <ul className="divide-y divide-border/50">
          {KDV_KONTROL_LISTESI.map((item, i) => (
            <li key={item} className="flex items-center gap-3 px-5 py-3">
              <Checkbox
                checked={checked[i]}
                onCheckedChange={(v) =>
                  setChecked((prev) => prev.map((c, idx) => (idx === i ? v === true : c)))
                }
              />
              <span className={cn("text-sm", checked[i] ? "text-muted-foreground line-through" : "text-foreground")}>
                {item}
              </span>
            </li>
          ))}
        </ul>
        {checked.every(Boolean) && checked.length > 0 && (
          <p className="flex items-center gap-1.5 border-t border-border/50 bg-emerald-50 px-5 py-3 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
            <CheckCircle2 className="size-3.5" />
            Tüm kontroller tamamlandı — beyanname gönderilmeye hazır.
          </p>
        )}
      </section>
    </div>
  );
}
