import { formatInputValue, parseTurkishNumber } from "@/lib/finance/format";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useMemo, useRef, useState } from "react";
import {
  CalcCard,
  Field,
  PrintHeader,
  ResultBox,
  ResultRow,
  ResultTotalRow,
  Segmented,
  InfoNote,
  formatNumber,
} from "./shared";
import { ExportButtons } from "./engine/ExportButtons";
import {
  hesaplaYillik,
  simuleEt,
  yilOzeti,
  gerekliBrut,
  dilimleriGetir,
  type GelirTuru,
} from "./engine/gelirVergisiDilim";

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

const ENGELLI_2026 = [
  { id: "yok", label: "Yok", tutar: 0 },
  { id: "d1", label: "1. Derece — 12.000 ₺/ay", tutar: 12_000 },
  { id: "d2", label: "2. Derece — 7.000 ₺/ay", tutar: 7_000 },
  { id: "d3", label: "3. Derece — 3.000 ₺/ay", tutar: 3_000 },
];

type Sekil = "aylik" | "yillik";

const AYLAR = Array.from({ length: 12 }, (_, i) => i + 1);

export function GelirVergisiDilimHesap() {
  const [sekil, setSekil] = useState<Sekil>("aylik");
  const [gelirTuru, setGelirTuru] = useState<GelirTuru>("ucret");
  const [aylikBrut, setAylikBrut] = useState("40.000");
  const [yillikTutar, setYillikTutar] = useState("500.000");
  const [baslangicAyi, setBaslangicAyi] = useState("1");
  const [engelli, setEngelli] = useState("yok");
  const [zamOrani, setZamOrani] = useState("");
  const [zamAyi, setZamAyi] = useState("1");
  const [ikramiye, setIkramiye] = useState("");
  const [ikramiyeAylari, setIkramiyeAylari] = useState<number[]>([6, 12]);
  const [sigorta, setSigorta] = useState("");
  const [sendika, setSendika] = useState("");
  const [asgariIstisna, setAsgariIstisna] = useState(true);
  const [hedefNet, setHedefNet] = useState("");
  const areaRef = useRef<HTMLDivElement>(null);

  const engelliTutar = ENGELLI_2026.find((e) => e.id === engelli)?.tutar ?? 0;

  const giris = useMemo(
    () => ({
      aylikBrut: parseTurkishNumber(aylikBrut) || 0,
      baslangicAyi: Math.min(12, Math.max(1, Math.round(parseTurkishNumber(baslangicAyi) || 1))),
      engelliIndirimi: engelliTutar,
      zamOrani: parseTurkishNumber(zamOrani) || 0,
      zamAyi: Math.min(12, Math.max(1, Math.round(parseTurkishNumber(zamAyi) || 1))),
      ikramiye: parseTurkishNumber(ikramiye) || 0,
      ikramiyeAylari: ikramiyeAylari,
      sigortaPrimi: parseTurkishNumber(sigorta) || 0,
      sendikaAidati: parseTurkishNumber(sendika) || 0,
      asgariIstisna,
      gelirTuru,
    }),
    [aylikBrut, baslangicAyi, engelliTutar, zamOrani, zamAyi, ikramiye, ikramiyeAylari, sigorta, sendika, asgariIstisna, gelirTuru],
  );

  const detay = useMemo(() => simuleEt(giris), [giris]);
  const ozet = useMemo(() => yilOzeti(detay), [detay]);

  // Aylık mod: tek ayın dilimine odaklan (ya da yıl özetini göster)
  const yillikMatrah = sekil === "yillik" ? parseTurkishNumber(yillikTutar) || 0 : ozet.toplamMatrah;
  const yillik = useMemo(
    () => hesaplaYillik(yillikMatrah, gelirTuru),
    [yillikMatrah, gelirTuru],
  );

  const hedefNetSayi = parseTurkishNumber(hedefNet) || 0;
  const gerekenBrut = useMemo(
    () => {
      if (hedefNetSayi <= 0) return null;
      const { aylikBrut: _omitted, ...rest } = giris;
      return gerekliBrut(hedefNetSayi, rest);
    },
    [hedefNetSayi, giris],
  );
  const dilimler = dilimleriGetir(gelirTuru);

  const atlamaAylari = detay.filter((d) => d.atladi);
  const excelSections = [
    {
      title: "Girdiler",
      headers: ["Parametre", "Değer"],
      rows: [
        ["Gelir Türü", gelirTuru === "ucret" ? "Ücret (bordro)" : "Ücret dışı (kira/serbest meslek)"],
        ["Mod", sekil === "aylik" ? "Aylık kümülatif simülasyon" : "Yıllık tek seferde"],
        sekil === "aylik" ? ["Aylık Brüt Maaş (TL)", giris.aylikBrut] : ["Yıllık Matrah (TL)", yillikMatrah],
        ["Engelli İndirimi (aylık TL)", engelliTutar],
        ...(giris.zamOrani > 0 ? [[`Zam: %${giris.zamOrani} (${AY_ADLARI[giris.zamAyi - 1]} ayından)`] as string[]] : []),
        ...(giris.ikramiye > 0 ? [["İkramiye/Prim (yıllık brüt TL)", giris.ikramiye]] : []),
        ...(giris.sigortaPrimi > 0 ? [["Şahıs Sigorta Primi (aylık TL)", giris.sigortaPrimi]] : []),
        ...(giris.sendikaAidati > 0 ? [["Sendika Aidatı (aylık TL)", giris.sendikaAidati]] : []),
        ["Asgari Ücret GV İstisnası", asgariIstisna ? "Uygulandı" : "Uygulanmadı"],
      ],
    },
    {
      title: "Yıl Sonu Özeti",
      headers: ["Kalem", "Tutar (TL)"],
      rows: [
        ["Yıllık Brüt", Number(ozet.yillikBrut.toFixed(2))],
        ["Toplam GV Matrahı", Number(ozet.toplamMatrah.toFixed(2))],
        ["Asgari Ücret İstisnası", Number(ozet.toplamIstisna.toFixed(2))],
        ["Toplam Gelir Vergisi", Number(ozet.toplamGv.toFixed(2))],
        ["Toplam Damga Vergisi", Number(ozet.toplamDamga.toFixed(2))],
        ["Toplam SGK (İşçi)", Number(ozet.toplamSgkIsci.toFixed(2))],
        ["Yıllık Net", Number(ozet.yillikNet.toFixed(2))],
        ["İşveren Toplam Maliyeti", Number(ozet.isverenMaliyet.toFixed(2))],
      ],
      footers: [`Efektif Vergi Oranı: %${(ozet.efektifOran * 100).toFixed(2)}`],
      notes: [
        "2026 tarifesi: GVK m.103 — Gelir Vergisi Genel Tebliği (Seri No: 332).",
        "SGK işçi %15 (işsizlik dâhil, tavan 297.270 ₺/ay), damga binde 7,59.",
        "Asgari ücret istisnası: asgari ücrete isabet eden GV + damga muaf (GVK ek md.).",
      ],
    },
    {
      title: "Aylık Detay",
      headers: ["Ay", "Brüt", "GV Matrahı", "Küm. Matrah", "GV", "Damga", "Dilim", "Net"],
      rows: detay.map((d) => [
        AY_ADLARI[d.ay - 1],
        Number(d.brüt.toFixed(2)),
        Number(d.matrah.toFixed(2)),
        Number(d.kumMatrah.toFixed(2)),
        Number(d.gv.toFixed(2)),
        Number(d.damga.toFixed(2)),
        `${d.dilim}. dilim${d.atladi ? " (ATLADI)" : ""}`,
        Number(d.net.toFixed(2)),
      ]),
    },
  ];

  return (
    <div className="print-area" ref={areaRef}>
      <PrintHeader
        title="Gelir Vergisi Dilim Simülasyonu Raporu"
        subtitle={`2026 tarifesi · ${gelirTuru === "ucret" ? "Ücret" : "Ücret dışı"} · ${sekil === "aylik" ? "Aylık kümülatif" : "Yıllık"}`}
      />
      <CalcCard
        title="Gelir Vergisi Dilim Simülatörü"
        subtitle="2026 dilimleriyle kümülatif matrah, dilim atlama, net maaş ve işveren maliyeti"
        actions={
          <ExportButtons
            excelName="mizan-gelir-vergisi-dilim"
            excelTitle="Gelir Vergisi Dilim Simülasyonu"
            excelSheet="GV Dilim"
            excelSections={excelSections}
            pdfTargetRef={areaRef}
            pdfName="mizan-gelir-vergisi-dilim"
          />
        }
      >
        <div className="grid gap-5">
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Hesaplama Şekli">
              <Segmented<Sekil>
                options={[
                  { value: "aylik", label: "Aylık Simülasyon" },
                  { value: "yillik", label: "Yıllık" },
                ]}
                value={sekil}
                onChange={setSekil}
              />
            </Field>
            <Field label="Gelir Türü">
              <Segmented<GelirTuru>
                options={[
                  { value: "ucret", label: "Ücret" },
                  { value: "ucretDisi", label: "Ücret Dışı" },
                ]}
                value={gelirTuru}
                onChange={setGelirTuru}
              />
            </Field>
            <Field label="Engelli İndirimi">
              <Select value={engelli} onValueChange={setEngelli}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENGELLI_2026.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          {sekil === "aylik" ? (
            <div className="grid gap-5 sm:grid-cols-3">
              <Field label="Aylık Brüt Maaş (₺)">
                <Input
                  type="text"
                  inputMode="decimal"
                  value={aylikBrut}
                  onChange={(e) => setAylikBrut(formatInputValue(e.target.value))}
                  placeholder="0,00"
                  className="tabular-nums"
                />
              </Field>
              <Field label="İşe Giriş Ayı">
                <Select value={String(baslangicAyi)} onValueChange={(v) => setBaslangicAyi(v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AYLAR.map((a) => (
                      <SelectItem key={a} value={String(a)}>
                        {AY_ADLARI[a - 1]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Asgari Ücret İstisnası">
                <div className="flex h-9 items-center gap-3">
                  <Switch checked={asgariIstisna} onCheckedChange={setAsgariIstisna} />
                  <span className="text-xs text-muted-foreground">
                    {asgariIstisna ? "Uygulanıyor (2025+ bordro)" : "Kapalı"}
                  </span>
                </div>
              </Field>
            </div>
          ) : (
            <Field label="Yıllık Gelir / Matrah (₺)">
              <Input
                type="text"
                inputMode="decimal"
                value={yillikTutar}
                onChange={(e) => setYillikTutar(formatInputValue(e.target.value))}
                placeholder="0,00"
                className="tabular-nums"
              />
            </Field>
          )}

          {sekil === "aylik" && (
            <details className="rounded-md border border-border/70 px-4 py-3">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                Zam, ikramiye ve kesinti detayları
              </summary>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <Field label="Zam Oranı (%)">
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={zamOrani}
                    onChange={(e) => setZamOrani(formatInputValue(e.target.value))}
                    placeholder="ör. 30"
                    className="tabular-nums"
                  />
                </Field>
                <Field label="Zam Ayı">
                  <Select value={String(zamAyi)} onValueChange={(v) => setZamAyi(v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AYLAR.map((a) => (
                        <SelectItem key={a} value={String(a)}>
                          {AY_ADLARI[a - 1]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="İkramiye / Prim (yıllık brüt ₺)">
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={ikramiye}
                    onChange={(e) => setIkramiye(formatInputValue(e.target.value))}
                    placeholder="0,00"
                    className="tabular-nums"
                  />
                </Field>
                <Field label="İkramiye Ödenen Aylar" hint="Seçili aylara eşit bölünür.">
                  <div className="flex flex-wrap gap-1">
                    {AYLAR.map((a) => {
                      const on = ikramiyeAylari.includes(a);
                      return (
                        <button
                          key={a}
                          type="button"
                          onClick={() =>
                            setIkramiyeAylari((prev) =>
                              prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a].sort(),
                            )
                          }
                          className={
                            on
                              ? "rounded-md bg-foreground px-2 py-1 text-[11px] font-medium text-background"
                              : "rounded-md border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
                          }
                        >
                          {AY_ADLARI[a - 1].slice(0, 3)}
                        </button>
                      );
                    })}
                  </div>
                </Field>
                <Field
                  label="Şahıs Sigorta Primi (aylık ₺)"
                  hint="GVK 63/3: brütün %15'i ve yıllık asgari ücret brütüyle sınırlı."
                >
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={sigorta}
                    onChange={(e) => setSigorta(formatInputValue(e.target.value))}
                    placeholder="0,00"
                    className="tabular-nums"
                  />
                </Field>
                <Field label="Sendika Aidatı (aylık ₺)">
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={sendika}
                    onChange={(e) => setSendika(formatInputValue(e.target.value))}
                    placeholder="0,00"
                    className="tabular-nums"
                  />
                </Field>
              </div>
            </details>
          )}
        </div>
      </CalcCard>

      {/* Yıl sonu özeti */}
      <ResultBox className="mt-6">
        <ResultRow label="Yıllık Brüt" value={`${formatNumber(ozet.yillikBrut)} ₺`} />
        <ResultRow
          label="Asgari Ücret İstisnası"
          value={ozet.toplamIstisna > 0 ? `−${formatNumber(ozet.toplamIstisna)} ₺` : "—"}
        />
        <ResultRow label="Toplam GV Matrahı" value={`${formatNumber(ozet.toplamMatrah)} ₺`} />
        <ResultRow label="Toplam Gelir Vergisi" value={`${formatNumber(ozet.toplamGv)} ₺`} />
        <ResultRow label="Toplam Damga Vergisi" value={`${formatNumber(ozet.toplamDamga)} ₺`} />
        <ResultRow label="Toplam SGK (İşçi)" value={`${formatNumber(ozet.toplamSgkIsci)} ₺`} />
        <ResultTotalRow
          label="Efektif Vergi Oranı"
          value={`%${(ozet.efektifOran * 100).toFixed(2)}`}
        />
        <ResultTotalRow label="Yıllık Net" value={`${formatNumber(ozet.yillikNet)} ₺`} />
        <ResultTotalRow
          label="İşveren Toplam Maliyeti"
          value={`${formatNumber(ozet.isverenMaliyet)} ₺`}
        />
      </ResultBox>

      {/* Dilim dağılımı */}
      <CalcCard
        className="mt-6"
        title="GV Dilimleri 2026"
        subtitle={gelirTuru === "ucret" ? "Ücret gelirleri tarifesi" : "Ücret dışı gelirler tarifesi"}
      >
        <div className="grid gap-2 sm:grid-cols-5">
          {dilimler.map((d, i) => {
            const aktif = yillik.kalemler.some((k) => k.sira === i + 1);
            return (
              <div
                key={i}
                className={
                  aktif
                    ? "rounded-lg border-2 border-foreground bg-muted/40 p-3 text-center"
                    : "rounded-lg border border-border/70 p-3 text-center opacity-60"
                }
              >
                <p className="text-[11px] text-muted-foreground">
                  {d.ust === null
                    ? `${formatNumber(d.alt, 0)} ₺ üzeri`
                    : `${formatNumber(d.alt, 0)} – ${formatNumber(d.ust, 0)} ₺`}
                </p>
                <p className="mt-1 font-mono text-lg font-semibold tabular-nums">
                  %{d.oran * 100}
                </p>
              </div>
            );
          })}
        </div>
        {yillik.kalemler.length > 0 && (
          <div className="mt-4 space-y-1.5">
            {yillik.kalemler.map((k) => (
              <div key={k.sira} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {k.sira}. dilim — {formatNumber(k.matrah)} ₺ × %{k.oran * 100}
                </span>
                <span className="font-mono tabular-nums font-medium">
                  {formatNumber(k.vergi)} ₺
                </span>
              </div>
            ))}
          </div>
        )}
      </CalcCard>

      {/* Aylık detay tablosu — yalnız aylık modda */}
      {sekil === "aylik" && (
        <CalcCard
          className="mt-6"
          title="Kümülatif Matrah ve Dilim Eşikleri"
          subtitle={
            atlamaAylari.length > 0
              ? `Dilim atlama: ${atlamaAylari.map((d) => AY_ADLARI[d.ay - 1]).join(", ")} aylarında bir üst dilime geçiliyor`
              : "Bu maaşla yıl içinde dilim atlanmıyor"
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Ay</th>
                  <th className="py-2 pr-3 text-right font-medium">Brüt</th>
                  <th className="py-2 pr-3 text-right font-medium">GV Matrahı</th>
                  <th className="py-2 pr-3 text-right font-medium">Küm. Matrah</th>
                  <th className="py-2 pr-3 text-right font-medium">GV</th>
                  <th className="py-2 pr-3 text-right font-medium">Damga</th>
                  <th className="py-2 pr-3 text-center font-medium">Dilim</th>
                  <th className="py-2 text-right font-medium">Net</th>
                </tr>
              </thead>
              <tbody>
                {detay.map((d) => (
                  <tr
                    key={d.ay}
                    className={
                      d.atladi
                        ? "border-b border-border/50 bg-amber-500/[0.07]"
                        : "border-b border-border/50"
                    }
                  >
                    <td className="py-2 pr-3 font-medium">{AY_ADLARI[d.ay - 1]}</td>
                    <td className="py-2 pr-3 text-right font-mono tabular-nums">
                      {d.brüt > 0 ? formatNumber(d.brüt) : "—"}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono tabular-nums">
                      {d.brüt > 0 ? formatNumber(d.matrah) : "—"}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono tabular-nums">
                      {formatNumber(d.kumMatrah)}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono tabular-nums">
                      {formatNumber(d.gv)}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono tabular-nums">
                      {formatNumber(d.damga)}
                    </td>
                    <td className="py-2 pr-3 text-center">
                      <span
                        className={
                          d.atladi
                            ? "inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400"
                            : "text-muted-foreground"
                        }
                      >
                        {d.dilim}. dilim{d.atladi ? " · ATLADI" : ""}
                      </span>
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums font-medium">
                      {d.brüt > 0 ? formatNumber(d.net) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CalcCard>
      )}

      {/* Net'ten brüte */}
      {sekil === "aylik" && (
        <CalcCard className="mt-6" title="Net'ten Brüt'e Çevir">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <Field label="Hedef net maaş (ilk ay, ₺)">
              <Input
                type="text"
                inputMode="decimal"
                value={hedefNet}
                onChange={(e) => setHedefNet(formatInputValue(e.target.value))}
                placeholder="ör. 30.000"
                className="tabular-nums"
              />
            </Field>
            <ResultBox className="sm:w-72">
              <ResultTotalRow
                label="Gereken brüt"
                value={gerekenBrut ? `${formatNumber(gerekenBrut)} ₺` : "—"}
              />
            </ResultBox>
          </div>
          <div className="mt-4">
            <InfoNote>
              Hedef net, ilk ay için hesaplanır; yıl ilerledikçe dilim atlamaları nedeniyle net
              düşer. Yukarıdaki aylık tablodan takip edebilirsiniz.
            </InfoNote>
          </div>
        </CalcCard>
      )}

      <div className="mt-6">
        <InfoNote>
          2026 tarifesi GVK m.103, Gelir Vergisi Genel Tebliği (Seri No: 332) — 31.12.2025 tarihli
          Resmî Gazete. Ücret ile ücret dışı tarifeler 3. dilimden itibaren farklıdır (1.500.000 ₺ /
          1.000.000 ₺ eşiği). SGK işçi payı %15 (tavan 297.270 ₺/ay), damga vergisi binde 7,59;
          asgari ücrete isabet eden GV ve damga istisnadır. Bu hesaplama bilgi amaçlıdır, resmi
          bordro yerine geçmez.
        </InfoNote>
      </div>
    </div>
  );
}
