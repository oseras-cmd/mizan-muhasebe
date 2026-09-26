import { formatInputValue, parseTurkishNumber } from "@/lib/finance/format";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMemo, useRef, useState } from "react";
import { CalcCard, Field, PrintHeader, ResultBox, ResultRow, ResultTotalRow, InfoNote } from "./shared";
import { hesaplaBinek } from "./engine/calcEngine";
import { PARAMS_2026 } from "./engine/params";
import { ExportButtons } from "./engine/ExportButtons";
import { cn } from "@/lib/utils";

export function BinekOtoHesap() {
  const [marka, setMarka] = useState("");
  const [alisBedeli, setAlisBedeli] = useState("1200000");
  const [kdv, setKdv] = useState("240000");
  const [otv, setOtv] = useState("120000");
  const [aylikKira, setAylikKira] = useState("0");
  const [yillikYakit, setYillikYakit] = useState("60000");
  const [yil, setYil] = useState<"2025" | "2026">("2026");
  const areaRef = useRef<HTMLDivElement>(null);

  const result = useMemo(
    () =>
      hesaplaBinek({
        alisBedeli: parseTurkishNumber(alisBedeli),
        kdv: parseTurkishNumber(kdv),
        otv: parseTurkishNumber(otv),
        aylikKira: parseTurkishNumber(aylikKira),
        yillikYakit: parseTurkishNumber(yillikYakit),
        yil: (yil === "2025" ? 2025 : 2026) as 2025 | 2026,
      }),
    [alisBedeli, kdv, otv, aylikKira, yillikYakit, yil],
  );

  const fmt = (v: number) => `${v.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺`;

  const excelSections = [
    {
      title: "Girdiler",
      headers: ["Parametre", "Değer"],
      rows: [
        ["Marka / Model", marka || "-"],
        ["Alış Bedeli (TL)", parseTurkishNumber(alisBedeli)],
        ["KDV (TL)", parseTurkishNumber(kdv)],
        ["ÖTV (TL)", parseTurkishNumber(otv)],
        ["Aylık Kiralama Bedeli (TL)", parseTurkishNumber(aylikKira)],
        ["Yıllık Yakıt/Bakım Gideri (TL)", parseTurkishNumber(yillikYakit)],
      ],
    },
    {
      title: "Kısıtlama Sonuçları",
      headers: ["Kalem", "Tutar (TL)", "İndirilebilir", "KKEG"],
      rows: [
        ["Amortisman (yıllık)", result?.yillikAmortisman ?? 0, (result?.yillikAmortisman ?? 0) - (result?.amortismanKKEG ?? 0), result?.amortismanKKEG ?? 0],
        ["Kiralama (yıllık)", result?.kiraYillik ?? 0, (result?.kiraYillik ?? 0) - (result?.kiraKKEG ?? 0), result?.kiraKKEG ?? 0],
        ["Yakıt / Bakım", parseTurkishNumber(yillikYakit), result?.yakitIndirilebilir ?? 0, result?.yakitKKEG ?? 0],
      ],
      footers: [
        `Toplam KKEG: ${(result?.toplamKKEG ?? 0).toFixed(2)} TL`,
        `İndirilebilir Toplam: ${(result?.toplamIndirilebilir ?? 0).toFixed(2)} TL`,
      ],
      notes: [
        `Amortisman sınırı ${yil}: ${(yil === "2025" ? PARAMS_2026.BINEK_AMORTISMAN_SINIR_2025 : PARAMS_2026.BINEK_AMORTISMAN_SINIR_2026).toLocaleString("tr-TR")} TL (KDV hariç).`,
        `KDV indirim üst sınırı: ${PARAMS_2026.BINEK_KDV_SINIR.toLocaleString("tr-TR")} TL (KDV+ÖTV dahil alış).`,
        "GVK m.40/5 ve m.68/5: Sınırlı imtiyazlı gelir ve kurum vergisi mükelleflerinde binek otomobil giderleri sınırlıdır.",
      ],
    },
  ];

  return (
    <div className="print-area" ref={areaRef}>
      <PrintHeader title="Binek Otomobil Gider Kısıtlaması" subtitle={marka ? `${marka} · ${yil}` : yil} />
      <CalcCard
        title="Binek Otomobil Gider Kısıtlaması"
        subtitle="GVK Md.40/5 — 68/5"
        actions={
          <ExportButtons
            excelName="mizan-binek-oto"
            excelTitle="Binek Otomobil Gider Kısıtlaması"
            excelSheet="Binek Oto"
            excelSections={excelSections}
            pdfTargetRef={areaRef}
            pdfName="mizan-binek-oto"
            disabled={!result}
          />
        }
      >
        <div className="grid gap-6">
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Marka / Model">
              <Input value={marka} onChange={(e) => setMarka(e.target.value)} placeholder="örn. Fiat Egea" />
            </Field>
            <Field label="Alış Bedeli (₺, KDV hariç)">
              <Input type="text" inputMode="decimal" value={alisBedeli} onChange={(e) => setAlisBedeli(formatInputValue(e.target.value))} className="tabular-nums" />
            </Field>
            <Field label="Yıl Bazlı Limitler">
              <Select value={yil} onValueChange={(v) => setYil(v as "2025" | "2026")}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="2025">2025</SelectItem>
                  <SelectItem value="2026">2026</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid gap-5 sm:grid-cols-4">
            <Field label="KDV Tutarı (₺)">
              <Input type="text" inputMode="decimal" value={kdv} onChange={(e) => setKdv(formatInputValue(e.target.value))} className="tabular-nums" />
            </Field>
            <Field label="ÖTV Tutarı (₺)">
              <Input type="text" inputMode="decimal" value={otv} onChange={(e) => setOtv(formatInputValue(e.target.value))} className="tabular-nums" />
            </Field>
            <Field label="Aylık Kiralama Bedeli (₺)" hint="Kiralama yoluyla ise">
              <Input type="text" inputMode="decimal" value={aylikKira} onChange={(e) => setAylikKira(formatInputValue(e.target.value))} className="tabular-nums" />
            </Field>
            <Field label="Yıllık Yakıt/Bakım (₺)">
              <Input type="text" inputMode="decimal" value={yillikYakit} onChange={(e) => setYillikYakit(formatInputValue(e.target.value))} className="tabular-nums" />
            </Field>
          </div>

          {result && (
            <div className={cn("rounded-lg border px-4 py-3 text-sm", result.kdvIndirilebilir ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-amber-300 bg-amber-50 text-amber-800")}>
              <strong>KDV İndirimi:</strong>{" "}
              {result.kdvIndirilebilir
                ? `Toplam alış (${result.toplamAlis.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺) KDV indirim sınırının altında — KDV tamamen indirilebilir.`
                : `Toplam alış (${result.toplamAlis.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺) sınırı aşıyor — KDV'nin tamamı KKEG'dir.`}
            </div>
          )}

          <ResultBox>
            <ResultRow label="Amortisman Matrahı (sınır dahil)" value={result ? fmt(result.amortismanMatrahi) : "—"} />
            <ResultRow label="Yıllık Amortisman (5 yıl normal)" value={result ? fmt(result.yillikAmortisman) : "—"} />
            <ResultRow label="Kiralama (yıllık)" value={result ? fmt(result.kiraYillik) : "—"} />
            <ResultRow label="Yakıt/Bakım İndirilebilir (%50)" value={result ? fmt(result.yakitIndirilebilir) : "—"} />
            <ResultTotalRow label="Toplam KKEG" value={result ? fmt(result.toplamKKEG) : "—"} valueClassName="text-destructive" />
            <ResultTotalRow label="İndirilebilir Toplam" value={result ? fmt(result.toplamIndirilebilir) : "—"} />
          </ResultBox>

          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Kalem</th>
                  <th className="px-3 py-2 text-right font-medium">Tutar</th>
                  <th className="px-3 py-2 text-right font-medium">İndirilebilir</th>
                  <th className="px-3 py-2 text-right font-medium">KKEG</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t">
                  <td className="px-3 py-2">Amortisman (yıllık)</td>
                  <td className="px-3 py-2 text-right tabular-nums">{result ? fmt(result.yillikAmortisman + result.amortismanKKEG) : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{result ? fmt(result.yillikAmortisman) : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-destructive">{result ? fmt(result.amortismanKKEG) : "—"}</td>
                </tr>
                <tr className="border-t">
                  <td className="px-3 py-2">Kiralama (yıllık)</td>
                  <td className="px-3 py-2 text-right tabular-nums">{result ? fmt(result.kiraYillik) : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{result ? fmt(result.kiraYillik - result.kiraKKEG) : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-destructive">{result ? fmt(result.kiraKKEG) : "—"}</td>
                </tr>
                <tr className="border-t">
                  <td className="px-3 py-2">Yakıt / Bakım</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(parseTurkishNumber(yillikYakit))}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{result ? fmt(result.yakitIndirilebilir) : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-destructive">{result ? fmt(result.yakitKKEG) : "—"}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <InfoNote>
            Ticari araçlar için binek otomobil gider kısıtlaması uygulanmaz; tüm giderler tamamen
            indirilebilir. Sınırlar her yıl yeniden değerleme oranıyla güncellenir.
          </InfoNote>
        </div>
      </CalcCard>
    </div>
  );
}
