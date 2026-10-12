import { formatInputValue, parseTurkishNumber } from "@/lib/finance/format";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useMemo, useRef, useState } from "react";
import {
  CalcCard,
  Field,
  InfoNote,
  PrintHeader,
  ResultBox,
  ResultRow,
  ResultTotalRow,
  Segmented,
  formatNumber,
} from "./shared";
import { ExportButtons } from "./engine/ExportButtons";
import {
  gerekliMaasBrut,
  hesaplaMaas,
  type MaasSecenek,
} from "./engine/maas";

const AY_ADLARI = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

type UcretTipi = "brut" | "net";

export function MaasHesap() {
  const [ucretTipi, setUcretTipi] = useState<UcretTipi>("brut");
  const [tutar, setTutar] = useState("45.000");
  const [asgariIstisna, setAsgariIstisna] = useState(true);
  const [indirimliPrim, setIndirimliPrim] = useState(false);
  const [isverenGoster, setIsverenGoster] = useState(true);
  const areaRef = useRef<HTMLDivElement>(null);

  const secenek: MaasSecenek = useMemo(
    () => ({ asgariIstisna, indirimliPrim }),
    [asgariIstisna, indirimliPrim],
  );

  const giris = parseTurkishNumber(tutar) || 0;
  const brut = useMemo(() => {
    if (ucretTipi === "brut") return giris;
    return gerekliMaasBrut(giris, secenek) ?? 0;
  }, [ucretTipi, giris, secenek]);

  const sonuc = useMemo(() => hesaplaMaas(brut, secenek), [brut, secenek]);
  const ilkAy = sonuc.satirlar[0];

  const excelSections = [
    {
      title: "Girdiler",
      headers: ["Parametre", "Değer"],
      rows: [
        ["Ücret Tipi", ucretTipi === "brut" ? "Brütten Nete" : "Netten Brüte"],
        [ucretTipi === "brut" ? "Aylık Brüt (TL)" : "Hedef Net (TL)", giris],
        ["Asgari Ücret İstisnası", asgariIstisna ? "Uygulanıyor" : "Kapalı"],
        [
          "5 Puanlık Prim İndirimi",
          indirimliPrim ? "Uygulanıyor (işveren SGK %16,75)" : "Uygulanmıyor (%21,75)",
        ],
      ],
    },
    {
      title: "Aylık Bordro Dökümü 2026",
      headers: [
        "Ay",
        "Brüt",
        "SSK İşçi",
        "İşsizlik İşçi",
        "Gelir Vergisi",
        "Damga Vergisi",
        "Küm. Matrah",
        "Net",
        "SSK İşveren",
        "İşsizlik İşveren",
        "Toplam Maliyet",
      ],
      rows: sonuc.satirlar.map((r) => [
        AY_ADLARI[r.ay - 1],
        Number(r.brut.toFixed(2)),
        Number(r.sskIsci.toFixed(2)),
        Number(r.issizlikIsci.toFixed(2)),
        Number(r.gv.toFixed(2)),
        Number(r.damga.toFixed(2)),
        Number(r.kumMatrah.toFixed(2)),
        Number(r.net.toFixed(2)),
        Number(r.sskIsveren.toFixed(2)),
        Number(r.issizlikIsveren.toFixed(2)),
        Number(r.toplamMaliyet.toFixed(2)),
      ]),
      footers: [
        `Yıllık Net Toplam: ${formatNumber(sonuc.toplam.net)} ₺ · İşveren Toplam Maliyet: ${formatNumber(sonuc.toplam.toplamMaliyet)} ₺`,
      ],
      notes: [
        "2026 SGK: işçi %14+1, işveren %21,75+2 (5 puan indirimli %16,75+2), tavan 297.270 ₺/ay.",
        "Damga vergisi binde 7,59; asgari ücrete isabet eden GV + damga istisnadır.",
      ],
    },
  ];

  return (
    <div className="print-area" ref={areaRef}>
      <PrintHeader
        title="Maaş Hesaplama Raporu (Brüt ↔ Net)"
        subtitle={`2026 bordro parametreleri · ${ucretTipi === "brut" ? "Brütten Nete" : "Netten Brüte"}`}
      />
      <CalcCard
        title="Maaş Hesaplama"
        subtitle="Brüt maaştan nete, aylık SGK, gelir ve damga vergisi dökümü — verginet tarzı"
        actions={
          <ExportButtons
            excelName="mizan-maas-hesaplama"
            excelTitle="Maaş Hesaplama 2026"
            excelSheet="Maaş"
            excelSections={excelSections}
            pdfTargetRef={areaRef}
            pdfName="mizan-maas-hesaplama"
          />
        }
      >
        <div className="grid gap-5">
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Ücret Tipi">
              <Segmented<UcretTipi>
                options={[
                  { value: "brut", label: "Brütten Nete" },
                  { value: "net", label: "Netten Brüte" },
                ]}
                value={ucretTipi}
                onChange={setUcretTipi}
              />
            </Field>
            <Field
              label={ucretTipi === "brut" ? "Aylık Brüt Ücret (₺)" : "Hedef Aylık Net (₺)"}
            >
              <Input
                type="text"
                inputMode="decimal"
                value={tutar}
                onChange={(e) => setTutar(formatInputValue(e.target.value))}
                placeholder="0,00"
                className="tabular-nums"
              />
            </Field>
            <Field label="İşveren Maliyetini Göster">
              <div className="flex h-9 items-center gap-3">
                <Switch checked={isverenGoster} onCheckedChange={setIsverenGoster} />
                <span className="text-xs text-muted-foreground">
                  {isverenGoster ? "SGK + işsizlik işveren payları açık" : "Gizli"}
                </span>
              </div>
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Asgari Ücret İstisnası">
              <div className="flex h-9 items-center gap-3">
                <Switch checked={asgariIstisna} onCheckedChange={setAsgariIstisna} />
                <span className="text-xs text-muted-foreground">
                  {asgariIstisna
                    ? "Uygulanıyor — asgari ücrete isabet eden GV + damga muaf (2025+)"
                    : "Kapalı — tüm ücret vergilendirilir"}
                </span>
              </div>
            </Field>
            <Field label="5 Puanlık Prim İndirimi">
              <div className="flex h-9 items-center gap-3">
                <Switch checked={indirimliPrim} onCheckedChange={setIndirimliPrim} />
                <span className="text-xs text-muted-foreground">
                  {indirimliPrim
                    ? "İmalat vb. — işveren SGK %16,75"
                    : "Standart — işveren SGK %21,75"}
                </span>
              </div>
            </Field>
          </div>
        </div>
      </CalcCard>

      {/* Ücret özeti */}
      <ResultBox className="mt-6">
        <ResultRow
          label={ucretTipi === "brut" ? "Aylık Brüt" : "Hesaplanan Aylık Brüt"}
          value={`${formatNumber(brut)} ₺`}
        />
        <ResultRow label="SGK İşçi (%14)" value={`−${formatNumber(ilkAy?.sskIsci ?? 0)} ₺`} />
        <ResultRow
          label="İşsizlik İşçi (%1)"
          value={`−${formatNumber(ilkAy?.issizlikIsci ?? 0)} ₺`}
        />
        <ResultRow label="Gelir Vergisi (Ocak)" value={`−${formatNumber(ilkAy?.gv ?? 0)} ₺`} />
        <ResultRow label="Damga Vergisi (Ocak)" value={`−${formatNumber(ilkAy?.damga ?? 0)} ₺`} />
        <ResultTotalRow label="Aylık Net (Ocak)" value={`${formatNumber(ilkAy?.net ?? 0)} ₺`} />
        <ResultRow
          label="Yıllık Net (12 ay)"
          value={`${formatNumber(sonuc.toplam.net)} ₺`}
        />
        {isverenGoster && (
          <>
            <ResultRow
              label="İşveren SGK + İşsizlik (aylık, Ocak)"
              value={`${formatNumber(
                (ilkAy?.sskIsveren ?? 0) + (ilkAy?.issizlikIsveren ?? 0),
              )} ₺`}
            />
            <ResultTotalRow
              label="İşveren Toplam Maliyet (yıllık)"
              value={`${formatNumber(sonuc.toplam.toplamMaliyet)} ₺`}
            />
          </>
        )}
      </ResultBox>

      {/* Aylık döküm tablosu */}
      <CalcCard
        className="mt-6"
        title="Aylık Bordro Dökümü"
        subtitle="Kümülatif gelir vergisi matrahı — yıl içinde dilim atlandığında aylık vergi artar, net düşer"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Ay</th>
                <th className="py-2 pr-3 text-right font-medium">Brüt</th>
                <th className="py-2 pr-3 text-right font-medium">SSK İşçi</th>
                <th className="py-2 pr-3 text-right font-medium">İşsizlik İşçi</th>
                <th className="py-2 pr-3 text-right font-medium">Gelir V.</th>
                <th className="py-2 pr-3 text-right font-medium">Damga V.</th>
                <th className="py-2 pr-3 text-right font-medium">Küm. Matrah</th>
                <th className="py-2 pr-3 text-right font-medium">Net</th>
                {isverenGoster && (
                  <>
                    <th className="py-2 pr-3 text-right font-medium">SSK İşv.</th>
                    <th className="py-2 pr-3 text-right font-medium">İşsizlik İşv.</th>
                    <th className="py-2 text-right font-medium">Toplam Maliyet</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {sonuc.satirlar.map((r) => (
                <tr key={r.ay} className="border-b border-border/50">
                  <td className="py-2 pr-3 font-medium">{AY_ADLARI[r.ay - 1]}</td>
                  <td className="py-2 pr-3 text-right font-mono tabular-nums">
                    {formatNumber(r.brut)}
                  </td>
                  <td className="py-2 pr-3 text-right font-mono tabular-nums">
                    {formatNumber(r.sskIsci)}
                  </td>
                  <td className="py-2 pr-3 text-right font-mono tabular-nums">
                    {formatNumber(r.issizlikIsci)}
                  </td>
                  <td className="py-2 pr-3 text-right font-mono tabular-nums">
                    {formatNumber(r.gv)}
                  </td>
                  <td className="py-2 pr-3 text-right font-mono tabular-nums">
                    {formatNumber(r.damga)}
                  </td>
                  <td className="py-2 pr-3 text-right font-mono tabular-nums text-muted-foreground">
                    {formatNumber(r.kumMatrah)}
                  </td>
                  <td className="py-2 pr-3 text-right font-mono tabular-nums font-medium">
                    {formatNumber(r.net)}
                  </td>
                  {isverenGoster && (
                    <>
                      <td className="py-2 pr-3 text-right font-mono tabular-nums">
                        {formatNumber(r.sskIsveren)}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono tabular-nums">
                        {formatNumber(r.issizlikIsveren)}
                      </td>
                      <td className="py-2 text-right font-mono tabular-nums font-medium">
                        {formatNumber(r.toplamMaliyet)}
                      </td>
                    </>
                  )}
                </tr>
              ))}
              <tr className="bg-muted/40 font-semibold">
                <td className="py-2 pr-3">TOPLAM</td>
                <td className="py-2 pr-3 text-right font-mono tabular-nums">
                  {formatNumber(sonuc.toplam.brut)}
                </td>
                <td className="py-2 pr-3 text-right font-mono tabular-nums">
                  {formatNumber(sonuc.toplam.sskIsci)}
                </td>
                <td className="py-2 pr-3 text-right font-mono tabular-nums">
                  {formatNumber(sonuc.toplam.issizlikIsci)}
                </td>
                <td className="py-2 pr-3 text-right font-mono tabular-nums">
                  {formatNumber(sonuc.toplam.gv)}
                </td>
                <td className="py-2 pr-3 text-right font-mono tabular-nums">
                  {formatNumber(sonuc.toplam.damga)}
                </td>
                <td className="py-2 pr-3 text-right font-mono tabular-nums text-muted-foreground">
                  —
                </td>
                <td className="py-2 pr-3 text-right font-mono tabular-nums">
                  {formatNumber(sonuc.toplam.net)}
                </td>
                {isverenGoster && (
                  <>
                    <td className="py-2 pr-3 text-right font-mono tabular-nums">
                      {formatNumber(sonuc.toplam.sskIsveren)}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono tabular-nums">
                      {formatNumber(sonuc.toplam.issizlikIsveren)}
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums">
                      {formatNumber(sonuc.toplam.toplamMaliyet)}
                    </td>
                  </>
                )}
              </tr>
            </tbody>
          </table>
        </div>
      </CalcCard>

      <div className="mt-6">
        <InfoNote>
          2026 bordro parametreleri: SGK işçi payı %14 + işsizlik %1; işveren payı %21,75 +
          işsizlik %2 (5 puanlık indirimli oran %16,75 + %2), prime esas kazanç tavanı 297.270 ₺/ay.
          Gelir vergisi kümülatif olarak hesaplanır (2026 tarifesi: %15 / %20 / %27 / %35 / %40),
          damga vergisi binde 7,59'dur. Asgari ücretin GV ve damga vergisi matrahına dâhil edilmeyen
          kısmı istisnadır (GVK ek madde). Hesaplama bilgi amaçlıdır, resmî bordro yerine geçmez.
        </InfoNote>
      </div>
    </div>
  );
}
