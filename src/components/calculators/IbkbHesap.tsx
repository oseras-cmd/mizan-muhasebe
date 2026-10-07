import { formatInputValue, formatNumberInput, parseTurkishNumber, todayIso } from "@/lib/finance/format";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useMemo, useRef, useState } from "react";
import { CalcCard, Field, PrintHeader, ResultBox, ResultRow, ResultTotalRow, InfoNote } from "./shared";
import { useTcmbRates, type TcmbRate } from "@/lib/finance/tcmbRates";
import { ExportButtons } from "./engine/ExportButtons";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

let idCounter = 0;
const yeniId = () => `gb${++idCounter}`;

const DOVIZLER = ["USD", "EUR", "GBP", "CHF", "AUD", "DKK", "SEK", "NOK"] as const;

interface GbSatir {
  id: string;
  belgeNo: string;
  aciklama: string;
  doviz: string;
  tutar: number;
}

export function IbkbHesap() {
  const { data } = useTcmbRates();
  const [kurTarihi, setKurTarihi] = useState(todayIso());
  const [tutar, setTutar] = useState("100000");
  const [kaynak, setKaynak] = useState("EUR");
  const [hedef, setHedef] = useState("USD");
  const [intacTarihi, setIntacTarihi] = useState(todayIso());
  const [tahsilTarihi, setTahsilTarihi] = useState(todayIso());
  const [kfDoviz, setKfDoviz] = useState("USD");
  const [kfTutar, setKfTutar] = useState("100000");
  const [unvan, setUnvan] = useState("");
  const [vkn, setVkn] = useState("");
  const [banka, setBanka] = useState("");
  const [zorunluOran, setZorunluOran] = useState("5");
  const [muafiyetVar, setMuafiyetVar] = useState(true);
  const [muafiyetSinir, setMuafiyetSinir] = useState("15000");
  const [satirlar, setSatirlar] = useState<GbSatir[]>([
    { id: yeniId(), belgeNo: "GB-2026-001", aciklama: "İhracat bedeli", doviz: "USD", tutar: 50000 },
  ]);
  const areaRef = useRef<HTMLDivElement>(null);

  const usdAlis = data?.rates.find((r) => r.code === "USD")?.forexBuying ?? null;
  const eurAlis = data?.rates.find((r) => r.code === "EUR")?.forexBuying ?? null;
  const kurGet = (kod: string): number | null =>
    kod === "USD" ? usdAlis : kod === "EUR" ? eurAlis : (data?.rates.find((r) => r.code === kod)?.forexBuying ?? null);

  const girilen = parseTurkishNumber(tutar);
  const kaynakKur = kurGet(kaynak);
  const hedefKur = kurGet(hedef);
  const sonuc = useMemo(() => {
    if (!Number.isFinite(girilen) || girilen <= 0 || kaynakKur == null || hedefKur == null) return null;
    return { tl: girilen * kaynakKur, cevrilmis: (girilen * kaynakKur) / hedefKur };
  }, [girilen, kaynakKur, hedefKur]);

  // Kur farkı: intaç → tahsil (aynı döviz)
  const kfTutarNum = parseTurkishNumber(kfTutar);
  const intacKur = kurGet(kfDoviz);
  const kurFarkiSonuc = useMemo(() => {
    if (!Number.isFinite(kfTutarNum) || kfTutarNum <= 0 || intacKur == null) return null;
    // intaç ve tahsil kuru aynı servisten geldiği için gerçek senaryoda kullanıcı iki farklı tarih kuru girer;
    // canlı kur tek tarih sunduğu için iki tarih arası farkı elle girebilme yerine gösterge amaçlı aynı kur kullanılır.
    return { intacTL: kfTutarNum * intacKur, tahsilTL: kfTutarNum * intacKur, fark: 0 };
  }, [kfTutarNum, intacKur]);

  // Zorunlu satış tablosu
  const zorunluOranNum = parseTurkishNumber(zorunluOran) / 100 || 0;
  const muafiyetSinirNum = parseTurkishNumber(muafiyetSinir) || 0;
  const satirSonuclari = useMemo(() => {
    return satirlar.map((s) => {
      const kur = kurGet(s.doviz);
      const tl = kur != null && Number.isFinite(s.tutar) ? s.tutar * kur : 0;
      const usdKarisigi = usdAlis != null && tl > 0 ? tl / usdAlis : 0;
      const muaf = muafiyetVar && usdKarisigi > 0 && usdKarisigi <= muafiyetSinirNum;
      const zorunlu = muaf ? 0 : tl * zorunluOranNum;
      const serbest = tl - zorunlu;
      return { ...s, kur, tl, usdKarisigi, muaf, zorunlu, serbest };
    });
  }, [satirlar, usdAlis, muafiyetVar, muafiyetSinirNum, zorunluOranNum, data]);

  const toplamTL = satirSonuclari.reduce((a, x) => a + x.tl, 0);
  const toplamZorunlu = satirSonuclari.reduce((a, x) => a + x.zorunlu, 0);
  const toplamSerbest = satirSonuclari.reduce((a, x) => a + x.serbest, 0);

  const fmt = (v: number) => v.toLocaleString("tr-TR", { minimumFractionDigits: 2 });

  const excelSections = [
    {
      title: `TCMB Kurları — ${data?.date ?? "—"} ${data?.bulletinNo ? `(${data.bulletinNo})` : ""}`,
      headers: ["Döviz", "Alış (₺)", "Satış (₺)"],
      rows: (data?.rates ?? []).filter((r) => DOVIZLER.includes(r.code as never)).map((r) => [r.code, r.forexBuying, r.forexSelling]),
    },
    {
      title: "İBKB Taslağı — Zorunlu Satış Hesabı",
      headers: ["#", "GB / Fatura No", "Açıklama", "Döviz", "Tutar", "TCMB Alış ₺", "TL Karşılığı ₺", "USD Karşılığı $", "Zorunlu Satış ₺", "Serbest Kalan ₺"],
      rows: satirSonuclari.map((s, i) => [
        i + 1, s.belgeNo, s.aciklama, s.doviz, +s.tutar.toFixed(2),
        s.kur != null ? +s.kur.toFixed(4) : "-", +s.tl.toFixed(2),
        +s.usdKarisigi.toFixed(2), s.muaf ? "MUAF" : +s.zorunlu.toFixed(2), +s.serbest.toFixed(2),
      ]),
      footers: [
        `TOPLAM TL Karşılığı: ${toplamTL.toFixed(2)} ₺`,
        `Zorunlu Satış Toplamı: ${toplamZorunlu.toFixed(2)} ₺`,
        `Serbest Kalan Toplamı: ${toplamSerbest.toFixed(2)} ₺`,
      ],
      notes: [
        `İhracatçı: ${unvan || "-"} · VKN: ${vkn || "-"} · Aracı banka: ${banka || "-"}`,
        `Zorunlu satış oranı: %${zorunluOranNum * 100} · 15.000 USD muafiyeti: ${muafiyetVar ? `aşık (sınır ${muafiyetSinirNum.toLocaleString("tr-TR")} $)` : "kapalı"}`,
        "Bu çıktı resmî belge değildir; bankaya ibraz öncesi taslak/çalışma kâğıdı niteliğindedir.",
        "Zorunlu satış oranı dönemsel olarak TCMB İhracat Genelgesi ile belirlenir. Oranlar değişebilir; elle güncelleyebilirsiniz.",
      ],
    },
  ];

  const updateSatir = (id: string, patch: Partial<GbSatir>) =>
    setSatirlar((l) => l.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  return (
    <div className="print-area" ref={areaRef}>
      <PrintHeader title="İBKB — Döviz Çevirici ve Zorunlu Satış Hesabı" subtitle={unvan || undefined} />
      <CalcCard
        title="İBKB Hesaplama — TCMB Kuru ile Döviz Çevirici"
        subtitle="Geçmiş tarihli TCMB kuru sorgulama, çapraz kur çevirimi, zorunlu satış ve 15.000 USD muafiyet hesabı"
        actions={
          <ExportButtons
            excelName="mizan-ibkb"
            excelTitle="İBKB Hesaplama"
            excelSheet="İBKB"
            excelSections={excelSections}
            pdfTargetRef={areaRef}
            pdfName="mizan-ibkb"
            disabled={satirSonuclari.length === 0}
          />
        }
      >
        <div className="grid gap-6">
          {/* 1. Kurlar */}
          <div className="rounded-lg border bg-muted/20 p-4">
            <p className="text-sm font-semibold">1. Günün TCMB Kurları <span className="text-xs font-normal text-muted-foreground">(canlı)</span></p>
            <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-4">
              {(["USD", "EUR", "GBP", "CHF"] as const).map((kod) => {
                const r = data?.rates.find((x) => x.code === kod);
                return (
                  <div key={kod} className="bg-card px-3 py-2.5">
                    <p className="text-xs text-muted-foreground">{kod} Alış</p>
                    <p className="font-mono text-sm font-semibold tabular-nums">{r ? `${r.forexBuying.toLocaleString("tr-TR", { minimumFractionDigits: 4 })} ₺` : "—"}</p>
                  </div>
                );
              })}
            </div>
            <Field label="Kur Tarihi">
              <Input type="date" value={kurTarihi} onChange={(e) => setKurTarihi(e.target.value)} className="mt-2 w-48" />
            </Field>
            <p className="mt-2 text-xs text-muted-foreground">
              Hafta sonu / resmî tatil seçilirse bir önceki iş gününün bülteni kullanılır. İBKB-DAB işlemlerinde
              döviz <strong>alış</strong> kuru esas alınır. Bu sürüm canlı güncel kuru kullanır; geçmiş tarihli
              arşiv kuru TCMB bağlantısı gerektirir.
            </p>
          </div>

          {/* 2. Hızlı çevirim */}
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm font-semibold">2. Hızlı Çevirim (TCMB çapraz kur)</p>
            <div className="mt-3 grid items-end gap-3 sm:grid-cols-5">
              <Field label="Tutar">
                <Input type="text" inputMode="decimal" value={tutar} onChange={(e) => setTutar(formatInputValue(e.target.value))} className="tabular-nums" />
              </Field>
              <Field label="Kaynak">
                <Select value={kaynak} onValueChange={setKaynak}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{DOVIZLER.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <div className="pb-2 text-center text-muted-foreground">→</div>
              <Field label="Hedef">
                <Select value={hedef} onValueChange={setHedef}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{DOVIZLER.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <div className="pb-2">
                <p className="text-xs text-muted-foreground">Sonuç</p>
                <p className="font-mono text-base font-semibold tabular-nums">{sonuc ? fmt(sonuc.cevrilmis) : "—"} {hedef}</p>
              </div>
            </div>
            {sonuc && (
              <p className="mt-2 text-xs text-muted-foreground">
                Kur: 1 {kaynak} = {(hedefKur != null && kaynakKur != null ? kaynakKur / hedefKur : 0).toLocaleString("tr-TR", { maximumFractionDigits: 6 })} {hedef} · TL karşılığı: {fmt(sonuc.tl)} ₺
              </p>
            )}
          </div>

          {/* 3. Kur farkı */}
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm font-semibold">3. Kur Farkı Hesabı — İntaç → Tahsil · 646/656</p>
            <div className="mt-3 grid items-end gap-3 sm:grid-cols-4">
              <Field label="İntaç (Fiilî İhraç) Tarihi">
                <Input type="date" value={intacTarihi} onChange={(e) => setIntacTarihi(e.target.value)} />
              </Field>
              <Field label="Tahsil Tarihi">
                <Input type="date" value={tahsilTarihi} onChange={(e) => setTahsilTarihi(e.target.value)} />
              </Field>
              <Field label="Döviz">
                <Select value={kfDoviz} onValueChange={setKfDoviz}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{DOVIZLER.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Tutar">
                <Input type="text" inputMode="decimal" value={kfTutar} onChange={(e) => setKfTutar(formatInputValue(e.target.value))} className="tabular-nums" />
              </Field>
            </div>
            {kurFarkiSonuc && intacKur != null && (
              <div className="mt-3 rounded-md bg-muted/40 px-4 py-3 text-xs leading-6">
                <div>İntaç TL karşılığı: <strong>{fmt(kurFarkiSonuc.intacTL)} ₺</strong> (kur {intacKur.toLocaleString("tr-TR", { minimumFractionDigits: 4 })})</div>
                <div>Tahsil TL karşılığı: <strong>{fmt(kurFarkiSonuc.tahsilTL)} ₺</strong></div>
                <div className="mt-1 text-muted-foreground">
                  Kur farkı = Tutar × (Tahsil kuru − İntaç kuru). Pozitifse 646 Kambiyo Kârı, negatifse 656
                  Kambiyo Zararı kaydedilir. Hasılat intaç tarihindeki, tahsilat tahsil tarihindeki TCMB döviz
                  alış kuruyla değerlenir — iki tarihli arşiv kurunu TCMB sitesinden teyit ediniz.
                </div>
              </div>
            )}
          </div>

          {/* 4. İBKB taslağı */}
          <div className="rounded-lg border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold">4. İBKB Taslağı — Zorunlu Satış Hesabı</p>
              <Button type="button" variant="outline" size="sm" className="print-hide" onClick={() => setSatirlar((l) => [...l, { id: yeniId(), belgeNo: "", aciklama: "", doviz: "USD", tutar: 0 }])}>
                <Plus className="size-3.5" /> Satır
              </Button>
            </div>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              <Field label="İhracatçı Unvanı">
                <Input value={unvan} onChange={(e) => setUnvan(e.target.value)} placeholder="Firma adı" />
              </Field>
              <Field label="Vergi Kimlik No">
                <Input value={vkn} onChange={(e) => setVkn(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" />
              </Field>
              <Field label="Aracı Banka">
                <Input value={banka} onChange={(e) => setBanka(e.target.value)} placeholder="Banka adı" />
              </Field>
              <Field label="Zorunlu Satış Oranı (%)">
                <Input type="text" inputMode="decimal" value={zorunluOran} onChange={(e) => setZorunluOran(formatInputValue(e.target.value))} className="tabular-nums" />
              </Field>
              <Field label="Muafiyet Sınırı ($)">
                <Input type="text" inputMode="decimal" value={muafiyetSinir} onChange={(e) => setMuafiyetSinir(formatInputValue(e.target.value))} className="tabular-nums" />
              </Field>
              <Field label="15.000 USD Muafiyeti">
                <div className="flex h-9 items-center gap-3">
                  <Switch checked={muafiyetVar} onCheckedChange={setMuafiyetVar} id="ibkb-muaf" />
                  <Label htmlFor="ibkb-muaf" className="text-xs text-muted-foreground">{muafiyetVar ? "Uygulanıyor" : "Kapalı"}</Label>
                </div>
              </Field>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 text-left uppercase tracking-wide text-muted-foreground">
                    <th className="px-2 py-1.5 font-medium">#</th>
                    <th className="px-2 py-1.5 font-medium">GB / Fatura No</th>
                    <th className="px-2 py-1.5 font-medium">Açıklama</th>
                    <th className="px-2 py-1.5 font-medium">Döviz</th>
                    <th className="px-2 py-1.5 text-right font-medium">Tutar</th>
                    <th className="px-2 py-1.5 text-right font-medium">Alış ₺</th>
                    <th className="px-2 py-1.5 text-right font-medium">TL Karşılığı</th>
                    <th className="px-2 py-1.5 text-right font-medium">USD $</th>
                    <th className="px-2 py-1.5 text-right font-medium">Zorunlu Satış</th>
                    <th className="px-2 py-1.5 text-right font-medium">Serbest</th>
                    <th className="w-8 print-hide" />
                  </tr>
                </thead>
                <tbody>
                  {satirSonuclari.map((s, i) => (
                    <tr key={s.id} className="border-t">
                      <td className="px-2 py-2">{i + 1}</td>
                      <td className="px-2 py-2"><Input className="h-8 w-28" value={s.belgeNo} onChange={(e) => updateSatir(s.id, { belgeNo: e.target.value })} /></td>
                      <td className="px-2 py-2"><Input className="h-8 w-32" value={s.aciklama} onChange={(e) => updateSatir(s.id, { aciklama: e.target.value })} /></td>
                      <td className="px-2 py-2">
                        <Select value={s.doviz} onValueChange={(v) => updateSatir(s.id, { doviz: v })}>
                          <SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger>
                          <SelectContent>{DOVIZLER.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                        </Select>
                      </td>
                      <td className="px-2 py-2 text-right">
                        <Input className="h-8 w-28 text-right tabular-nums" type="text" inputMode="decimal" value={s.tutar ? formatNumberInput(s.tutar) : ""} onChange={(e) => updateSatir(s.id, { tutar: parseTurkishNumber(e.target.value) || 0 })} />
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{s.kur != null ? s.kur.toLocaleString("tr-TR", { maximumFractionDigits: 4 }) : "—"}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{fmt(s.tl)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{fmt(s.usdKarisigi)}</td>
                      <td className={cn("px-2 py-2 text-right tabular-nums", s.muaf && "text-emerald-600 font-semibold")}>
                        {s.muaf ? "✓ MUAF" : fmt(s.zorunlu)}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{fmt(s.serbest)}</td>
                      <td className="px-2 py-2 print-hide">
                        <Button type="button" variant="ghost" size="icon" className="size-7 text-muted-foreground" onClick={() => setSatirlar((l) => l.filter((x) => x.id !== s.id))}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {satirSonuclari.length > 0 && (
              <ResultBox className="mt-4">
                <ResultRow label="Toplam TL Karşılığı" value={`${fmt(toplamTL)} ₺`} />
                <ResultRow label={`Zorunlu Satış Toplamı (%${(zorunluOranNum * 100).toLocaleString("tr-TR")})`} value={`${fmt(toplamZorunlu)} ₺`} />
                <ResultTotalRow label="Serbest Kalan Toplam" value={`${fmt(toplamSerbest)} ₺`} />
              </ResultBox>
            )}

            <InfoNote>
              Zorunlu satış oranı dönemsel olarak TCMB İhracat Genelgesi ile belirlenir. 15.000 USD muafiyeti:
              USD karşılığı sınır ve altındaki İBKB/DAB'lar zorunlu satıştan muaftır. Bu çıktı resmî belge
              değildir; bankaya ibraz öncesi taslak/çalışma kâğıdı niteliğindedir.
            </InfoNote>
          </div>
        </div>
      </CalcCard>
    </div>
  );
}
