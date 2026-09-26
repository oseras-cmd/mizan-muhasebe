import { formatInputValue, parseTurkishNumber } from "@/lib/finance/format";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMemo, useRef, useState } from "react";
import { CalcCard, Field, PrintHeader, ResultBox, ResultRow, ResultTotalRow, InfoNote } from "./shared";
import { hesaplaDamga, type DamgaBelgeTuru } from "./engine/calcEngine";
import { PARAMS_2026 } from "./engine/params";
import { ExportButtons } from "./engine/ExportButtons";

const BELGE_TURLERI: { id: DamgaBelgeTuru; label: string }[] = [
  { id: "sozlesme", label: "Sözleşme (Akit) — binde 9,48" },
  { id: "ihale", label: "İhale Kararı — binde 5,69" },
  { id: "bordro", label: "Ücret Bordrosu — binde 7,59" },
  { id: "makbuz", label: "Makbuz / Ödeme Emri — binde 7,59" },
  { id: "kefalet", label: "Kefalet / Teminat Senedi — binde 9,48" },
  { id: "teminatMektubu", label: "Banka Teminat Mektubu — binde 9,48" },
  { id: "bilanco", label: "Bilanço — maktu (2026: 616,30 TL)" },
  { id: "gelirTablosu", label: "Gelir Tablosu — maktu (2026: 294,20 TL)" },
];

export function DamgaVergisiHesap() {
  const [belgeTuru, setBelgeTuru] = useState<DamgaBelgeTuru>("sozlesme");
  const [tutar, setTutar] = useState("100000");
  const [nusha, setNusha] = useState("2");
  const areaRef = useRef<HTMLDivElement>(null);

  const result = useMemo(
    () =>
      hesaplaDamga({
        belgeTuru,
        tutar: parseTurkishNumber(tutar),
        nusha: Math.max(1, Math.floor(parseTurkishNumber(nusha) || 1)),
      }),
    [belgeTuru, tutar, nusha],
  );
  const maktu = belgeTuru === "bilanco" || belgeTuru === "gelirTablosu";

  const excelSections = [
    {
      title: "Girdiler",
      headers: ["Parametre", "Değer"],
      rows: [
        ["Belge Türü", BELGE_TURLERI.find((b) => b.id === belgeTuru)?.label ?? "-"],
        ["Belge Tutarı (TL)", maktu ? "-" : parseTurkishNumber(tutar)],
        ["Nüsha Sayısı", Math.max(1, Math.floor(parseTurkishNumber(nusha) || 1))],
      ],
    },
    {
      title: "Sonuçlar",
      headers: ["Kalem", "Tutar (TL)"],
      rows: [
        [result?.oranBinde != null ? `Oranlı vergi (binde ${result.oranBinde.toLocaleString("tr-TR")})` : "Maktu vergi", result?.birNusha ?? 0],
        ["Toplam (nüsha × vergi)", result?.toplam ?? 0],
      ],
      footers: [`Ödenecek Toplam: ${(result?.toplam ?? 0).toFixed(2)} TL`],
      notes: [
        "488 sayılı Damga Vergisi Kanunu. Sözleşmeler genelde 2 nüsha düzenlenir; her nüsha ayrı vergilendirilir.",
        "488 s.k. mük.14: her kağıt için yıllık tavan aşılırsa tavan uygulanır.",
        `2026 maktu: Bilanço ${PARAMS_2026.DV_MAKTU_BILANCO.toLocaleString("tr-TR")} TL · Gelir tablosu ${PARAMS_2026.DV_MAKTU_GELIR_TABLOSU.toLocaleString("tr-TR")} TL (71 seri no'lu DV GT).`,
      ],
    },
  ];

  return (
    <div className="print-area" ref={areaRef}>
      <PrintHeader title="Damga Vergisi Hesaplama Raporu" subtitle={BELGE_TURLERI.find((b) => b.id === belgeTuru)?.label} />
      <CalcCard
        title="Damga Vergisi Hesaplama"
        subtitle="Sözleşme, makbuz ve resmî belgelerin damga vergisi tutarı"
        actions={
          <ExportButtons
            excelName="mizan-damga-vergisi"
            excelTitle="Damga Vergisi Hesaplama"
            excelSheet="Damga Vergisi"
            excelSections={excelSections}
            pdfTargetRef={areaRef}
            pdfName="mizan-damga-vergisi"
            disabled={!result}
          />
        }
      >
        <div className="grid gap-6">
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Belge Türü">
              <Select value={belgeTuru} onValueChange={(v) => setBelgeTuru(v as DamgaBelgeTuru)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BELGE_TURLERI.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={maktu ? "Belge Tutarı (maktu vergide kullanılmaz)" : "Belge Tutarı (TL)"}>
              <Input
                type="text" inputMode="decimal" value={tutar}
                onChange={(e) => setTutar(formatInputValue(e.target.value))}
                placeholder="0,00" className="tabular-nums" disabled={maktu}
              />
            </Field>
            <Field label="Nüsha Sayısı">
              <Input
                type="text" inputMode="numeric" value={nusha}
                onChange={(e) => setNusha(e.target.value.replace(/[^\d]/g, ""))}
                className="tabular-nums"
              />
            </Field>
          </div>

          <ResultBox>
            <ResultRow
              label={maktu ? "Maktu Vergi (her nüsha)" : "Vergi (her nüsha)"}
              value={result ? `${result.birNusha.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺` : "—"}
            />
            {result?.oranBinde != null && (
              <ResultRow label="Uygulanan Oran" value={`binde ${result.oranBinde.toLocaleString("tr-TR")}`} />
            )}
            <ResultRow label="Nüsha" value={String(Math.max(1, Math.floor(parseTurkishNumber(nusha) || 1)))} />
            <ResultTotalRow
              label="Ödenecek Toplam Damga Vergisi"
              value={result ? `${result.toplam.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺` : "—"}
            />
          </ResultBox>

          <InfoNote>
            <strong>Nüsha uyarısı:</strong> Sözleşmeler genelde 2 nüsha düzenlenir; her nüsha ayrı ayrı
            damga vergisine tabidir. <strong>Azami tavan:</strong> 488 s.k. mük.14 uyarınca her kağıt için
            hesaplanan vergi yıllık tavanı aşamaz. Bilanço ve gelir tabloları maktu vergiye tabidir.
          </InfoNote>
        </div>
      </CalcCard>
    </div>
  );
}
