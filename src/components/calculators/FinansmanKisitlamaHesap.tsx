import { formatInputValue, parseTurkishNumber } from "@/lib/finance/format";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMemo, useRef, useState } from "react";
import { CalcCard, Field, PrintHeader, ResultBox, ResultRow, ResultTotalRow, InfoNote } from "./shared";
import { hesaplaFinansman } from "./engine/calcEngine";
import { ExportButtons } from "./engine/ExportButtons";
import { cn } from "@/lib/utils";

export function FinansmanKisitlamaHesap() {
  const [yabanciKaynak, setYabanciKaynak] = useState("2000000");
  const [ozkaynak, setOzkaynak] = useState("1500000");
  const [finansmanGideri, setFinansmanGideri] = useState("300000");
  const [kisitlamaOrani, setKisitlamaOrani] = useState("0.10");
  const areaRef = useRef<HTMLDivElement>(null);

  const result = useMemo(
    () =>
      hesaplaFinansman({
        yabanciKaynak: parseTurkishNumber(yabanciKaynak),
        ozkaynak: parseTurkishNumber(ozkaynak),
        finansmanGideri: parseTurkishNumber(finansmanGideri),
        kisitlamaOrani: parseFloat(kisitlamaOrani) || 0.1,
      }),
    [yabanciKaynak, ozkaynak, finansmanGideri, kisitlamaOrani],
  );

  const fmt = (v: number) => `${v.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺`;

  const excelSections = [
    {
      title: "Girdiler",
      headers: ["Parametre", "Tutar (TL)"],
      rows: [
        ["Yabancı Kaynak Toplamı", parseTurkishNumber(yabanciKaynak)],
        ["Özkaynak Toplamı", parseTurkishNumber(ozkaynak)],
        ["Toplam Finansman Gideri", parseTurkishNumber(finansmanGideri)],
        ["Kısıtlama Oranı", `%${(parseFloat(kisitlamaOrani) * 100).toLocaleString("tr-TR")}`],
      ],
    },
    {
      title: "Hesaplama Sonucu",
      headers: ["Kalem", "Tutar / Oran"],
      rows: [
        ["Asan Kisim (YK − ÖK)", result?.asanKisim ?? 0],
        ["Asan Kisim Oranı (Asan / YK)", result ? `${(result.asanOran * 100).toLocaleString("tr-TR", { maximumFractionDigits: 2 })}%` : "-"],
        ["Kısıtlamaya Tabi Finansman Gideri", result?.kisitlamayaTabi ?? 0],
        ["KKEG Tutarı", result?.kkeg ?? 0],
        ["İndirilebilir Finansman Gideri", result?.indirilecek ?? 0],
      ],
      footers: [`KKEG: ${(result?.kkeg ?? 0).toFixed(2)} TL`],
      notes: [
        "KVK m.11/1-i: Yabancı kaynakları özkaynağını aşan mükelleflerde, aşan kısma isabet eden finansman giderlerinin %10'u KKEG'dir.",
        "Finansman gideri: kredi faizleri, kur farkları, vade farkları, finansman hizmeti giderleri.",
      ],
    },
  ];

  return (
    <div className="print-area" ref={areaRef}>
      <PrintHeader title="Finansman Gider Kısıtlaması" subtitle="KVK Md. 11/1-i" />
      <CalcCard
        title="Finansman Gider Kısıtlaması"
        subtitle="GVK Md.11/11 — KVK Md.11/1-i"
        actions={
          <ExportButtons
            excelName="mizan-finansman-kisitlama"
            excelTitle="Finansman Gider Kısıtlaması"
            excelSheet="Finansman"
            excelSections={excelSections}
            pdfTargetRef={areaRef}
            pdfName="mizan-finansman-kisitlama"
            disabled={!result}
          />
        }
      >
        <div className="grid gap-6">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Dönem">
              <Select defaultValue="2026">
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="2026">2026</SelectItem>
                  <SelectItem value="2025">2025</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Yabancı Kaynak Toplamı (₺)">
              <Input type="text" inputMode="decimal" value={yabanciKaynak} onChange={(e) => setYabanciKaynak(formatInputValue(e.target.value))} className="tabular-nums" />
            </Field>
            <Field label="Özkaynak Toplamı (₺)">
              <Input type="text" inputMode="decimal" value={ozkaynak} onChange={(e) => setOzkaynak(formatInputValue(e.target.value))} className="tabular-nums" />
            </Field>
            <Field label="Toplam Finansman Gideri (₺)">
              <Input type="text" inputMode="decimal" value={finansmanGideri} onChange={(e) => setFinansmanGideri(formatInputValue(e.target.value))} className="tabular-nums" />
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Kısıtlama Oranı (%)" hint="Genel oran %10; yapı sektörü %5">
              <Input type="text" inputMode="decimal" value={kisitlamaOrani} onChange={(e) => setKisitlamaOrani(e.target.value.replace(/[^\d.,]/g, "").replace(",", "."))} className="tabular-nums" />
            </Field>
          </div>

          {result && (
            <div className={cn("rounded-lg border px-4 py-3 text-sm", result.uygulanmaz ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-amber-300 bg-amber-50 text-amber-800")}>
              <strong>Sonuç: {result.uygulanmaz ? "Kısıtlama Uygulanmaz" : "Kısıtlama Uygulanır"}</strong>
              {" — "}
              {result.uygulanmaz
                ? "Yabancı kaynak, özkaynağı aşmadığı için finansman gider kısıtlaması uygulanmaz."
                : `Yabancı kaynak, özkaynağı ${result.asanKisim.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL aşıyor.`}
            </div>
          )}

          <ResultBox>
            <ResultRow label="Yabancı Kaynak Toplamı" value={fmt(parseTurkishNumber(yabanciKaynak))} />
            <ResultRow label="Özkaynak Toplamı" value={fmt(parseTurkishNumber(ozkaynak))} />
            <ResultRow label="Asan Kisim (YK − ÖK)" value={result ? fmt(result.asanKisim) : "—"} />
            <ResultRow label="Asan Kisim Oranı" value={result ? `%${(result.asanOran * 100).toLocaleString("tr-TR", { maximumFractionDigits: 2 })}` : "—"} />
            <ResultRow label="Toplam Finansman Gideri" value={fmt(parseTurkishNumber(finansmanGideri))} />
            <ResultRow label="Kısıtlamaya Tabi Finansman Gideri (FG × Asan Oran)" value={result ? fmt(result.kisitlamayaTabi) : "—"} />
            <ResultRow label={`KKEG Tutarı (%${(parseFloat(kisitlamaOrani) * 100).toLocaleString("tr-TR")})`} value={result ? `−${fmt(result.kkeg)}` : "—"} valueClassName="text-destructive" />
            <ResultTotalRow label="İndirilebilir Finansman Gideri" value={result ? fmt(result.indirilecek) : "—"} />
          </ResultBox>

          <InfoNote>
            Finansman gider kısıtlaması, yabancı kaynakları özkaynağını aşan mükelleflere uygulanır.
            Kullanılan kredi faizleri, kur farkları, vade farkları ve finansman hizmeti kapsamındaki diğer
            giderler bu kısıtlamaya tabidir. KKEG tutarı kurum kazancına eklenir.
          </InfoNote>
        </div>
      </CalcCard>
    </div>
  );
}
