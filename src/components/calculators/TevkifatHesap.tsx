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
import { useMemo, useRef, useState } from "react";
import { CalcCard, Field, InfoNote, PrintHeader } from "./shared";
import { CalcActions } from "./engine/CalcActions";
import type { ExcelSection } from "./engine/calcExport";

/*
 * ─── KDV Tevkifat Hesaplama — TÜRMOB birebir klonu ─────────────────────────
 * Kaynak: https://www.turmob.org.tr/hesaplamalar/KDV-Tevkifat-Hesaplama
 * (viewModel: /bundles/kdvtevkifat — app.tevkifat)
 *
 * Birebir alınan davranışlar:
 *  • İşin Türü dropdown'ı: KDV GUT 2.1.3 kodlu tüm işlem türleri (601–627)
 *    + esnek oranlı "Diğerleri" satırları; tevkifat katsayısı buradan gelir.
 *  • KDV Dahil/Hariç seçimi, tutar, KDV oranı (%20/%10/%1) ve
 *    fatura düzenleme yılına göre değişen düzenleme alt sınırı.
 *  • Tevkifat sosyal eşiği: KDV DAHİL toplam, seçilen yılın fatura
 *    düzenleme alt sınırını aşmıyorsa tevkifat uygulanmaz (TevkifTutari=0).
 *  • Hesaplanan KDV Tutar = KDV − Tevkifat (satıcıya ödenecek KDV);
 *    Genel Toplam = KDV Hariç + Hesaplanan KDV Tutar;
 *    Ödenecek Tutar = KDV Dahil − Tevkifat.
 *  • KDV 1 kodu = code1 (601..), KDV 2 kodu = code2 (201..).
 */

interface TevkifatTuru {
  /** Tevkifat katsayısı (ör. 0.4 → 4/10) */
  value: number;
  text: string;
  /** KDV 1 beyannamesi kodu */
  code1: number;
  /** KDV 2 beyannamesi kodu */
  code2: number;
  rate: string;
}

/* ─── İşin Türü — KDV GUT 2.1.3 (TÜRMOB listesinin birebir aynısı) ── */
const TEVKIFAT_TURLERI: TevkifatTuru[] = [
  { value: 0.4, text: "Yapım işleri ile bu işlerle birlikte ifa edilen mühendislik-mimarlık ve etüt-proje hizmetleri", code1: 601, code2: 201, rate: "4/10" },
  { value: 0.9, text: "Etüt, plan-proje, danışmanlık, denetim ve benzeri hizmetler", code1: 602, code2: 202, rate: "9/10" },
  { value: 0.7, text: "Makine, teçhizat, demirbaş ve taşıtlara ait tadil, bakım ve onarım hizmetleri", code1: 603, code2: 203, rate: "7/10" },
  { value: 0.5, text: "Yemek servis hizmeti", code1: 604, code2: 204, rate: "5/10" },
  { value: 0.5, text: "Organizasyon hizmeti", code1: 605, code2: 205, rate: "5/10" },
  { value: 0.9, text: "İşgücü temin hizmetleri", code1: 606, code2: 206, rate: "9/10" },
  { value: 0.9, text: "Özel güvenlik hizmeti", code1: 607, code2: 207, rate: "9/10" },
  { value: 0.9, text: "Yapı denetim hizmetleri", code1: 608, code2: 208, rate: "9/10" },
  { value: 0.7, text: "Fason Olarak Yaptırılan Tekstil ve Konfeksiyon İşleri, Çanta ve Ayakkabı Dikim İşleri ve Bu İşlere Aracılık Hizmetleri", code1: 609, code2: 209, rate: "7/10" },
  { value: 0.9, text: "Turistik mağazalara verilen müşteri bulma / götürme hizmetleri", code1: 610, code2: 210, rate: "9/10" },
  { value: 0.9, text: "Spor kulüplerinin yayın, reklâm ve isim hakkı gelirlerine konu işlemleri", code1: 611, code2: 211, rate: "9/10" },
  { value: 0.9, text: "Temizlik hizmeti", code1: 612, code2: 212, rate: "9/10" },
  { value: 0.9, text: "Çevre ve bahçe bakım hizmetleri", code1: 613, code2: 213, rate: "9/10" },
  { value: 0.5, text: "Servis taşımacılığı hizmeti", code1: 614, code2: 214, rate: "5/10" },
  { value: 0.7, text: "Her türlü baskı ve basım hizmetleri", code1: 615, code2: 215, rate: "7/10" },
  { value: 0.5, text: "5018 sayılı kanuna ekli cetvellerdeki idare, kurum ve kuruşlara yapılan diğer hizmetler", code1: 616, code2: 216, rate: "5/10" },
  { value: 0.7, text: "Hurda metalden elde edilen külçe teslimleri", code1: 617, code2: 217, rate: "7/10" },
  { value: 0.7, text: "Hurda metalden elde edilenler dışındaki bakır, çinko ve alüminyum külçe teslimleri", code1: 618, code2: 218, rate: "7/10" },
  { value: 0.7, text: "Bakır, çinko, alüminyum ve kurşun ürünlerinin teslimi", code1: 619, code2: 219, rate: "7/10" },
  { value: 0.7, text: "İstisnadan vazgeçenlerin hurda ve atık teslimi", code1: 620, code2: 220, rate: "7/10" },
  { value: 0.9, text: "Metal, plastik, lastik, kauçuk, kâğıt ve cam hurda ve atıklardan elde edilen hammadde teslimi", code1: 621, code2: 221, rate: "9/10" },
  { value: 0.9, text: "Pamuk, tiftik, yün ve yapağı ile ham post ve deri teslimleri", code1: 622, code2: 222, rate: "9/10" },
  { value: 0.5, text: "Ağaç ve orman ürünleri teslimi", code1: 623, code2: 223, rate: "5/10" },
  { value: 0.2, text: "Yük taşımacılığı hizmeti", code1: 624, code2: 224, rate: "2/10" },
  { value: 0.3, text: "Ticari reklam hizmetleri", code1: 625, code2: 225, rate: "3/10" },
  { value: 0.2, text: "Diğer teslimler", code1: 626, code2: 226, rate: "2/10" },
  { value: 0.5, text: "Demir-Çelik ürünlerinin teslimi", code1: 627, code2: 227, rate: "5/10" },
  { value: 0.2, text: "Diğerleri", code1: 650, code2: 250, rate: "2/10" },
  { value: 0.3, text: "Diğerleri", code1: 650, code2: 250, rate: "3/10" },
  { value: 0.4, text: "Diğerleri", code1: 650, code2: 250, rate: "4/10" },
  { value: 0.5, text: "Diğerleri", code1: 650, code2: 250, rate: "5/10" },
  { value: 0.7, text: "Diğerleri", code1: 650, code2: 250, rate: "7/10" },
  { value: 0.9, text: "Diğerleri", code1: 650, code2: 250, rate: "9/10" },
];

/* Dropdown metni — TÜRMOB$optionsText: "code2 - text - rate" */
const TUR_DROPDOWN = (t: TevkifatTuru) => `${t.code2} - ${t.text} — ${t.rate}`;

const KDV_ORANLARI = [
  { value: 1.2, value2: 0.2, text: "%20" },
  { value: 1.1, value2: 0.1, text: "%10" },
  { value: 1.01, value2: 0.01, text: "%1" },
];

/* KDV dahil/hariç seçimi */
const DAHILHARIC = [
  { value: "h", text: "KDV Hariç" },
  { value: "d", text: "KDV Dahil" },
];

/* Fatura düzenleme alt sınırı — TÜRMOB listesinin birebir aynısı */
const FATURA_SINIRLARI = [
  { year: 2026, value: 12000 },
  { year: 2025, value: 9900 },
  { year: 2024, value: 6900 },
  { year: 2023, value: 4400 },
  { year: 2022, value: 2000 },
  { year: 2021, value: 1500 },
  { year: 2020, value: 1400 },
  { year: 2019, value: 1200 },
  { year: 2018, value: 1000 },
  { year: 2017, value: 900 },
  { year: 2016, value: 900 },
  { year: 2015, value: 880 },
  { year: 2014, value: 800 },
  { year: 2013, value: 800 },
  { year: 2012, value: 770 },
  { year: 2011, value: 700 },
];

/* ─── Hesaplama — TÜRMOB viewModel'in birebir mantığı ────────────── */
interface TurmobResult {
  kdvHaric: number;
  kdvTutari: number;
  kdvDahil: number;
  altSinir: number;

  /** TevkifTutari — alıcının beyan edeceği KDV */
  tevkifVergi: number;
  /** HesaplananKDVTutari — KDV − Tevkifat (satıcının ödediği KDV) */
  hesaplananKdv: number;
  genelToplam: number;
  odenecekTutar: number;

  evSecili: boolean;
  kdvOranMetni: string;
  code1: number | null;
  code2: number | null;
  rate: string | null;
  turText: string | null;
}

function round2(n: number): number {
  return Number(n.toFixed(2));
}

function compute(
  tutarStr: string,
  kdvDahilMi: boolean,
  kdvOranStr: string,
  yilStr: string,
  tevKey: string,
): TurmobResult | null {
  const tutar = parseTurkishNumber(tutarStr);
  if (!Number.isFinite(tutar) || tutar <= 0) return null;

  const kdvOrani =
    KDV_ORANLARI.find((o) => String(o.value2) === kdvOranStr) ?? KDV_ORANLARI[0];
  const sinir =
    FATURA_SINIRLARI.find((f) => String(f.year) === yilStr) ??
    FATURA_SINIRLARI[0];
  const tur =
    TEVKIFAT_TURLERI.find((_, i) => String(i) === tevKey) ?? null;

  /* TÜRMOB: KDVHaric */
  const kdvHaric = kdvDahilMi ? tutar / kdvOrani.value : tutar;
  /* TÜRMOB: KDVTutari */
  const kdvTutari = kdvHaric * kdvOrani.value2;
  /* TÜRMOB: KDVDahil */
  const kdvDahil = kdvHaric + kdvTutari;

  /*
   * TÜRMOB: TevkifTutari — işin türü seçili VE KDV dahil toplam,
   * seçilen yılın fatura düzenleme alt sınırını aşıyorsa uygulanır.
   */
  const tevkifVergi =
    tur && kdvDahil > sinir.value ? kdvTutari * tur.value : 0;
  /* TÜRMOB: HesaplananKDVTutari = KDV − Tevkifat */
  const hesaplananKdv = kdvTutari - tevkifVergi;
  /* TÜRMOB: GenelToplam = KDV Hariç + Hesaplanan KDV */
  const genelToplam = kdvHaric + hesaplananKdv;
  /* TÜRMOB: OdenecekTutar = KDV Dahil − Tevkifat */
  const odenecekTutar = kdvDahil && tevkifVergi ? kdvDahil - tevkifVergi : 0;

  return {
    kdvHaric,
    kdvTutari,
    kdvDahil,
    altSinir: sinir.value,
    tevkifVergi,
    hesaplananKdv,
    genelToplam,
    odenecekTutar,
    evSecili: !!tur,
    kdvOranMetni: kdvOrani.text,
    code1: tur ? tur.code1 : null,
    code2: tur ? tur.code2 : null,
    rate: tur ? tur.rate : null,
    turText: tur ? tur.text : null,
  };
}

/* ─── Bileşen ────────────────────────────────────────────── */
export function TevkifatHesap() {
  const areaRef = useRef<HTMLDivElement>(null);
  const [tutar, setTutar] = useState("10000");
  const [kdvDahilMi, setKdvDahilMi] = useState("h");
  const [kdvOran, setKdvOran] = useState("0.2");
  const [faturaYili, setFaturaYili] = useState(String(new Date().getFullYear()));
  /** İşin türü — TÜRMOB'da başlangıçta seçili değildir ("İşin türünü seçiniz") */
  const [tevKey, setTevKey] = useState("");

  const result = useMemo(
    () => compute(tutar, kdvDahilMi === "d", kdvOran, faturaYili, tevKey),
    [tutar, kdvDahilMi, kdvOran, faturaYili, tevKey],
  );

  const evSeciliTur =
    tevKey === "" ? null : (TEVKIFAT_TURLERI[Number(tevKey)] ?? null);

  const kdvDahilMiBool = kdvDahilMi === "d";

  const excelSections: ExcelSection[] = [
    {
      title: "Girdiler",
      headers: ["Parametre", "Değer"],
      rows: [
        ["KDV Dahil/Hariç", kdvDahilMiBool ? "KDV Dahil" : "KDV Hariç"],
        ["Tutar (₺)", parseTurkishNumber(tutar)],
        ["KDV Oranı", result ? result.kdvOranMetni : ""],
        [
          "Fatura Düzenleme Yılı",
          `${faturaYili} — Alt Sınır ${result ? formatTRY(result.altSinir) : ""}`,
        ],
        [
          "İşin Türü",
          evSeciliTur
            ? `${evSeciliTur.code1} — ${evSeciliTur.text} — ${evSeciliTur.rate}`
            : "İşin türünü seçiniz",
        ],
      ],
    },
    {
      title: "Genel Hesaplama",
      headers: ["Kalem", "Tutar (₺)"],
      rows: result
        ? [
            ["KDV Hariç (₺)", round2(result.kdvHaric)],
            ["KDV Tutarı (₺)", round2(result.kdvTutari)],
            ["KDV Dahil (₺)", round2(result.kdvDahil)],
            ["Fatura Düzenleme Alt Sınırı (₺)", result.altSinir],
            ["Tevkif Edilen Tutar (₺)", round2(result.tevkifVergi)],
            ["Hesaplanan KDV Tutar (₺)", round2(result.hesaplananKdv)],
          ]
        : [],
      footers: result
        ? [`Genel Toplam: ${result.genelToplam.toFixed(2)} ₺`]
        : undefined,
    },
    {
      title: "e-Belge (e-Fatura, e-Arşiv Fatura) Açısından",
      headers: ["Kalem", "Tutar (₺)"],
      rows: result
        ? [
            ["Mal/Hizmet Toplam Tutar", round2(result.kdvHaric)],
            ["Hesaplanan KDV", round2(result.kdvTutari)],
            ["Tevkifata Tabi İşlem Tutarı", round2(result.kdvHaric)],
            ["Tevkifata Tabi İşlem Üzerinden Hes. KDV Tutarı", round2(result.kdvTutari)],
            ["Hesaplanan KDV Tevkifat", round2(result.tevkifVergi)],
            ["Vergiler Dahil Toplam Tutar", round2(result.kdvDahil)],
          ]
        : [],
      footers: result
        ? [`Ödenecek Tutar: ${round2(result.odenecekTutar).toFixed(2)} ₺`]
        : undefined,
    },
    {
      title: "Satış İçin — KDV 1 Beyannamesi Açısından",
      headers: ["Matrah (₺)", "KDV Oranı", "Kod (KDV 1)", "Tevkifat Oranı", "Vergi (₺)"],
      rows: result
        ? [
            [
              round2(result.kdvHaric),
              result.kdvOranMetni,
              result.code1 ?? "",
              result.rate ?? "",
              round2(result.hesaplananKdv),
            ],
          ]
        : [],
    },
    {
      title: "Kısmi Tevkifat Uygulaması Kapsamındaki İşlemlere Ait Bildirim Eki",
      headers: [
        "Tevkifat Uygulanan İşlemin Tutarı (KDV Hariç)",
        "KDV Oranı",
        "Hesaplanan KDV (₺)",
        "Tevkifat Oranı",
        "Tevkifat Tutarı (₺)",
      ],
      rows: result
        ? [
            [
              round2(result.kdvHaric),
              result.kdvOranMetni,
              round2(result.kdvTutari),
              result.rate ?? "",
              round2(result.tevkifVergi),
            ],
          ]
        : [],
    },
    {
      title: "Alış İçin — KDV 1 Beyannamesi (İndirim Tablosu)",
      headers: ["İndirim Türü", "Vergi (₺)"],
      rows: result
        ? [
            ["Yurt İçi Alımlara İlişkin KDV", round2(result.hesaplananKdv)],
            ["Sorumlu Sıfatıyla Beyan Edilen KDV", round2(result.tevkifVergi)],
          ]
        : [],
    },
    {
      title: "KDV 2 Beyannamesi — Kısmi Tevkifat Uygulanan İşlemlere Ait Bildirim",
      headers: ["Matrah (₺)", "Oran", "Kod (KDV 2)", "Tevkifat Oranı", "Vergi (₺)"],
      rows: result
        ? [
            [
              round2(result.kdvHaric),
              result.kdvOranMetni,
              result.code2 ?? "",
              result.rate ?? "",
              round2(result.tevkifVergi),
            ],
          ]
        : [],
    },
  ];

  return (
    <div className="print-area" ref={areaRef}>
      <PrintHeader
        title="KDV Tevkifat Hesaplama Raporu"
        subtitle={
          result
            ? `Tutar ${formatTRY(result.kdvHaric)} · KDV ${result.kdvOranMetni} · İşin Türü ${result.rate ?? "—"}`
            : undefined
        }
      />
      <CalcCard
        title="KDV Tevkifat Hesaplama"
        subtitle="TÜRMOB aracının birebir klonu — KDV GUT işin türleri, düzenleme alt sınırı ve beyanname kodları dahil"
        actions={
          <CalcActions
            excelName="mizan-tevkifat"
            excelTitle="KDV Tevkifat Hesaplama"
            excelSheet="Tevkifat"
            excelSections={excelSections}
            pdfTargetRef={areaRef}
            pdfName="mizan-tevkifat"
            disabled={!result}
          />
        }
      >
        <div className="grid gap-6">
          {/* ─── Girdiler ─── */}
          <div className="grid gap-5 sm:grid-cols-4">
            <Field label="KDV Dahil/Hariç">
              <Select value={kdvDahilMi} onValueChange={setKdvDahilMi}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAHILHARIC.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.text}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={kdvDahilMiBool ? "Tutar (KDV Dahil ₺)" : "Tutar (KDV Hariç ₺)"}>
              <Input
                type="text"
                inputMode="decimal"
                value={tutar}
                onChange={(e) => setTutar(formatInputValue(e.target.value))}
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
                    <SelectItem key={o.value2} value={String(o.value2)}>
                      {o.text}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Fatura Düzenleme Yılı">
              <Select value={faturaYili} onValueChange={setFaturaYili}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FATURA_SINIRLARI.map((f) => (
                    <SelectItem key={f.year} value={String(f.year)}>
                      {f.year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          {/* ─── İşin Türü — TÜRMOB'daki select + oran rozetinin klonu ─── */}
          <Field label="İşin Türü">
            <div className="flex items-stretch gap-2">
              <span className="flex items-center rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground">
                {result?.rate ?? "-----"}
              </span>
              <Select
                value={tevKey}
                onValueChange={setTevKey}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="İşin türünü seçiniz" />
                </SelectTrigger>
                <SelectContent>
                  {TEVKIFAT_TURLERI.map((t, i) => (
                    <SelectItem key={`${t.code1}-${t.rate}-${i}`} value={String(i)}>
                      {TUR_DROPDOWN(t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Field>

          {result && (
            <>
              {/* ─── 1. GENEL KARTLAR — TÜRMOB düzeni (4 + 3) ─── */}
              <section className="grid gap-4 sm:grid-cols-4">
                {[
                  ["KDV Hariç (₺)", formatTRY(result.kdvHaric)],
                  ["KDV Tutarı (₺)", formatTRY(result.kdvTutari)],
                  ["KDV Dahil (₺)", formatTRY(result.kdvDahil)],
                  ["Fatura Düzenleme Alt Sınırı (₺)", formatTRY(result.altSinir)],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-lg border bg-muted/20 px-4 py-3"
                  >
                    <div className="text-xs text-muted-foreground">{label}</div>
                    <div className="mt-1 font-mono text-base font-bold tabular-nums">
                      {value}
                    </div>
                  </div>
                ))}
              </section>
              <section className="grid gap-4 sm:grid-cols-3">
                {[
                  ["Tevkif Edilen Tutar (₺)", formatTRY(result.tevkifVergi)],
                  ["Hesaplanan KDV Tutar (₺)", formatTRY(result.hesaplananKdv)],
                  ["Genel Toplam (₺)", formatTRY(result.genelToplam)],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-lg border bg-muted/20 px-4 py-3"
                  >
                    <div className="text-xs text-muted-foreground">{label}</div>
                    <div className="mt-1 font-mono text-base font-bold tabular-nums">
                      {value}
                    </div>
                  </div>
                ))}
              </section>

              {/* ─── 2. e-BELGE AÇISINDAN ─── */}
              <section>
                <h3 className="mb-3 text-sm font-semibold tracking-tight">
                  e-Belge (e-Fatura, e-Arşiv Fatura) Açısından
                </h3>
                <div className="grid gap-px overflow-hidden rounded-lg border bg-border">
                  {[
                    ["Mal/Hizmet Toplam Tutar", formatTRY(result.kdvHaric)],
                    ["Hesaplanan KDV", formatTRY(result.kdvTutari)],
                    ["Tevkifata Tabi İşlem Tutarı", formatTRY(result.kdvHaric)],
                    ["Tevkifata Tabi İşlem Üzerinden Hes. KDV Tutarı", formatTRY(result.kdvTutari)],
                    ["Hesaplanan KDV Tevkifat", formatTRY(result.tevkifVergi)],
                    ["Vergiler Dahil Toplam Tutar", formatTRY(result.kdvDahil)],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="flex items-center justify-between bg-card px-4 py-2.5"
                    >
                      <span className="text-xs text-muted-foreground">{label}</span>
                      <span className="font-mono text-sm font-semibold tabular-nums">
                        {value}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between border-t border-border bg-muted/30 px-4 py-3">
                    <span className="text-sm font-semibold">Ödenecek Tutar</span>
                    <span className="font-mono text-base font-bold tabular-nums text-primary">
                      {formatTRY(result.odenecekTutar)}
                    </span>
                  </div>
                </div>
              </section>

              {/* ─── 3. SATIŞ İÇİN — KDV 1 ─── */}
              <section>
                <h3 className="mb-3 text-sm font-semibold tracking-tight">
                  Satış İçin — KDV 1 Beyannamesi Açısından
                </h3>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/40 text-left">
                        <th className="px-3 py-2 font-medium">Matrah</th>
                        <th className="px-3 py-2 font-medium">KDV Oranı</th>
                        <th className="px-3 py-2 font-medium whitespace-nowrap">Kod (KDV 1)</th>
                        <th className="px-3 py-2 font-medium">Tevkifat Oranı</th>
                        <th className="px-3 py-2 text-right font-medium">Vergi</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b bg-card">
                        <td className="px-3 py-2.5 font-mono tabular-nums">{formatTRY(result.kdvHaric)}</td>
                        <td className="px-3 py-2.5">{result.kdvOranMetni}</td>
                        <td className="px-3 py-2.5 font-mono">{result.code1 ?? "—"}</td>
                        <td className="px-3 py-2.5">{result.rate ?? "—"}</td>
                        <td className="px-3 py-2.5 text-right font-mono tabular-nums">{formatTRY(result.hesaplananKdv)}</td>
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
                        <th className="px-3 py-2 font-medium whitespace-nowrap">
                          Tevkifat Uygulanan İşlemin Tutarı (KDV Hariç)
                        </th>
                        <th className="px-3 py-2 font-medium">KDV Oranı</th>
                        <th className="px-3 py-2 font-medium whitespace-nowrap">Hesaplanan KDV</th>
                        <th className="px-3 py-2 font-medium">Tevkifat Oranı</th>
                        <th className="px-3 py-2 text-right font-medium whitespace-nowrap">
                          Tevkifat Tutarı (Alıcı Tarafından Beyan)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b bg-card">
                        <td className="px-3 py-2.5 font-mono tabular-nums">{formatTRY(result.kdvHaric)}</td>
                        <td className="px-3 py-2.5">{result.kdvOranMetni}</td>
                        <td className="px-3 py-2.5 font-mono tabular-nums">{formatTRY(result.kdvTutari)}</td>
                        <td className="px-3 py-2.5">{result.rate ?? "—"}</td>
                        <td className="px-3 py-2.5 text-right font-mono font-semibold tabular-nums text-primary">
                          {formatTRY(result.tevkifVergi)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              {/* ─── 4. ALIŞ İÇİN — KDV 1 + KDV 2 ─── */}
              <section>
                <h3 className="mb-3 text-sm font-semibold tracking-tight">
                  Alış İçin — KDV 1 Beyannamesi Açısından
                </h3>
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
                        <td className="px-3 py-2.5">Yurt İçi Alımlara İlişkin KDV</td>
                        <td className="px-3 py-2.5 text-right font-mono tabular-nums">{formatTRY(result.hesaplananKdv)}</td>
                      </tr>
                      <tr className="border-b bg-card">
                        <td className="px-3 py-2.5">Sorumlu Sıfatıyla Beyan Edilen KDV</td>
                        <td className="px-3 py-2.5 text-right font-mono tabular-nums">{formatTRY(result.tevkifVergi)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <h4 className="mt-5 mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  KDV 2 Beyannamesi Açısından — Kısmi Tevkifat Uygulanan İşlemlere Ait Bildirim
                </h4>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/40 text-left">
                        <th className="px-3 py-2 font-medium">Matrah</th>
                        <th className="px-3 py-2 font-medium">Oran</th>
                        <th className="px-3 py-2 font-medium whitespace-nowrap">Kod (KDV 2)</th>
                        <th className="px-3 py-2 font-medium">Tevkifat Oranı</th>
                        <th className="px-3 py-2 text-right font-medium">Vergi</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b bg-card">
                        <td className="px-3 py-2.5 font-mono tabular-nums">{formatTRY(result.kdvHaric)}</td>
                        <td className="px-3 py-2.5">{result.kdvOranMetni}</td>
                        <td className="px-3 py-2.5 font-mono">{result.code2 ?? "—"}</td>
                        <td className="px-3 py-2.5">{result.rate ?? "—"}</td>
                        <td className="px-3 py-2.5 text-right font-mono font-semibold tabular-nums text-primary">
                          {formatTRY(result.tevkifVergi)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              {/* ─── İşin Türü listesi — seçime göre vurgulu ─── */}
              <section className="mt-2">
                <h3 className="mb-3 text-sm font-semibold tracking-tight">
                  İşin Türleri (KDV GUT 2.1.3 — Tevkifat Oranları)
                </h3>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/40 text-left">
                        <th className="px-3 py-2 font-medium">Kod</th>
                        <th className="px-3 py-2 font-medium">İşin Türü</th>
                        <th className="px-3 py-2 font-medium whitespace-nowrap">Tev. Oranı</th>
                      </tr>
                    </thead>
                    <tbody>
                      {TEVKIFAT_TURLERI.map((t, i) => (
                        <tr
                          key={`${t.code1}-${t.rate}-${i}`}
                          className={`border-b bg-card ${
                            evSeciliTur === t ? "bg-muted/40 font-semibold" : ""
                          }`}
                        >
                          <td className="px-3 py-2 font-mono">{t.code1}</td>
                          <td className="px-3 py-2">{t.text}</td>
                          <td className="px-3 py-2 font-mono">{t.rate}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* ─── Bilgi Notu ─── */}
              <InfoNote>
                <strong>KURAL:</strong> Tevkifat, işin türü seçili <em>ve</em> KDV
                dahil toplam tutar, fatura düzenleme yılına ait alt sınırı
                (aşağıdaki liste TÜRMOB ile aynı) aşıyorsa uygulanır. Tevkif Edilen
                = Hesaplanan KDV × tevkifat katsayısı örn. 4/10 → KDV'nin %40'ı;
                satıcı yalnız kalan KDV'yi beyan eder. KDV 1 kodu matrah
                beyanname kodudur (601 vb.), KDV 2 kodu alıcının tevkifat
                bildirim kodudur (201 vb.). Hesaplama mantığı
                turmob.org.tr/hesaplamalar/KDV-Tevkifat-Hesaplama ile birebir aynıdır.
              </InfoNote>
            </>
          )}
        </div>
      </CalcCard>
    </div>
  );
}
