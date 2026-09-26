import { formatInputValue } from "@/lib/finance/format";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { parseTurkishNumber } from "@/lib/finance/format";
import { useMemo, useRef, useState } from "react";
import {
  CalcCard, Field, PrintHeader, ResultBox, ResultRow, ResultTotalRow, Segmented, InfoNote,
} from "./shared";
import { hesaplaStopaj, type StopajTuru } from "./engine/calcEngine";
import { ExportButtons } from "./engine/ExportButtons";

const STOPAJ_TYPES: { id: StopajTuru; label: string }[] = [
  { id: "isyeriKira", label: "İşyeri Kira — %20" },
  { id: "konutKiraKurum", label: "Konut Kira (Kurum/ESM Kiracısı) — %20" },
  { id: "serbestMeslek", label: "Serbest Meslek — %20" },
  { id: "temettu", label: "Temettü (Kar Payı) — %15" },
  { id: "avukatlik", label: "Avukatlık Hizmeti — %20" },
  { id: "insaatTaahhut", label: "İnşaat ve Taahhüt İşleri — %15" },
  { id: "menkul", label: "Menkul Kıymet ve Diğer — %17,5" },
];

type Sekil = "brut" | "net";

export function StopajHesap() {
  const [turId, setTurId] = useState<StopajTuru>("isyeriKira");
  const [sekil, setSekil] = useState<Sekil>("brut");
  const [tutar, setTutar] = useState("10000");
  const areaRef = useRef<HTMLDivElement>(null);

  const girilen = parseTurkishNumber(tutar);
  const result = useMemo(() => {
    const brut = sekil === "net" ? girilen / 0.8 : girilen;
    // net üzerinden girişte formül tip bazında değişir; motor brut alır:
    const oran = { isyeriKira: 0.2, konutKiraKurum: 0.2, serbestMeslek: 0.2, temettu: 0.15, avukatlik: 0.2, insaatTaahhut: 0.15, menkul: 0.175 }[turId];
    const bruto = sekil === "net" ? girilen / (1 - oran) : girilen;
    return hesaplaStopaj({ tur: turId, brut: bruto });
  }, [girilen, sekil, turId]);

  const excelSections = [
    {
      title: "Girdiler",
      headers: ["Parametre", "Değer"],
      rows: [
        ["Stopaj Türü", result?.turAdi ?? "-"],
        ["Oran", result ? `%${(result.oran * 100).toLocaleString("tr-TR")}` : "-"],
        [sekil === "brut" ? "Brüt Tutar (TL)" : "Net Tutar (TL)", girilen],
      ],
    },
    {
      title: "Sonuçlar",
      headers: ["Kalem", "Tutar (TL)"],
      rows: [
        ["Brüt Tutar", result?.brut ?? 0],
        ["Stopaj Kesintisi", -(result?.stopaj ?? 0)],
      ],
      footers: [`Net Tutar: ${(result?.net ?? 0).toFixed(2)} TL`],
      notes: ["GVK m.94 uyarınca kaynakta kesinti yoluyla vergilendirme."],
    },
  ];

  return (
    <div className="print-area" ref={areaRef}>
      <PrintHeader
        title="Stopaj Hesaplama Raporu"
        subtitle={result ? `${result.turAdi} · ${sekil === "brut" ? "Brüt üzerinden" : "Net üzerinden"}` : undefined}
      />
      <CalcCard
        title="Stopaj Hesaplama"
        subtitle="Kira, serbest meslek, temettü ve avukatlık stopajları — GVK m.94"
        actions={
          <ExportButtons
            excelName="mizan-stopaj"
            excelTitle="Stopaj Hesaplama"
            excelSheet="Stopaj"
            excelSections={excelSections}
            pdfTargetRef={areaRef}
            pdfName="mizan-stopaj"
            disabled={!result}
          />
        }
      >
        <div className="grid gap-6">
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Stopaj Türü">
              <Select value={turId} onValueChange={(v) => setTurId(v as StopajTuru)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STOPAJ_TYPES.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Hesaplama Şekli">
              <Segmented<Sekil>
                options={[
                  { value: "brut", label: "Brüt Üzerinden" },
                  { value: "net", label: "Net Üzerinden" },
                ]}
                value={sekil}
                onChange={setSekil}
              />
            </Field>
            <Field label={sekil === "brut" ? "Brüt Tutar (₺)" : "Net Tutar (₺)"}>
              <Input
                type="text"
                inputMode="decimal"
                value={tutar}
                onChange={(e) => setTutar(formatInputValue(e.target.value))}
                placeholder="0,00"
                className="tabular-nums"
              />
            </Field>
          </div>

          <ResultBox>
            <ResultRow label="Brüt Tutar" value={result ? `${result.brut.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺` : "—"} />
            <ResultRow
              label={`Stopaj Tutarı (%${result ? (result.oran * 100).toLocaleString("tr-TR") : "—"})`}
              value={result ? `−${result.stopaj.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺` : "—"}
              valueClassName="text-destructive"
            />
            <ResultTotalRow label="Net Tutar" value={result ? `${result.net.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺` : "—"} />
          </ResultBox>

          <InfoNote>
            Kiracı basit usulde vergilendiriliyorsa stopaj yükümlülüğü doğmaz. Konut kirasında kiracı
            gerçek kişi ise stopaj yapılmaz; kurum / serbest meslek erbabı kiracılar %20 keser.
            Kesilen stopajlar muhtasar ve prim hizmet beyannamesi ile beyan edilir.
          </InfoNote>
        </div>
      </CalcCard>
    </div>
  );
}
