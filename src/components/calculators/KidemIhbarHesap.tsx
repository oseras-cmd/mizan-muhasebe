import { formatInputValue, parseTurkishNumber, todayIso } from "@/lib/finance/format";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMemo, useRef, useState } from "react";
import { CalcCard, Field, PrintHeader, ResultBox, ResultRow, ResultTotalRow, InfoNote } from "./shared";
import { hesaplaKidemIhbar, FESIH_ADLARI, type FesihNedeni } from "./engine/calcEngine";
import { ExportButtons } from "./engine/ExportButtons";

export function KidemIhbarHesap() {
  const [iseGiris, setIseGiris] = useState("2018-06-01");
  const [istenCikis, setIstenCikis] = useState(todayIso());
  const [brutMaas, setBrutMaas] = useState("45000");
  const [yemek, setYemek] = useState("2200");
  const [yol, setYol] = useState("2200");
  const [digerYardim, setDigerYardim] = useState("0");
  const [tavan, setTavan] = useState("73729.87");
  const [fesih, setFesih] = useState<FesihNedeni>("isverenFeshi");
  const areaRef = useRef<HTMLDivElement>(null);

  const giydirilmis = parseTurkishNumber(brutMaas) + parseTurkishNumber(yemek) + parseTurkishNumber(yol) + parseTurkishNumber(digerYardim);
  const result = useMemo(
    () =>
      hesaplaKidemIhbar({
        iseGiris,
        istenCikis,
        giydirilmisBrut: giydirilmis,
        fesihNedeni: fesih,
      }),
    [iseGiris, istenCikis, giydirilmis, fesih],
  );

  const fmt = (v: number) => `${v.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺`;
  const kidem = result.kidem;
  const ihbar = result.ihbar;

  const excelSections = [
    {
      title: "Girdiler",
      headers: ["Parametre", "Değer"],
      rows: [
        ["İşe Giriş Tarihi", iseGiris],
        ["İşten Çıkış Tarihi", istenCikis],
        ["Brüt Maaş (TL)", parseTurkishNumber(brutMaas)],
        ["Yemek + Yol + Diğer (TL)", parseTurkishNumber(yemek) + parseTurkishNumber(yol) + parseTurkishNumber(digerYardim)],
        ["Giydirilmiş Brüt Ücret (TL)", giydirilmis],
        ["Fesih Nedeni", FESIH_ADLARI[fesih]],
      ],
    },
    {
      title: "Kıdem Tazminatı Detayı",
      headers: ["Açıklama", "Tutar"],
      rows: [
        ["Çalışma süresi (yıl, ay, gün)", kidem ? `${kidem.calismaSuresi.yil} yıl ${kidem.calismaSuresi.ay} ay ${kidem.calismaSuresi.gun} gün` : "-"],
        ["Brüt Maaş", parseTurkishNumber(brutMaas)],
        ["Giydirilmiş Brüt Ücret", giydirilmis],
        ["Kıdem Tazminatı Tavanı", kidem?.tavan ?? 0],
        ["Brüt Kıdem Tazminatı", kidem?.brutKidem ?? 0],
        ["Damga Vergisi (%0,759)", -(kidem?.damga ?? 0)],
      ],
      footers: [`Net Kıdem Tazminatı: ${(kidem?.netKidem ?? 0).toFixed(2)} TL`],
      notes: [
        "Kıdem tazminatı gelir vergisinden muaftır, yalnızca damga vergisi kesilir (binde 7,59).",
        "Tavan: fesih tarihine göre 2026 1. yarıyıl 64.948,77 TL, 2. yarıyıl 73.729,87 TL.",
      ],
    },
    {
      title: "İhbar Tazminatı Detayı",
      headers: ["Açıklama", "Tutar"],
      rows: [
        ["İhbar Süresi", ihbar ? `${ihbar.sureHafta} hafta` : "-"],
        ["Brüt İhbar Tazminatı", ihbar?.brutIhbar ?? 0],
        ["SGK İşçi Payı (%14)", -(ihbar?.sgk ?? 0)],
        ["İşsizlik Sigortası (%1)", -(ihbar?.issizlik ?? 0)],
        ["Gelir Vergisi (%15)", -(ihbar?.gv ?? 0)],
        ["Damga Vergisi (%0,759)", -(ihbar?.damga ?? 0)],
      ],
      footers: [`Net İhbar Tazminatı: ${(ihbar?.netIhbar ?? 0).toFixed(2)} TL`],
      notes: ["İhbar tazminatı ücret niteliğinde olup SGK, gelir vergisi ve damga vergisine tabidir."],
    },
  ];

  return (
    <div className="print-area" ref={areaRef}>
      <PrintHeader title="Kıdem & İhbar Tazminatı Hesaplama" subtitle={FESIH_ADLARI[fesih]} />
      <CalcCard
        title="Kıdem & İhbar Tazminatı Hesaplama"
        subtitle="Giydirilmiş brüt, tavan kontrolü, damga/GV kesintileri"
        actions={
          <ExportButtons
            excelName="mizan-kidem-ihbar"
            excelTitle="Kıdem ve İhbar Tazminatı Hesaplama"
            excelSheet="Kıdem-İhbar"
            excelSections={excelSections}
            pdfTargetRef={areaRef}
            pdfName="mizan-kidem-ihbar"
            disabled={!kidem}
          />
        }
      >
        <div className="grid gap-6">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="İşe Giriş Tarihi">
              <Input type="date" value={iseGiris} onChange={(e) => setIseGiris(e.target.value)} />
            </Field>
            <Field label="İşten Çıkış Tarihi">
              <Input type="date" value={istenCikis} onChange={(e) => setIstenCikis(e.target.value)} />
            </Field>
            <Field label="Fesih Nedeni">
              <Select value={fesih} onValueChange={(v) => setFesih(v as FesihNedeni)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["isverenFeshi", "istifa", "erkekEvlenme", "erkekAskerlik", "emeklilik"] as FesihNedeni[]).map((f) => (
                    <SelectItem key={f} value={f}>{FESIH_ADLARI[f]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Brüt Maaş (₺)">
              <Input type="text" inputMode="decimal" value={brutMaas} onChange={(e) => setBrutMaas(formatInputValue(e.target.value))} className="tabular-nums" />
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-4">
            <Field label="Yemek Yardımı (₺/ay)">
              <Input type="text" inputMode="decimal" value={yemek} onChange={(e) => setYemek(formatInputValue(e.target.value))} className="tabular-nums" />
            </Field>
            <Field label="Yol Yardımı (₺/ay)">
              <Input type="text" inputMode="decimal" value={yol} onChange={(e) => setYol(formatInputValue(e.target.value))} className="tabular-nums" />
            </Field>
            <Field label="Diğer Sosyal Yardımlar (₺/ay)">
              <Input type="text" inputMode="decimal" value={digerYardim} onChange={(e) => setDigerYardim(formatInputValue(e.target.value))} className="tabular-nums" />
            </Field>
            <Field label="Kıdem Tazminatı Tavanı (₺)" hint="Fesih dönemine göre otomatik önerilir">
              <Input type="text" inputMode="decimal" value={tavan} onChange={(e) => setTavan(formatInputValue(e.target.value))} className="tabular-nums" />
            </Field>
          </div>

          <ResultBox>
            <ResultRow label="Çalışma Süresi" value={kidem ? `${kidem.calismaSuresi.yil} yıl ${kidem.calismaSuresi.ay} ay ${kidem.calismaSuresi.gun} gün` : "—"} />
            <ResultRow label="Giydirilmiş Brüt Ücret" value={fmt(giydirilmis)} />
            <ResultRow label="Kıdem Hakkı" value={kidem ? (kidem.hak ? "Var" : "Yok (istifa)") : "—"} />
            <ResultRow label="Kıdem Tavanı (fesih dönemi)" value={kidem ? fmt(kidem.tavan) : "—"} />
            {kidem?.tavanAsildi && <ResultRow label="Tavan Uygulandı" value="Evet" valueClassName="text-amber-600" />}
            <ResultRow label="Brüt Kıdem Tazminatı" value={kidem ? fmt(kidem.brutKidem) : "—"} />
            <ResultRow label="Damga Vergisi (%0,759)" value={kidem ? `−${fmt(kidem.damga)}` : "—"} valueClassName="text-destructive" />
            <ResultTotalRow label="Net Kıdem Tazminatı" value={kidem ? fmt(kidem.netKidem) : "—"} />
          </ResultBox>

          {ihbar && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">İhbar Tazminatı</p>
              <ResultBox>
                <ResultRow label="İhbar Süresi" value={ihbar.hak ? `${ihbar.sureHafta} hafta` : "—"} />
                <ResultRow label="Brüt İhbar Tazminatı" value={ihbar.hak ? fmt(ihbar.brutIhbar) : "—"} />
                <ResultRow label="SGK İşçi (%14) + İşsizlik (%1)" value={ihbar.hak ? `−${fmt(ihbar.sgk + ihbar.issizlik)}` : "—"} valueClassName="text-destructive" />
                <ResultRow label="Gelir Vergisi (%15 tahmini)" value={ihbar.hak ? `−${fmt(ihbar.gv)}` : "—"} valueClassName="text-destructive" />
                <ResultRow label="Damga Vergisi" value={ihbar.hak ? `−${fmt(ihbar.damga)}` : "—"} valueClassName="text-destructive" />
                <ResultTotalRow label="Net İhbar Tazminatı" value={ihbar.hak ? fmt(ihbar.netIhbar) : "İşçi istifasında ihbar tazminatı doğmaz"} />
              </ResultBox>
            </div>
          )}

          <InfoNote>
            Kıdem tazminatı gelir vergisinden muaftır, yalnızca damga vergisi kesilir. İhbar tazminatı ise
            ücret niteliğinde olup SGK, gelir vergisi ve damga vergisine tabidir. Gelir vergisi oranı,
            çalışanın yıllık kümülatif vergi matrahına göre değişebilir (%15 ilk dilim varsayılmıştır).
          </InfoNote>
        </div>
      </CalcCard>
    </div>
  );
}
