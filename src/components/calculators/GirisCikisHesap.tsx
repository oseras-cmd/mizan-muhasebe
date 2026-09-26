import { formatInputValue, parseTurkishNumber, todayIso } from "@/lib/finance/format";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useMemo, useRef, useState } from "react";
import { CalcCard, Field, PrintHeader, ResultBox, ResultRow, ResultTotalRow, InfoNote } from "./shared";
import { hesaplaGirisCikis, FESIH_ADLARI, type FesihNedeni } from "./engine/calcEngine";
import { PARAMS_2026 } from "./engine/params";
import { ExportButtons } from "./engine/ExportButtons";

export function GirisCikisHesap() {
  const [brutMaas, setBrutMaas] = useState("45000");
  const [iseGiris, setIseGiris] = useState("2024-01-15");
  const [istenCikis, setIstenCikis] = useState(todayIso());
  const [fesih, setFesih] = useState<FesihNedeni>("isverenFeshi");
  const [sgkTesvik, setSgkTesvik] = useState(true);
  const [besOran, setBesOran] = useState("0");
  const [besOtomatik, setBesOtomatik] = useState(false);
  const [izinGun, setIzinGun] = useState("10");
  const [yanHaklar, setYanHaklar] = useState("4400");
  const areaRef = useRef<HTMLDivElement>(null);

  const result = useMemo(
    () =>
      hesaplaGirisCikis({
        brutMaas: parseTurkishNumber(brutMaas),
        iseGiris,
        istenCikis,
        fesihNedeni: fesih,
        sgkTesvik,
        besIsverenOran: parseFloat(besOran) || 0,
        besOtomatikIsci: besOtomatik,
        kullanilmayanIzinGun: parseTurkishNumber(izinGun) || 0,
        yanHaklarAylik: parseTurkishNumber(yanHaklar) || 0,
      }),
    [brutMaas, iseGiris, istenCikis, fesih, sgkTesvik, besOran, besOtomatik, izinGun, yanHaklar],
  );

  const fmt = (v: number) => `${v.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺`;
  const sgkOran = sgkTesvik ? "%15,5" : "%20,5";

  const excelSections = [
    {
      title: "Girdiler",
      headers: ["Parametre", "Değer"],
      rows: [
        ["Brüt Maaş (TL)", parseTurkishNumber(brutMaas)],
        ["İşe Giriş Tarihi", iseGiris],
        ["İşten Çıkış Tarihi", istenCikis],
        ["Fesih Nedeni", FESIH_ADLARI[fesih]],
        ["SGK Teşviki", sgkTesvik ? "Var (5 puanlık indirim)" : "Yok"],
        ["BES İşveren Katkısı", `%${(parseFloat(besOran) * 100).toLocaleString("tr-TR")}`],
        ["Kullanılmayan İzin (gün)", parseTurkishNumber(izinGun)],
        ["Aylık Yan Haklar (TL)", parseTurkishNumber(yanHaklar)],
      ],
    },
    {
      title: "İşe Alım Maliyeti (Aylık)",
      headers: ["Kalem", "Tutar (TL)"],
      rows: [
        ["Brüt Maaş", result?.aylıkIsveren.brut ?? 0],
        [`SGK İşveren (${sgkOran})`, -(0) + (result?.aylıkIsveren.sgkIsveren ?? 0)],
        ["İşsizlik Sig. İşveren (%2)", result?.aylıkIsveren.issizlikIsveren ?? 0],
        ["BES İşveren Katkısı", result?.aylıkIsveren.bes ?? 0],
        ["Yan Haklar (Yemek/Yol vs.)", result?.aylıkIsveren.yanHaklar ?? 0],
      ],
      footers: [`Aylık Toplam İşveren Maliyeti: ${(result?.aylıkIsveren.toplam ?? 0).toFixed(2)} TL`],
    },
    {
      title: "Yıllık Kırılım",
      headers: ["Kalem", "Tutar (TL)"],
      rows: [
        ["Yıllık Brüt Maaş (12 ay)", result?.yillik.brut ?? 0],
        ["Yıllık SGK İşveren", result?.yillik.sgkIsveren ?? 0],
        ["Yıllık İşsizlik İşveren", result?.yillik.issizlikIsveren ?? 0],
        ["Yıllık BES İşveren Katkısı", result?.yillik.bes ?? 0],
        ["Yıllık Yan Haklar", result?.yillik.yanHaklar ?? 0],
      ],
      footers: [`Yıllık Toplam Maliyet: ${(result?.yillik.toplam ?? 0).toFixed(2)} TL`],
    },
    {
      title: "İşten Çıkış Maliyeti",
      headers: ["Kalem", "Tutar (TL)"],
      rows: [
        ["Net Kıdem Tazminatı", result?.kidem?.netKidem ?? 0],
        ["Net İhbar Tazminatı", result?.ihbar?.netIhbar ?? 0],
        ["Net İzin Ücreti", result?.izin?.net ?? 0],
      ],
      footers: [
        `Toplam Çıkış Maliyeti (işveren): ${(result?.toplamCikisMaliyeti ?? 0).toFixed(2)} TL`,
        `Çalışana Ödenecek Toplam: ${(result?.calisanaOdenen ?? 0).toFixed(2)} TL`,
        `Toplam İstihdam Maliyeti: ${(result?.toplamIstihdamMaliyeti ?? 0).toFixed(2)} TL`,
      ],
      notes: [
        "Kıdem tazminatı yalnızca damga vergisine tabidir; ihbar tazminatı ve izin ücreti ücret niteliğindedir.",
        `Güncel parametreler: kıdem tavanı 2026/2: ${PARAMS_2026.KIDEM_TAVAN_2.toLocaleString("tr-TR")} TL · brüt asgari ücret: ${PARAMS_2026.ASGARI_UCRET_BRUT.toLocaleString("tr-TR")} TL · SGK işveren: %20,5 (indirimli %15,5) · damga: %0,759.`,
      ],
    },
  ];

  return (
    <div className="print-area" ref={areaRef}>
      <PrintHeader title="İşe Giriş / Çıkış Maliyet Raporu" subtitle={FESIH_ADLARI[fesih]} />
      <CalcCard
        title="İşe Giriş / Çıkış Maliyet Simülatörü"
        subtitle="Çalışanın toplam işe alım ve işten çıkış maliyetini karşılaştırmalı hesaplayın"
        actions={
          <ExportButtons
            excelName="mizan-ise-giris-cikis"
            excelTitle="İşe Giriş / Çıkış Maliyet Simülatörü"
            excelSheet="Giriş-Çıkış"
            excelSections={excelSections}
            pdfTargetRef={areaRef}
            pdfName="mizan-ise-giris-cikis"
            disabled={!result}
          />
        }
      >
        <div className="grid gap-6">
          <div className="rounded-lg border bg-muted/30 px-5 py-4">
            <p className="text-sm font-semibold text-foreground">Çalışan & Ücret Bilgileri</p>
            <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Brüt Maaş (₺)">
                <Input type="text" inputMode="decimal" value={brutMaas} onChange={(e) => setBrutMaas(formatInputValue(e.target.value))} className="tabular-nums" />
              </Field>
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
              <Field label="SGK Teşviki">
                <div className="flex h-9 items-center gap-3">
                  <Switch checked={sgkTesvik} onCheckedChange={setSgkTesvik} id="sgk-tesvik" />
                  <Label htmlFor="sgk-tesvik" className="text-xs text-muted-foreground">{sgkTesvik ? "Var (%15,5)" : "Yok (%20,5)"}</Label>
                </div>
              </Field>
              <Field label="BES İşveren Katkı Oranı" hint="örn. 0,03 = %3">
                <Input type="text" inputMode="decimal" value={besOran} onChange={(e) => setBesOran(e.target.value.replace(/[^\d.,]/g, "").replace(",", "."))} className="tabular-nums" />
              </Field>
              <Field label="BES Otomatik Katılım (İşçi %3)">
                <div className="flex h-9 items-center gap-3">
                  <Switch checked={besOtomatik} onCheckedChange={setBesOtomatik} id="bes-auto" />
                  <Label htmlFor="bes-auto" className="text-xs text-muted-foreground">{besOtomatik ? "Uygulanıyor" : "Uygulanmıyor"}</Label>
                </div>
              </Field>
              <Field label="Kullanılmayan İzin (Gün)">
                <Input type="text" inputMode="decimal" value={izinGun} onChange={(e) => setIzinGun(formatInputValue(e.target.value))} className="tabular-nums" />
              </Field>
              <Field label="Aylık Yan Haklar (₺)" hint="Yemek, yol, yakacak vb.">
                <Input type="text" inputMode="decimal" value={yanHaklar} onChange={(e) => setYanHaklar(formatInputValue(e.target.value))} className="tabular-nums" />
              </Field>
            </div>
          </div>

          {result && (
            <>
              <div className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: "Aylık İşveren Maliyeti", value: fmt(result.aylıkIsveren.toplam) },
                  { label: "Yıllık İşveren Maliyeti", value: fmt(result.yillik.toplam) },
                  { label: "Toplam Çıkış Maliyeti", value: fmt(result.toplamCikisMaliyeti) },
                  { label: "Toplam İstihdam Maliyeti", value: fmt(result.toplamIstihdamMaliyeti) },
                ].map((x) => (
                  <div key={x.label} className="bg-card px-5 py-4">
                    <p className="text-xs text-muted-foreground">{x.label}</p>
                    <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{x.value}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <ResultBox>
                  <p className="px-5 pt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">İşe Alım Maliyeti (Aylık)</p>
                  <div className="pt-2" />
                  <ResultRow label="Brüt Maaş" value={fmt(result.aylıkIsveren.brut)} />
                  <ResultRow label={`SGK İşveren (${sgkOran})`} value={fmt(result.aylıkIsveren.sgkIsveren)} />
                  <ResultRow label="İşsizlik Sig. İşveren (%2)" value={fmt(result.aylıkIsveren.issizlikIsveren)} />
                  <ResultRow label="BES İşveren Katkısı" value={fmt(result.aylıkIsveren.bes)} />
                  <ResultRow label="Yan Haklar (Yemek/Yol vs.)" value={fmt(result.aylıkIsveren.yanHaklar)} />
                  <ResultTotalRow label="Aylık Toplam İşveren Maliyeti" value={fmt(result.aylıkIsveren.toplam)} />
                </ResultBox>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Çalışan Tarafı</p>
                  <ResultBox>
                    <ResultRow label="SGK İşçi (%14)" value={`−${fmt(result.isciKesinti.sgk)}`} valueClassName="text-destructive" />
                    <ResultRow label="İşsizlik İşçi (%1)" value={`−${fmt(result.isciKesinti.issizlik)}`} valueClassName="text-destructive" />
                    <ResultRow label="Gelir Vergisi (%15 ilk dilim)" value={`−${fmt(result.isciKesinti.gv)}`} valueClassName="text-destructive" />
                    <ResultRow label="Damga Vergisi (%0,759)" value={`−${fmt(result.isciKesinti.damga)}`} valueClassName="text-destructive" />
                    {result.isciKesinti.bes > 0 && <ResultRow label="BES Otomatik Katılım (%3)" value={`−${fmt(result.isciKesinti.bes)}`} valueClassName="text-destructive" />}
                    <ResultTotalRow label="Net Maaş (Eline Geçen)" value={fmt(result.isciKesinti.netMaas)} />
                  </ResultBox>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">İşten Çıkış Maliyeti</p>
                  <ResultBox>
                    <ResultRow label="Net Kıdem Tazminatı" value={result.kidem?.netKidem ? fmt(result.kidem.netKidem) : "—"} />
                    <ResultRow label="Net İhbar Tazminatı" value={result.ihbar?.hak ? fmt(result.ihbar.netIhbar) : "—"} />
                    <ResultRow label="Net İzin Ücreti" value={result.izin ? fmt(result.izin.net) : "—"} />
                    <ResultTotalRow label="Toplam Çıkış Maliyeti (İşveren)" value={fmt(result.toplamCikisMaliyeti)} />
                  </ResultBox>
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Maliyet Dağılımı</p>
                  <div className="space-y-2.5 rounded-lg border bg-card px-5 py-4">
                    {[
                      { label: "Brüt Maaş", v: result.dagilim.brutOran, cls: "bg-foreground" },
                      { label: "SGK/İşsizlik", v: result.dagilim.sgkOran, cls: "bg-blue-500" },
                      { label: "BES + Yan Hak", v: result.dagilim.besYanOran, cls: "bg-amber-500" },
                      { label: "Çıkış Maliyeti", v: result.dagilim.cikisOran, cls: "bg-emerald-500" },
                    ].map((d) => (
                      <div key={d.label}>
                        <div className="mb-1 flex justify-between text-xs">
                          <span className="text-muted-foreground">{d.label}</span>
                          <span className="font-mono tabular-nums">%{(d.v * 100).toLocaleString("tr-TR", { maximumFractionDigits: 1 })}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div className={`h-full rounded-full ${d.cls}`} style={{ width: `${Math.min(100, d.v * 100)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <ResultBox>
                <ResultRow label="Çalışılan Süre" value={result.calismaSuresi ? `${result.calismaSuresi.yil} yıl ${result.calismaSuresi.ay} ay ${result.calismaSuresi.gun} gün (${result.calismaSuresi.toplamGun.toLocaleString("tr-TR")} gün)` : "—"} />
                <ResultRow label="Toplam Maaş Maliyeti" value={fmt(result.yillik.toplam * (result.calismaSuresi ? result.calismaSuresi.toplamGun / 365 : 0))} />
                <ResultRow label="Çıkış Maliyeti" value={fmt(result.toplamCikisMaliyeti)} />
                <ResultTotalRow label="GENEL TOPLAM — Toplam İstihdam Maliyeti" value={fmt(result.toplamIstihdamMaliyeti)} />
              </ResultBox>

              <InfoNote>
                Güncel parametreler (2026): Kıdem tazminatı tavanı 73.729,87 TL · Brüt asgari ücret
                33.030,00 TL · SGK tavanı {(PARAMS_2026.SGK_TAVAN).toLocaleString("tr-TR")} TL · SGK işveren
                %20,5 (5 puanlık indirimle %15,5) · Damga vergisi %0,759 · BES zorunlu katılım %3. 5510
                sayılı SGK Kanunu, 4857 sayılı İş Kanunu, 4632 sayılı BES Kanunu.
              </InfoNote>
            </>
          )}
        </div>
      </CalcCard>
    </div>
  );
}
