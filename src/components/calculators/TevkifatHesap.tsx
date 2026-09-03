import { formatInputValue } from "@/lib/finance/format";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatTRY, parseTurkishNumber } from "@/lib/finance/format";
import { useMemo, useState } from "react";
import { CalcCard, Field, InfoNote } from "./shared";

/* ─── Tevkifat Oranları — KDV Tebliği Seri No 1 ────────── */
const TEVKIFAT_OPTIONS = [
  { pay: 1, total: 10, label: "1/10", desc: "Basın, yayın ve matbaacılık hizmetleri" },
  { pay: 2, total: 10, label: "2/10", desc: "İnşaat (taahhüt) işleri" },
  { pay: 3, total: 10, label: "3/10", desc: "Onarım ve bakım hizmetleri (basit tamir hariç)" },
  { pay: 4, total: 10, label: "4/10", desc: "Her türlü yemek üretimi, yemek servisi ve toplu yemek hizmeti" },
  { pay: 5, total: 10, label: "5/10", desc: "Danışmanlık, mühendislik, mimarlık, AR-Ge, yazılım, muhasebe, avukatlık, eczacılık, spor kulüpleri, e-öğrenme, online reklamcılık, telekomünikasyon, dijital oyun, tasarım hizmetleri" },
  { pay: 6, total: 10, label: "6/10", desc: "Makine, teçhizat, demirbaş ve taşınmaz kiralanması ile her türlü kira, leasing" },
  { pay: 7, total: 10, label: "7/10", desc: "Bina, yapı ve tesis inşaatı, soğuk hava deposu kiralanması, prefabrike yapı ve çelik konstrüksiyon" },
  { pay: 8, total: 10, label: "8/10", desc: "Meliorasyon, ağaç ve benzeri ekim işleri, fidan, fide ve süs bitkisi üretimi" },
  { pay: 9, total: 10, label: "9/10", desc: "Metal, ağaç ve plastikten eşya üretimi, motorlu taşıt tamiri, mobilya imalatı, tekstil, deri, imalat sanayii" },
  { pay: 10, total: 10, label: "10/10", desc: "İkinci el mal satışı, ikinci el kara taşıtı satışı, internet ortamında verilen reklam hizmetleri (Google, Facebook vb.)" },
];

const KDV_ORANLARI = [
  { value: "20", label: "%20" },
  { value: "10", label: "%10" },
  { value: "1", label: "%1" },
  { value: "0", label: "%0 (İstisna)" },
];

/* ─── Yardımcı ───────────────────────────────────────────── */
const NUM = (v: string) => parseTurkishNumber(v);
const ROUND2 = (n: number) => Math.round(n * 100) / 100;

interface CalcResult {
  /* Genel */
  kdvHaric: number;
  kdvOrani: number;
  kdvTutari: number;
  kdvDahil: number;
  tevPay: number;
  tevTotal: number;
  faturaAltSinir: number;
  tevkifEdilenTutar: number;
  hesaplananKdv: number;
  genelToplam: number;

  /* e-Belge */
  malHizmetToplam: number;
  eBelgeKdv: number;
  tevkifataTabiTutar: number;
  tevkifataTabiKdv: number;
  kdvTevkifat: number;
  vergilerDahil: number;
  odenecek: number;

  /* Satış KDV 1 Beyanname */
  satisMatrah: number;
  satisKdvOrani: number;
  satisKdvKodu: string;
  satisTevOrani: string;
  satisTevVergi: number;

  /* Satış Bildirim Eki */
  satisBildirimTutar: number;
  satisBildirimKdvOrani: number;
  satisBildirimKdvHes: number;
  satisBildirimTevOrani: string;
  satisBildirimTevTutar: number;

  /* Alış KDV 1 Beyanname */
  alisIndirimTuru: string;
  alisVergi: number;
  alisYurtIciKdv: number;
  alisSorumluKdv: number;

  /* KDV 2 Beyanname */
  kdv2Matrah: number;
  kdv2Oran: number;
  kdv2Kodu: string;
  kdv2TevOrani: string;
  kdv2Vergi: number;
}

function compute(matrah: string, kdvOranStr: string, tevIndex: string): CalcResult | null {
  const kdvHaric = NUM(matrah);
  const kdvOrani = Number(kdvOranStr) / 100;
  const option = TEVKIFAT_OPTIONS[Number(tevIndex)] ?? TEVKIFAT_OPTIONS[0];
  const tevPay = option.pay;
  const tevTotal = option.total;
  const tevOrani = tevPay / tevTotal;

  if (!Number.isFinite(kdvHaric) || kdvHaric <= 0) return null;

  const kdvTutari = ROUND2(kdvHaric * kdvOrani);
  const kdvDahil = ROUND2(kdvHaric + kdvTutari);

  /* Fatura düzenleme alt sınırı (e-Arşiv için 30.000 ₺) */
  const faturaAltSinir = 30000;
  const tevkifEdilenTutar = kdvHaric;
  const hesaplananKdv = kdvTutari;
  const genelToplam = kdvDahil;

  /* e-Belge */
  const malHizmetToplam = kdvHaric;
  const eBelgeKdv = kdvTutari;
  const tevkifataTabiTutar = kdvHaric;
  const tevkifataTabiKdv = ROUND2(tevkifataTabiTutar * kdvOrani);
  const kdvTevkifat = ROUND2(tevkifataTabiKdv * tevOrani);
  const vergilerDahil = kdvDahil;
  const odenecek = ROUND2(kdvDahil - kdvTevkifat);

  /* Satış KDV 1 Beyanname */
  const satisMatrah = kdvHaric;
  const satisKdvOrani = kdvOrani * 100;
  const satisKdvKodu = kdvOrani === 0.2 ? "214" : kdvOrani === 0.1 ? "224" : kdvOrani === 0.01 ? "234" : "244";
  const satisTevOrani = option.label;
  const satisTevVergi = kdvTevkifat;

  /* Satış Bildirim Eki */
  const satisBildirimTutar = kdvHaric;
  const satisBildirimKdvOrani = satisKdvOrani;
  const satisBildirimKdvHes = tevkifataTabiKdv;
  const satisBildirimTevOrani = option.label;
  const satisBildirimTevTutar = kdvTevkifat;

  /* Alış KDV 1 — Alıcı tarafa düşen */
  const alisIndirimTuru = "Kısmi Tevkifat";
  const alisVergi = kdvTevkifat;
  const alisYurtIciKdv = ROUND2(kdvTutari - kdvTevkifat);
  const alisSorumluKdv = 0;

  /* KDV 2 Beyanname — Alıcı bildirimi */
  const kdv2Matrah = kdvHaric;
  const kdv2Oran = kdvOrani * 100;
  const kdv2Kodu = satisKdvKodu;
  const kdv2TevOrani = option.label;
  const kdv2Vergi = kdvTevkifat;

  return {
    kdvHaric, kdvOrani, kdvTutari, kdvDahil,
    tevPay, tevTotal, faturaAltSinir,
    tevkifEdilenTutar, hesaplananKdv, genelToplam,
    malHizmetToplam, eBelgeKdv,
    tevkifataTabiTutar, tevkifataTabiKdv, kdvTevkifat,
    vergilerDahil, odenecek,
    satisMatrah, satisKdvOrani, satisKdvKodu,
    satisTevOrani, satisTevVergi,
    satisBildirimTutar, satisBildirimKdvOrani,
    satisBildirimKdvHes, satisBildirimTevOrani, satisBildirimTevTutar,
    alisIndirimTuru, alisVergi, alisYurtIciKdv, alisSorumluKdv,
    kdv2Matrah, kdv2Oran, kdv2Kodu, kdv2TevOrani, kdv2Vergi,
  };
}

/* ─── Bileşen ────────────────────────────────────────────── */
export function TevkifatHesap() {
  const [matrah, setMatrah] = useState("10000");
  const [kdvOran, setKdvOran] = useState("20");
  const [tevIndex, setTevIndex] = useState("4"); // Varsayılan: 5/10

  const result = useMemo(() => compute(matrah, kdvOran, tevIndex), [matrah, kdvOran, tevIndex]);

  const option = TEVKIFAT_OPTIONS[Number(tevIndex)] ?? TEVKIFAT_OPTIONS[0];

  return (
    <CalcCard
      title="KDV Tevkifat Hesaplama"
      subtitle="TÜRMOB / GİB — Satış ve alış yönünde tevkifat, beyanname ve bildirim hesaplamaları"
    >
      <div className="grid gap-6">
        {/* ─── Girdiler ─── */}
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="KDV Hariç Tutar (₺)">
            <Input
              type="text"
              inputMode="decimal"
              value={matrah}
              onChange={(e) => setMatrah(formatInputValue(e.target.value))}
              placeholder="0,00"
              className="tabular-nums"
            />
          </Field>
          <Field label="KDV Oranı">
            <Select value={kdvOran} onValueChange={setKdvOran}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KDV_ORANLARI.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Tevkifat Oranı">
            <Select value={tevIndex} onValueChange={setTevIndex}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEVKIFAT_OPTIONS.map((tev, i) => (
                  <SelectItem key={i} value={String(i)}>
                    {tev.label} — {tev.desc.split(",")[0]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        {/* Tevkifat açıklaması */}
        <div className="rounded-md border border-border/60 bg-muted/20 px-4 py-3 text-xs leading-5 text-muted-foreground">
          <span className="font-semibold text-foreground">{option.label}</span>{" "}
          {option.desc}
        </div>

        {result && (
          <>
            {/* ─── 1. GENEL HESAPLAMA ─── */}
            <section>
              <h3 className="mb-3 text-sm font-semibold tracking-tight">
                Genel Hesaplama
              </h3>
              <div className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2">
                {[
                  ["KDV Hariç (₺)", formatTRY(result.kdvHaric)],
                  ["KDV Tutarı (₺)", formatTRY(result.kdvTutari)],
                  ["KDV Dahil (₺)", formatTRY(result.kdvDahil)],
                  ["Fatura Düzenleme Alt Sınırı (₺)", `${formatTRY(result.faturaAltSinir)}`],
                  ["Tevkif Edilen Tutar (₺)", formatTRY(result.tevkifEdilenTutar)],
                  ["Hesaplanan KDV Tutarı (₺)", formatTRY(result.hesaplananKdv)],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between bg-card px-4 py-2.5">
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <span className="font-mono text-sm font-semibold tabular-nums">{value}</span>
                  </div>
                ))}
                <div className="col-span-full flex items-center justify-between border-t border-border bg-muted/30 px-4 py-3">
                  <span className="text-sm font-semibold">Genel Toplam (₺)</span>
                  <span className="font-mono text-base font-bold tabular-nums">{formatTRY(result.genelToplam)}</span>
                </div>
              </div>
            </section>

            {/* ─── 2. e-BELGE AÇISINDAN ─── */}
            <section>
              <h3 className="mb-3 text-sm font-semibold tracking-tight">
                e-Belge (e-Fatura / e-Arşiv Fatura) Açısından
              </h3>
              <div className="grid gap-px overflow-hidden rounded-lg border bg-border">
                {[
                  ["Mal/Hizmet Toplam Tutar", formatTRY(result.malHizmetToplam)],
                  ["Hesaplanan KDV", formatTRY(result.eBelgeKdv)],
                  ["Tevkifata Tabi İşlem Tutarı", formatTRY(result.tevkifataTabiTutar)],
                  ["Tevkifata Tabi İşlem Üzerinden Hes. KDV", formatTRY(result.tevkifataTabiKdv)],
                  ["Hesaplanan KDV Tevkifat", formatTRY(result.kdvTevkifat)],
                  ["Vergiler Dahil Toplam Tutar", formatTRY(result.vergilerDahil)],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between bg-card px-4 py-2.5">
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <span className="font-mono text-sm font-semibold tabular-nums">{value}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-border bg-muted/30 px-4 py-3">
                  <span className="text-sm font-semibold">Ödenecek Tutar</span>
                  <span className="font-mono text-base font-bold tabular-nums text-primary">{formatTRY(result.odenecek)}</span>
                </div>
              </div>
              <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
                Satıcı: {formatTRY(result.odenecek)} alır · Alıcı: {formatTRY(result.kdvTevkifat)}'yi devlete beyan eder
              </p>
            </section>

            {/* ─── 3. SATIŞ — KDV 1 Beyannamesi ─── */}
            <section>
              <h3 className="mb-3 text-sm font-semibold tracking-tight">
                Satış İçin — KDV 1 Beyannamesi Açısından
              </h3>

              {/* Kısmi Tevkifat Tablosu */}
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left">
                      <th className="px-3 py-2 font-medium">Matrah</th>
                      <th className="px-3 py-2 font-medium">KDV Oranı</th>
                      <th className="px-3 py-2 font-medium">Kod (KDV 1)</th>
                      <th className="px-3 py-2 font-medium">Tevkifat Oranı</th>
                      <th className="px-3 py-2 text-right font-medium">Vergi</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b bg-card">
                      <td className="px-3 py-2.5 font-mono tabular-nums">{formatTRY(result.satisMatrah)}</td>
                      <td className="px-3 py-2.5">%{result.satisKdvOrani}</td>
                      <td className="px-3 py-2.5 font-mono">{result.satisKdvKodu}</td>
                      <td className="px-3 py-2.5">{result.satisTevOrani}</td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums">{formatTRY(result.satisTevVergi)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Bildirim Eki */}
              <h4 className="mt-5 mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Kısmi Tevkifat Uygulaması Kapsamındaki İşlemlere Ait Bildirim Eki
              </h4>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left">
                      <th className="px-3 py-2 font-medium whitespace-nowrap">İşlem Tutarı (KDV Hariç)</th>
                      <th className="px-3 py-2 font-medium">KDV Oranı</th>
                      <th className="px-3 py-2 font-medium whitespace-nowrap">Hes. KDV'si</th>
                      <th className="px-3 py-2 font-medium">Tev. Oranı</th>
                      <th className="px-3 py-2 text-right font-medium whitespace-nowrap">Tev. Tutarı (Alıcı Beyan)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b bg-card">
                      <td className="px-3 py-2.5 font-mono tabular-nums">{formatTRY(result.satisBildirimTutar)}</td>
                      <td className="px-3 py-2.5">%{result.satisBildirimKdvOrani}</td>
                      <td className="px-3 py-2.5 font-mono tabular-nums">{formatTRY(result.satisBildirimKdvHes)}</td>
                      <td className="px-3 py-2.5">{result.satisBildirimTevOrani}</td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-primary font-semibold">{formatTRY(result.satisBildirimTevTutar)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* ─── 4. ALIŞ — KDV 1 Beyannamesi ─── */}
            <section>
              <h3 className="mb-3 text-sm font-semibold tracking-tight">
                Alış İçin — KDV 1 Beyannamesi Açısından
              </h3>

              {/* İndirim Tablosu */}
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left">
                      <th className="px-3 py-2 font-medium">İndirim Türü</th>
                      <th className="px-3 py-2 text-right font-medium">Vergi</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b bg-card">
                      <td className="px-3 py-2.5">Kısmi Tevkifat Uygulanan İşlemler (Yurt İçi Alımlara İlişkin KDV)</td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums">{formatTRY(result.alisYurtIciKdv)}</td>
                    </tr>
                    {result.alisSorumluKdv > 0 && (
                      <tr className="border-b bg-card">
                        <td className="px-3 py-2.5">Sorumlu Sıfatıyla Beyan Edilen KDV</td>
                        <td className="px-3 py-2.5 text-right font-mono tabular-nums">{formatTRY(result.alisSorumluKdv)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
                Alıcı tarafından indirim konusu yapılan tevkifat tutarı:{" "}
                <span className="font-semibold text-foreground">{formatTRY(result.alisVergi)}</span>
              </p>

              {/* KDV 2 Beyanname Bildirim */}
              <h4 className="mt-5 mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                KDV 2 Beyannamesi Açısından — Kısmi Tevkifat Bildirimi
              </h4>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left">
                      <th className="px-3 py-2 font-medium">Matrah</th>
                      <th className="px-3 py-2 font-medium">Oran</th>
                      <th className="px-3 py-2 font-medium">Kod (KDV 2)</th>
                      <th className="px-3 py-2 font-medium">Tevkifat Oranı</th>
                      <th className="px-3 py-2 text-right font-medium">Vergi</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b bg-card">
                      <td className="px-3 py-2.5 font-mono tabular-nums">{formatTRY(result.kdv2Matrah)}</td>
                      <td className="px-3 py-2.5">%{result.kdv2Oran}</td>
                      <td className="px-3 py-2.5 font-mono">{result.kdv2Kodu}</td>
                      <td className="px-3 py-2.5">{result.kdv2TevOrani}</td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-primary font-semibold">{formatTRY(result.kdv2Vergi)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* ─── Tevkifat Oranları Tablosu ─── */}
            <section className="mt-2">
              <h3 className="mb-3 text-sm font-semibold tracking-tight">
                Tevkifat Oranları Tablosu (KDV Tebliği Seri No 1)
              </h3>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left">
                      <th className="px-3 py-2 font-medium">Tev. Oranı</th>
                      <th className="px-3 py-2 font-medium">Kapsam</th>
                    </tr>
                  </thead>
                  <tbody>
                    {TEVKIFAT_OPTIONS.map((tev, i) => (
                      <tr
                        key={i}
                        className={`border-b bg-card transition-colors ${
                          Number(tevIndex) === i ? "bg-muted/40 font-semibold" : ""
                        }`}
                      >
                        <td className="px-3 py-2 font-mono">{tev.label}</td>
                        <td className="px-3 py-2">{tev.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* ─── Bilgi Notu ─── */}
            <InfoNote>
              <strong>TEVKİFAT:</strong> Alıcı, hesaplanan KDV'nin belirli bir
              kısmını (ör. 5/10) satıcı yerine doğrudan devlete beyan eder ve öder.
              Satıcı sadece kalan KDV'yi öder. Bu hesaplama GİB standartlarına göredir.
            </InfoNote>
          </>
        )}
      </div>
    </CalcCard>
  );
}
