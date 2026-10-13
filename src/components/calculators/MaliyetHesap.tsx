import { formatInputValue } from "@/lib/finance/format";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatTRY, parseTurkishNumber } from "@/lib/finance/format";
import { useMemo, useRef, useState } from "react";
import { CalcCard, Field, PrintHeader, ResultBox, ResultRow, ResultTotalRow } from "./shared";
import { CalcActions } from "./engine/CalcActions";
import type { ExcelSection } from "./engine/calcExport";

export function MaliyetHesap() {
  const [alis, setAlis] = useState("10000");
  const [nakliye, setNakliye] = useState("500");
  const [gumruk, setGumruk] = useState("0");
  const [diger, setDiger] = useState("200");
  const [adet, setAdet] = useState("100");
  const [iskonto, setIskonto] = useState("0");
  const [kdvli, setKdvli] = useState(false);
  const areaRef = useRef<HTMLDivElement>(null);

  const result = useMemo(() => {
    let alisValue = parseTurkishNumber(alis);
    const nakliyeValue = parseTurkishNumber(nakliye) || 0;
    const gumrukValue = parseTurkishNumber(gumruk) || 0;
    const digerValue = parseTurkishNumber(diger) || 0;
    const adetValue = parseTurkishNumber(adet) || 1;
    const iskontoValue = parseTurkishNumber(iskonto) || 0;
    if (!Number.isFinite(alisValue) || alisValue < 0) return null;

    if (kdvli) alisValue = alisValue / 1.2;
    const iskontoTutar = alisValue * (iskontoValue / 100);
    const alisNet = alisValue - iskontoTutar;
    const toplam = alisNet + nakliyeValue + gumrukValue + digerValue;
    const birim = toplam / Math.max(adetValue, 1);
    return { toplam, birim, satis: birim * 1.4 };
  }, [alis, nakliye, gumruk, diger, adet, iskonto, kdvli]);

  const excelSections: ExcelSection[] = [
    {
      title: "Girdiler",
      headers: ["Parametre", "Değer"],
      rows: [
        ["Alış Fiyatı (₺)", parseTurkishNumber(alis)],
        ["Nakliye (₺)", parseTurkishNumber(nakliye)],
        ["Gümrük Vergisi (₺)", parseTurkishNumber(gumruk)],
        ["Diğer Giderler (₺)", parseTurkishNumber(diger)],
        ["Miktar (Adet)", parseTurkishNumber(adet)],
        ["İskonto (%)", parseTurkishNumber(iskonto)],
        ["KDV dahil giriş", kdvli ? "Evet" : "Hayır"],
      ],
    },
    {
      title: "Sonuçlar",
      headers: ["Kalem", "Tutar (₺)"],
      rows: result
        ? [
            ["Toplam Maliyet", result.toplam],
            ["Birim Maliyet", result.birim],
            ["%40 Kâr ile Satış Fiyatı", result.satis],
          ]
        : [],
    },
  ];

  return (
    <div className="print-area" ref={areaRef}>
      <PrintHeader
        title="Maliyet Hesaplama Raporu"
        subtitle={result ? `Birim maliyet ${formatTRY(result.birim)} · ${adet} adet` : undefined}
      />
      <CalcCard
        title="Maliyet Hesaplama"
        subtitle="Alış, nakliye ve diğer giderlerle birim maliyet ve kârlı satış fiyatı"
        actions={
          <CalcActions
            excelName="mizan-maliyet"
            excelTitle="Maliyet Hesaplama"
            excelSheet="Maliyet"
            excelSections={excelSections}
            pdfTargetRef={areaRef}
            pdfName="mizan-maliyet"
            disabled={!result}
          />
        }
      >
      <div className="grid gap-6">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Alış Fiyatı (₺)">
            <Input
              type="text"
              inputMode="decimal"
              value={alis}
              onChange={(event) => setAlis(formatInputValue(event.target.value))}
              placeholder="0,00"
              className="tabular-nums"
            />
          </Field>
          <Field label="Nakliye (₺)">
            <Input
              type="text"
              inputMode="decimal"
              value={nakliye}
              onChange={(event) => setNakliye(formatInputValue(event.target.value))}
              placeholder="0,00"
              className="tabular-nums"
            />
          </Field>
          <Field label="Gümrük Vergisi (₺)">
            <Input
              type="text"
              inputMode="decimal"
              value={gumruk}
              onChange={(event) => setGumruk(formatInputValue(event.target.value))}
              placeholder="0,00"
              className="tabular-nums"
            />
          </Field>
          <Field label="Diğer Giderler (₺)">
            <Input
              type="text"
              inputMode="decimal"
              value={diger}
              onChange={(event) => setDiger(formatInputValue(event.target.value))}
              placeholder="0,00"
              className="tabular-nums"
            />
          </Field>
          <Field label="Miktar (Adet)">
            <Input
              type="text"
              inputMode="numeric"
              value={adet}
              onChange={(event) => setAdet(formatInputValue(event.target.value))}
              placeholder="0"
              className="tabular-nums"
            />
          </Field>
          <Field label="İskonto (%)">
            <Input
              type="text"
              inputMode="decimal"
              value={iskonto}
              onChange={(event) => setIskonto(formatInputValue(event.target.value))}
              placeholder="0"
              className="tabular-nums"
            />
          </Field>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="kdvli-input"
            checked={kdvli}
            onCheckedChange={(checked) => setKdvli(checked === true)}
          />
          <Label
            htmlFor="kdvli-input"
            className="text-sm font-normal text-muted-foreground"
          >
            KDV dahil fiyat girdim (KDV'yi çıkar — %20)
          </Label>
        </div>

        <ResultBox>
          <ResultRow
            label="Toplam Maliyet"
            value={result ? formatTRY(result.toplam) : "—"}
          />
          <ResultRow
            label="Birim Maliyet"
            value={result ? formatTRY(result.birim) : "—"}
          />
          <ResultTotalRow
            label="%40 Kâr ile Satış Fiyatı"
            value={result ? formatTRY(result.satis) : "—"}
            valueClassName="text-emerald-700 dark:text-emerald-300"
          />
        </ResultBox>
      </div>
      </CalcCard>
    </div>
  );
}
