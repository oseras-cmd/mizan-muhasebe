import { formatInputValue, parseTurkishNumber, formatTRY } from "@/lib/finance/format";
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
import { hesaplaMaas, type MaasGirdi } from "./engine/maasHesap";

const AY_ADLARI = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

const AYLAR = Array.from({ length: 12 }, (_, i) => i + 1);

export function MaasHesap() {
  const [aylikBrut, setAylikBrut] = useState("50.000");
  const [baslangicAyi, setBaslangicAyi] = useState("1");
  const [ikramiye, setIkramiye] = useState("");
  const [ikramiyeAylari, setIkramiyeAylari] = useState<number[]>([6, 12]);
  const [zamOrani, setZamOrani] = useState("");
  const [zamAyi, setZamAyi] = useState("1");
  const [engelli, setEngelli] = useState("yok");
  const [sigorta, setSigorta] = useState("");
  const [sendika, setSendika] = useState("");
  const [asgariIstisna, setAsgariIstisna] = useState(true);
  const [medeniDurum, setMedeniDurum] = useState<"bekar" | "evli">("bekar");
  const [esCalismiyor, setEsCalismiyor] = useState(false);
  const [cocukSayisi, setCocukSayisi] = useState("0");
  const areaRef = useRef<HTMLDivElement>(null);

  const ENGELLI_2026 = [
    { id: "yok", label: "Yok", tutar: 0 },
    { id: "d1", label: "1. Derece — 12.000 ₺/ay", tutar: 12_000 },
    { id: "d2", label: "2. Derece — 7.000 ₺/ay", tutar: 7_000 },
    { id: "d3", label: "3. Derece — 3.000 ₺/ay", tutar: 3_000 },
  ];
  const engelliTutar = ENGELLI_2026.find((e) => e.id === engelli)?.tutar ?? 0;

  const girdi: MaasGirdi = useMemo(
    () => ({
      aylikBrut: parseTurkishNumber(aylikBrut) || 0,
      baslangicAyi: Math.min(12, Math.max(1, Math.round(parseTurkishNumber(baslangicAyi) || 1))),
      ikramiye: parseTurkishNumber(ikramiye) || 0,
      ikramiyeAylari,
      zamOrani: parseTurkishNumber(zamOrani) || 0,
      zamAyi: Math.min(12, Math.max(1, Math.round(parseTurkishNumber(zamAyi) || 1))),
      engelliIndirimi: engelliTutar,
      sigortaPrimi: parseTurkishNumber(sigorta) || 0,
      sendikaAidati: parseTurkishNumber(sendika) || 0,
      asgariIstisna,
      cocukSayisi: Math.max(0, Math.min(6, Math.round(parseTurkishNumber(cocukSayisi) || 0))),
      medeniDurum,
      esCalismiyor,
    }),
    [aylikBrut, baslangicAyi, ikramiye, ikramiyeAylari, zamOrani, zamAyi, engelliTutar, sigorta, sendika, asgariIstisna, cocukSayisi, medeniDurum, esCalismiyor],
  );

  const sonuc = useMemo(() => hesaplaMaas(girdi), [girdi]);

  const excelSections = [
    {
      title: "Girdiler",
      headers: ["Parametre", "Değer"],
      rows: [
        ["Aylık Brüt Maaş (TL)", girdi.aylikBrut],
        ["İşe Başlangıç Ayı", AY_ADLARI[girdi.baslangicAyi - 1]],
        ["Engelli İndirimi (aylık TL)", engelliTutar],
        ["Asgari Ücret İstisnası", girdi.asgariIstisna ? "Uygulandı" : "Uygulanmadı"],
        ["Medeni Durum", girdi.medeniDurum === "evli" ? "Evli" : "Bekar"],
        ...(girdi.medeniDurum === "evli" ? [["Eş Çalışmıyor", girdi.esCalismiyor ? "Evet" : "Hayır"] as string[]] : []),
        ["Çocuk Sayısı", girdi.cocukSayisi],
        ...(girdi.zamOrani > 0 ? [[`Zam: %${girdi.zamOrani} (${AY_ADLARI[girdi.zamAyi - 1]} ayından)`] as string[]] : []),
        ...(girdi.ikramiye > 0 ? [["İkramiye/Prim (yıllık brüt TL)", girdi.ikramiye]] : []),
        ...(girdi.sigortaPrimi > 0 ? [["Şahıs Sigorta Primi (aylık TL)", girdi.sigortaPrimi]] : []),
        ...(girdi.sendikaAidati > 0 ? [["Sendika Aidatı (aylık TL)", girdi.sendikaAidati]] : []),
      ],
    },
    {
      title: "Aylık Bordro Detayı",
      headers: [
        "Ay", "Brüt", "SSK İşçi", "İşsizlik İşçi", "Gelir Vergisi",
        "Damga Vergisi", "Küm. Vergi Matrahı", "Net", "AGİ",
        "Asg. Ücret GV İstisnası", "Asg. Ücret Damga İstisnası",
        "Net Ödenecek", "SSK İşveren", "İşsizlik İşveren", "Toplam Maliyet",
      ],
      rows: sonuc.aylar.map((a) => [
        a.ayAdi,
        a.brut, a.sgkIsci, a.issizlikIsci, a.gelirVergisi, a.damgaVergisi,
        a.kumVergiMatrah, a.net, a.asgariGecimIndirimi,
        a.asgariUcretGvIstisna, a.asgariUcretDamgaIstisna,
        a.netOdenecek, a.sgkIsveren, a.issizlikIsveren, a.toplamMaliyet,
      ].map((v, i) => i === 0 ? v : Number(v.toFixed(2)))),
      footers: [
        "TOPLAM",
        Number(sonuc.toplam.brut.toFixed(2)),
        Number(sonuc.toplam.sgkIsci.toFixed(2)),
        Number(sonuc.toplam.issizlikIsci.toFixed(2)),
        Number(sonuc.toplam.gelirVergisi.toFixed(2)),
        Number(sonuc.toplam.damgaVergisi.toFixed(2)),
        "",
        Number(sonuc.toplam.net.toFixed(2)),
        Number(sonuc.toplam.asgariGecimIndirimi.toFixed(2)),
        Number(sonuc.toplam.asgariUcretGvIstisna.toFixed(2)),
        Number(sonuc.toplam.asgariUcretDamgaIstisna.toFixed(2)),
        Number(sonuc.toplam.netOdenecek.toFixed(2)),
        Number(sonuc.toplam.sgkIsveren.toFixed(2)),
        Number(sonuc.toplam.issizlikIsveren.toFixed(2)),
        Number(sonuc.toplam.toplamMaliyet.toFixed(2)),
      ],
    },
  ];

  const fmt = (n: number) => n > 0 ? formatNumber(n) : "—";

  const tableColumns = [
    { key: "ayAdi", label: "Ay", align: "left" },
    { key: "brut", label: "Brüt", align: "right" },
    { key: "sgkIsci", label: "SSK İşçi", align: "right" },
    { key: "issizlikIsci", label: "İşsizlik İşçi", align: "right" },
    { key: "gelirVergisi", label: "Gelir Vergisi", align: "right" },
    { key: "damgaVergisi", label: "Damga Vergisi", align: "right" },
    { key: "kumVergiMatrah", label: "Küm. Vergi Matrahı", align: "right" },
    { key: "net", label: "Net", align: "right" },
    { key: "asgariGecimIndirimi", label: "AGİ", align: "right" },
    { key: "asgariUcretGvIstisna", label: "Asg. Ücret GV İstisnası", align: "right" },
    { key: "asgariUcretDamgaIstisna", label: "Asg. Ücret Damga İstisnası", align: "right" },
    { key: "netOdenecek", label: "Net Ödenecek", align: "right" },
    { key: "sgkIsveren", label: "SSK İşveren", align: "right" },
    { key: "issizlikIsveren", label: "İşsizlik İşveren", align: "right" },
    { key: "toplamMaliyet", label: "Toplam Maliyet", align: "right" },
  ] as const;

  return (
    <div className="print-area" ref={areaRef}>
      <PrintHeader
        title="Maaş Hesaplama Raporu — Brütten Nete"
        subtitle={`2026 parametreleri · Aylık brüt ${formatTRY(girdi.aylikBrut)}`}
      />
      <CalcCard
        title="Maaş Hesaplama (Brütten Nete)"
        subtitle="Aylık brüt ücretten net maaşa — 12 aylık kümülatif bordro simülasyonu"
        actions={
          <ExportButtons
            excelName="mizan-maas-hesaplama"
            excelTitle="Maaş Hesaplama — Brütten Nete (2026)"
            excelSheet="Maaş Bordro"
            excelSections={excelSections}
            pdfTargetRef={areaRef}
            pdfName="mizan-maas-hesaplama"
          />
        }
      >
        <div className="grid gap-5">
          {/* Temel girdiler */}
          <div className="grid gap-4 sm:grid-cols-3">
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
            <Field label="İşe Başlangıç Ayı">
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

          {/* AGİ / Medeni durum */}
          <div className="grid gap-4 sm:grid-cols-4">
            <Field label="Medeni Durum">
              <Segmented<"bekar" | "evli">
                options={[
                  { value: "bekar", label: "Bekar" },
                  { value: "evli", label: "Evli" },
                ]}
                value={medeniDurum}
                onChange={setMedeniDurum}
              />
            </Field>
            {medeniDurum === "evli" && (
              <Field label="Eş Çalışmıyor">
                <div className="flex h-9 items-center gap-3">
                  <Switch checked={esCalismiyor} onCheckedChange={setEsCalismiyor} />
                  <span className="text-xs text-muted-foreground">
                    {esCalismiyor ? "Evet" : "Hayır"}
                  </span>
                </div>
              </Field>
            )}
            <Field label="Çocuk Sayısı">
              <Input
                type="text"
                inputMode="numeric"
                value={cocukSayisi}
                onChange={(e) => setCocukSayisi(e.target.value.replace(/[^\d]/g, ""))}
                className="tabular-nums"
              />
            </Field>
            <Field label="Asgari Ücret İstisnası">
              <div className="flex h-9 items-center gap-3">
                <Switch checked={asgariIstisna} onCheckedChange={setAsgariIstisna} />
                <span className="text-xs text-muted-foreground">
                  {asgariIstisna ? "Uygulanıyor" : "Kapalı"}
                </span>
              </div>
            </Field>
          </div>

          {/* Detaylar */}
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
              <Field label="Şahıs Sigorta Primi (aylık ₺)">
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
        </div>
      </CalcCard>

      {/* Özet kart */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-5">
          <p className="text-xs text-muted-foreground">Yıllık Brüt</p>
          <p className="mt-1 font-mono text-xl font-semibold tabular-nums">
            {formatNumber(sonuc.toplam.brut)} ₺
          </p>
        </div>
        <div className="rounded-lg border bg-card p-5">
          <p className="text-xs text-muted-foreground">Yıllık Net Ödenecek</p>
          <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
            {formatNumber(sonuc.toplam.netOdenecek)} ₺
          </p>
        </div>
        <div className="rounded-lg border bg-card p-5">
          <p className="text-xs text-muted-foreground">Yıllık Toplam Maliyet</p>
          <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-amber-600 dark:text-amber-400">
            {formatNumber(sonuc.toplam.toplamMaliyet)} ₺
          </p>
        </div>
        <div className="rounded-lg border bg-card p-5">
          <p className="text-xs text-muted-foreground">Yıllık Gelir Vergisi</p>
          <p className="mt-1 font-mono text-xl font-semibold tabular-nums">
            {formatNumber(sonuc.toplam.gelirVergisi)} ₺
          </p>
        </div>
      </div>

      {/* Aylık bordro tablosu — Verginet mantığı */}
      <CalcCard
        className="mt-6"
        title="Brütten Nete Maaş Hesabı — Aylık Detay"
        subtitle="12 aylık kümülatif bordro: SGK, işsizlik, gelir vergisi, damga vergisi, AGİ, istisnalar ve işveren maliyeti"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                {tableColumns.map((col) => (
                  <th
                    key={col.key}
                    className={`py-2 px-1.5 font-medium whitespace-nowrap ${col.align === "right" ? "text-right" : "text-left"}`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sonuc.aylar.map((a, idx) => {
                const isToplam = a.brut === 0;
                return (
                  <tr
                    key={idx}
                    className={
                      isToplam
                        ? "border-b border-border/30 text-muted-foreground/50"
                        : "border-b border-border/50"
                    }
                  >
                    {tableColumns.map((col) => {
                      const value = a[col.key];
                      return (
                        <td
                          key={col.key}
                          className={`py-2 px-1.5 font-mono tabular-nums ${col.align === "right" ? "text-right" : "text-left font-medium"}`}
                        >
                          {col.key === "ayAdi" ? value : fmt(value as number)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-foreground/20 bg-muted/40 font-semibold">
                <td className="py-2.5 px-1.5">TOPLAM</td>
                {tableColumns.slice(1).map((col) => {
                  const value = sonuc.toplam[col.key as keyof typeof sonuc.toplam];
                  return (
                    <td
                      key={col.key}
                      className={`py-2.5 px-1.5 font-mono tabular-nums ${col.align === "right" ? "text-right" : ""}`}
                    >
                      {col.key === "kumVergiMatrah" ? "" : fmt(value as number)}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      </CalcCard>

      {/* Net maaş özeti */}
      <ResultBox className="mt-6">
        <ResultRow
          label="İlk Ay Net Maaş"
          value={formatTRY(sonuc.aylar.find((a) => a.brut > 0)?.netOdenecek ?? 0)}
        />
        <ResultRow
          label="Aylık Ortalama Net"
          value={formatTRY(sonuc.toplam.netOdenecek / 12)}
        />
        <ResultRow
          label="Aylık Ortalama İşveren Maliyeti"
          value={formatTRY(sonuc.toplam.toplamMaliyet / 12)}
          valueClassName="text-amber-600 dark:text-amber-400"
        />
        <ResultRow
          label="İşveren Maliyet / Net Oranı"
          value={`%${((sonuc.toplam.toplamMaliyet / sonuc.toplam.netOdenecek - 1) * 100).toFixed(1)}`}
        />
        <ResultTotalRow
          label="Yıllık Net Ödenecek"
          value={formatTRY(sonuc.toplam.netOdenecek)}
        />
        <ResultTotalRow
          label="Yıllık İşveren Maliyeti"
          value={formatTRY(sonuc.toplam.toplamMaliyet)}
        />
      </ResultBox>

      <div className="mt-6">
        <InfoNote>
          2026 parametreleri: SGK işçi %14, işsizlik %1, damga binde 7,59.
          SGK işveren %15,5 (5 puan indirimli), işsizlik işveren %2.
          Asgari ücret brüt 33.030 ₺ — GV ve damga vergisi istisnası uygulanır.
          Gelir vergisi 2026 tarifesi (GVK m.103): %15–20–27–35–40.
          Bu hesaplama bilgi amaçlıdır, resmi bordro yerine geçmez.
        </InfoNote>
      </div>
    </div>
  );
}
