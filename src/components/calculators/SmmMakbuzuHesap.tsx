import { formatInputValue, parseTurkishNumber } from "@/lib/finance/format";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useMemo, useRef, useState } from "react";
import { CalcCard, Field, PrintHeader, ResultBox, ResultRow, ResultTotalRow, InfoNote } from "./shared";
import { hesaplaSmm } from "./engine/calcEngine";
import { ExportButtons } from "./engine/ExportButtons";

type HesapTuru = "tahsilEdilenden" | "brutten" | "netten";

export function SmmMakbuzuHesap() {
  const [hesapTuru, setHesapTuru] = useState<HesapTuru>("tahsilEdilenden");
  const [kdvTevkifatVar, setKdvTevkifatVar] = useState(false);
  const [kdvTevkifatOran, setKdvTevkifatOran] = useState("0.9");
  const [tutar, setTutar] = useState("10000");
  const areaRef = useRef<HTMLDivElement>(null);

  const tfOran = parseFloat(kdvTevkifatOran) || 0;
  const result = useMemo(
    () =>
      hesaplaSmm({
        hesapTuru,
        kdvTevkifatVar,
        kdvTevkifatOran: tfOran,
        tutar: parseTurkishNumber(tutar),
      }),
    [hesapTuru, kdvTevkifatVar, tfOran, tutar],
  );

  const fmt = (v: number) => `${v.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺`;

  const excelSections = [
    {
      title: "Girdiler",
      headers: ["Parametre", "Değer"],
      rows: [
        ["Hesap Türü", hesapTuru === "tahsilEdilenden" ? "Tahsil Edilenden" : hesapTuru === "brutten" ? "Brütten" : "Netten"],
        ["KDV Tevkifatı", kdvTevkifatVar ? `%${(tfOran * 100).toLocaleString("tr-TR")}` : "Yok"],
        ["Girilen Tutar (TL)", parseTurkishNumber(tutar)],
      ],
    },
    {
      title: "Makbuz Hesaplama Sonucu",
      headers: ["Kalem", "Tutar (TL)"],
      rows: [
        ["Brüt Ücret", result?.brut ?? 0],
        ["(−) G.V. Tevkifatı (%20)", -(result?.gv ?? 0)],
        ["(=) Net Ücret", result?.net ?? 0],
        ["(+) KDV (%20)", result?.kdv ?? 0],
        ["(−) KDV Tevkifatı", -(result?.kdvTevkifat ?? 0)],
        ["(=) Tahsil Edilen Tutar", result?.tahsilEdilen ?? 0],
      ],
      footers: [`Tahsil Edilen: ${(result?.tahsilEdilen ?? 0).toFixed(2)} TL`],
      notes: [
        "193 sayılı GVK m.94 · 3065 sayılı KDV Kanunu · VUK m.236 (serbest meslek makbuzu).",
        "KDV tevkifat oranları: %50, %70, %90 (hizmet türüne göre).",
      ],
    },
  ];

  return (
    <div className="print-area" ref={areaRef}>
      <PrintHeader title="Serbest Meslek Makbuzu Hesaplama" subtitle={`${hesapTuru === "tahsilEdilenden" ? "Tahsil edilenden" : hesapTuru === "brutten" ? "Brütten" : "Netten"}${kdvTevkifatVar ? ` · KDV tevkifatı %${(tfOran * 100).toLocaleString("tr-TR")}` : " · KDV tevkifatı yok"}`} />
      <CalcCard
        title="Serbest Meslek Makbuzu Hesaplama"
        subtitle="Brüt/net tutar, gelir vergisi tevkifatı, KDV ve KDV tevkifatı"
        actions={
          <ExportButtons
            excelName="mizan-smm-makbuzu"
            excelTitle="Serbest Meslek Makbuzu Hesaplama"
            excelSheet="SMM Makbuzu"
            excelSections={excelSections}
            pdfTargetRef={areaRef}
            pdfName="mizan-smm-makbuzu"
            disabled={!result}
          />
        }
      >
        <div className="grid gap-6">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Hesap Türü">
              <Select value={hesapTuru} onValueChange={(v) => setHesapTuru(v as HesapTuru)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tahsilEdilenden">Tahsil Edilenden</SelectItem>
                  <SelectItem value="brutten">Brütten</SelectItem>
                  <SelectItem value="netten">Netten</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Tutar (₺)">
              <Input
                type="text" inputMode="decimal" value={tutar}
                onChange={(e) => setTutar(formatInputValue(e.target.value))}
                placeholder="0,00" className="tabular-nums"
              />
            </Field>
            <Field label="KDV Tevkifatı">
              <div className="flex h-9 items-center gap-3">
                <Switch checked={kdvTevkifatVar} onCheckedChange={setKdvTevkifatVar} id="kdv-tevkifat-var" />
                <Label htmlFor="kdv-tevkifat-var" className="text-xs text-muted-foreground">
                  {kdvTevkifatVar ? "Var" : "Yok"}
                </Label>
              </div>
            </Field>
            {kdvTevkifatVar && (
              <Field label="KDV Tevkifat Türü">
                <Select value={kdvTevkifatOran} onValueChange={setKdvTevkifatOran}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0.9">%90 — Organik gübre, jeotermal...</SelectItem>
                    <SelectItem value="0.7">%70 — Metal, plastik, kablolar...</SelectItem>
                    <SelectItem value="0.5">%50 — Bakım-onarım, mütercimlik...</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            )}
          </div>

          <ResultBox>
            <ResultRow label="Brüt Tutar" value={result ? fmt(result.brut) : "—"} />
            <ResultRow label="Tevkifat Oranı" value={result ? `%${(result.gvOran * 100).toLocaleString("tr-TR")}` : "—"} />
            <ResultRow label="G.V. Tevkifatı" value={result ? `−${fmt(result.gv)}` : "—"} valueClassName="text-destructive" />
            <ResultRow label="Net Tutar" value={result ? fmt(result.net) : "—"} />
            <ResultRow label={`KDV Oranı (%${result ? (result.kdvOran * 100).toLocaleString("tr-TR") : "—"})`} value={result ? `+${fmt(result.kdv)}` : "—"} />
            {kdvTevkifatVar && (
              <ResultRow label={`KDV Tevkifat Tutarı (%${(tfOran * 100).toLocaleString("tr-TR")})`} value={result ? `−${fmt(result.kdvTevkifat)}` : "—"} valueClassName="text-destructive" />
            )}
            <ResultTotalRow label="Tahsil Edilen" value={result ? fmt(result.tahsilEdilen) : "—"} />
          </ResultBox>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Makbuz Kalem Detayı</p>
            <div className="rounded-lg border bg-muted/20 px-4 py-3 font-mono text-[13px] leading-7">
              <div>Brüt Ücret: {result ? fmt(result.brut) : "—"}</div>
              <div>(−) G.V. Tevkifatı (%{result ? (result.gvOran * 100).toLocaleString("tr-TR") : "—"}): {result ? fmt(result.gv) : "—"}</div>
              <div>(=) Net Ücret: {result ? fmt(result.net) : "—"}</div>
              <div>(+) KDV (%20): {result ? fmt(result.kdv) : "—"}</div>
              <div>(−) KDV Tevkifatı: {result ? fmt(result.kdvTevkifat) : "—"}</div>
              <div className="border-t pt-1 font-semibold">(=) Tahsil Edilen Tutar: {result ? fmt(result.tahsilEdilen) : "—"}</div>
            </div>
          </div>

          <InfoNote>
            193 sayılı GVK m.94 · 3065 sayılı KDV Kanunu · VUK m.236. Serbest meslek makbuzunda brüt ücret
            üzerinden %20 gelir vergisi tevkifatı yapılır; KDV ayrıca hesaplanır ve varsa tevkifat oranı
            kadarı hazine adına kesilir.
          </InfoNote>
        </div>
      </CalcCard>
    </div>
  );
}
