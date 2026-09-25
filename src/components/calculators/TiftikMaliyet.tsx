import { formatInputValue } from "@/lib/finance/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatTRY, formatUSD, parseTurkishNumber } from "@/lib/finance/format";
import { computeTiftikMaliyet, type EkMaliyet } from "@/lib/finance/tiftik";
import { cn } from "@/lib/utils";
import { Plus, RotateCcw, Trash2, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  CalcCard,
  Field,
  InfoNote,
  PrintButton,
  PrintHeader,
  ResultBox,
  ResultRow,
  ResultTotalRow,
  Segmented,
  formatNumber,
} from "./shared";

const DEFAULTS = {
  miktar: "11.440",
  alimUsd: "10",
  kur: "48",
  yikamaFire: "28",
  islemeFire: "10",
  bozMal: "0",
  yikamaUcreti: "30",
  satisUsd: "18",
} satisfies Record<string, string>;

type AlimBirim = "usd" | "tl";
type FireModu = "oran" | "kilo";

/** Hesaplama durumu — localStorage'da kalıcı tutulur, sayfa yenilenince korunur. */
interface TiftikKayit {
  miktar: string;
  alimUsd: string;
  alimBirim: AlimBirim;
  kur: string;
  yikamaFire: string;
  yikamaFireModu: FireModu;
  islemeFire: string;
  islemeFireModu: FireModu;
  bozMal: string;
  yikamaUcreti: string;
  satisFiyat: string;
  satisBirim: AlimBirim;
  ekMaliyetler: EkMaliyet[];
}

const TIFTIK_STORAGE_KEY = "mizan-tiftik-hesap-v1";

function defaultKayit(): TiftikKayit {
  return {
    miktar: DEFAULTS.miktar,
    alimUsd: DEFAULTS.alimUsd,
    alimBirim: "usd",
    kur: DEFAULTS.kur,
    yikamaFire: DEFAULTS.yikamaFire,
    yikamaFireModu: "oran",
    islemeFire: DEFAULTS.islemeFire,
    islemeFireModu: "oran",
    bozMal: DEFAULTS.bozMal,
    yikamaUcreti: DEFAULTS.yikamaUcreti,
    satisFiyat: DEFAULTS.satisUsd,
    satisBirim: "usd",
    ekMaliyetler: [],
  };
}

function loadTiftikKayit(): TiftikKayit {
  try {
    const raw = window.localStorage.getItem(TIFTIK_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<TiftikKayit>;
      if (parsed && typeof parsed === "object") {
        const d = defaultKayit();
        return {
          ...d,
          ...parsed,
          alimBirim: parsed.alimBirim === "tl" ? "tl" : "usd",
          satisBirim: parsed.satisBirim === "tl" ? "tl" : "usd",
          yikamaFireModu: parsed.yikamaFireModu === "kilo" ? "kilo" : "oran",
          islemeFireModu: parsed.islemeFireModu === "kilo" ? "kilo" : "oran",
          ekMaliyetler: Array.isArray(parsed.ekMaliyetler)
            ? parsed.ekMaliyetler.filter(
                (e) => e && typeof e.ad === "string" && Number.isFinite(e.tutar),
              )
            : [],
        };
      }
    }
  } catch {
    // Bozuk veri — varsayılana dön.
  }
  return defaultKayit();
}

function kg(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${formatNumber(value, 2, 2)} kg`;
}

function parsePrice(raw: string): number {
  const trimmed = raw.trim();
  if (trimmed === "") return NaN;
  if (trimmed.includes(".") && !trimmed.includes(",")) return Number(trimmed);
  return parseTurkishNumber(trimmed);
}

/** kg modunda canlı yüzde dönüşüm ipucu: "≈ %28,00 — 3.203,20 kg / 11.440,00 kg" */
function fireKiloHint(kgRaw: string, miktarRaw: string): string | undefined {
  const m = parseTurkishNumber(miktarRaw);
  const f = parseTurkishNumber(kgRaw);
  if (!Number.isFinite(m) || m <= 0 || !Number.isFinite(f) || f < 0) return undefined;
  return `≈ %${formatNumber((f / m) * 100, 2, 2)} — ${formatNumber(f, 2, 2)} kg / ${formatNumber(m, 2, 2)} kg`;
}

const profitColor = (value: number | null | undefined) =>
  value == null
    ? undefined
    : value > 0
      ? "text-emerald-700 dark:text-emerald-300"
      : value < 0
        ? "text-destructive"
        : undefined;

/** TL ve USD olarak çift gösterim */
function DualValue({
  tl,
  usd,
  className,
}: {
  tl: string;
  usd: string;
  className?: string;
}) {
  return (
    <span className={cn("text-right", className)}>
      <span className="block font-mono text-sm font-medium tabular-nums text-foreground">
        {tl}
      </span>
      <span className="block font-mono text-xs tabular-nums text-muted-foreground">
        {usd}
      </span>
    </span>
  );
}

export function TiftikMaliyet({ usdRate }: { usdRate?: number | null }) {
  const [kayit, setKayit] = useState<TiftikKayit>(loadTiftikKayit);

  /* Her değişiklikte kalıcı depoya yaz — son hesaplama korunur */
  useEffect(() => {
    try {
      window.localStorage.setItem(TIFTIK_STORAGE_KEY, JSON.stringify(kayit));
    } catch {
      // Depolama dolu veya erişilemez — sessizce devam et.
    }
  }, [kayit]);

  function update(patch: Partial<TiftikKayit>) {
    setKayit((prev) => ({ ...prev, ...patch }));
  }

  const bozMalEmpty = kayit.bozMal.trim() === "";

  const result = useMemo(() => {
    const m = parseTurkishNumber(kayit.miktar);
    const k = parsePrice(kayit.kur);
    const b = bozMalEmpty ? NaN : parseTurkishNumber(kayit.bozMal);
    const yu = parseTurkishNumber(kayit.yikamaUcreti);
    const sHam = parsePrice(kayit.satisFiyat);
    const s =
      kayit.satisBirim === "usd"
        ? sHam
        : Number.isFinite(sHam) && k > 0
          ? sHam / k
          : NaN;

    // Alım fiyatı — USD veya TL olarak girilmiş olabilir
    const alimHam = parsePrice(kayit.alimUsd);
    const alimUsdDeger =
      Number.isFinite(alimHam) && k > 0
        ? kayit.alimBirim === "usd"
          ? alimHam
          : alimHam / k
        : NaN;

    // Yıkama firesi — oran (%) veya kilo (kg) olarak girilmiş olabilir
    const yikamaFireHam = parseTurkishNumber(kayit.yikamaFire);
    const yikamaFireKgHam =
      Number.isFinite(m) && Number.isFinite(yikamaFireHam)
        ? kayit.yikamaFireModu === "oran"
          ? (m * yikamaFireHam) / 100
          : yikamaFireHam
        : NaN;
    const yikamaFirePctHam =
      Number.isFinite(m) && m > 0 && Number.isFinite(yikamaFireKgHam)
        ? (yikamaFireKgHam / m) * 100
        : NaN;

    // İşleme firesi — oran (%) veya kilo (kg) olarak girilmiş olabilir
    const islemeHam = parseTurkishNumber(kayit.islemeFire);
    const ifr =
      kayit.islemeFireModu === "oran"
        ? islemeHam
        : Number.isFinite(m) && m > 0
          ? (islemeHam / m) * 100
          : NaN;

    if (!Number.isFinite(m) || m <= 0) return null;
    if (!Number.isFinite(alimUsdDeger) || alimUsdDeger < 0) return null;
    if (!Number.isFinite(k) || k <= 0) return null;
    if (
      !Number.isFinite(yikamaFirePctHam) ||
      yikamaFirePctHam < 0 ||
      yikamaFirePctHam >= 100 ||
      yikamaFireKgHam < 0 ||
      yikamaFireKgHam >= m
    ) {
      return null;
    }
    if (!Number.isFinite(ifr) || ifr < 0 || ifr >= 100) return null;
    if (!bozMalEmpty && (!Number.isFinite(b) || b < 0)) return null;
    if (!Number.isFinite(yu) || yu < 0) return null;
    if (!Number.isFinite(s) || s < 0) return null;

    return computeTiftikMaliyet({
      miktar: m,
      alimUsd: alimUsdDeger,
      kur: k,
      yikamaFirePct: yikamaFirePctHam,
      islemeFirePct: ifr,
      bozMalKg: b,
      yikamaUcreti: yu,
      genelGiderler: 0,
      satisUsd: s,
      ekMaliyetler: kayit.ekMaliyetler,
    });
  }, [kayit, bozMalEmpty]);

  const hamMiktar = parseTurkishNumber(kayit.miktar);
  const netKg = result ? result.netKg : NaN;
  const netSifir = Number.isFinite(netKg) && netKg <= 0;
  const asiriFire =
    result != null &&
    Number.isFinite(netKg) &&
    netKg > 0 &&
    Number.isFinite(hamMiktar) &&
    hamMiktar > 0 &&
    netKg / hamMiktar < 0.01;
  const brutKar = result?.brutKar ?? null;
  const brutKarUSD = result?.brutKarUSD ?? null;
  const karMarji = result?.karMarjiPct ?? null;
  const kiloBasiKar = result?.kiloBasiKar ?? null;
  const kiloBasiKarUSD = result?.kiloBasiKarUSD ?? null;

  function addEkMaliyet() {
    setKayit((prev) => ({
      ...prev,
      ekMaliyetler: [...prev.ekMaliyetler, { ad: "", tutar: 0 }],
    }));
  }
  function removeEkMaliyet(index: number) {
    setKayit((prev) => ({
      ...prev,
      ekMaliyetler: prev.ekMaliyetler.filter((_, i) => i !== index),
    }));
  }
  function updateEkMaliyet(
    index: number,
    field: "ad" | "tutar",
    value: string,
  ) {
    setKayit((prev) => ({
      ...prev,
      ekMaliyetler: prev.ekMaliyetler.map((item, i) =>
        i === index
          ? {
              ...item,
              [field]:
                field === "ad" ? value : parseTurkishNumber(value) || 0,
            }
          : item,
      ),
    }));
  }

  function resetAll() {
    setKayit(defaultKayit());
  }

  return (
    <div className="print-area">
      <PrintHeader
        title="Tiftik Maliyet Hesaplama Raporu"
        subtitle={
          result
            ? `Ham ${formatNumber(Number.isFinite(hamMiktar) ? hamMiktar : 0, 2, 2)} kg · Net ${formatNumber(Number.isFinite(netKg) ? netKg : 0, 2, 2)} kg · Kâr ${brutKar != null ? `${brutKar > 0 ? "+" : ""}${formatTRY(brutKar)}` : "—"}`
            : undefined
        }
      />
      <CalcCard
        title="Tiftik Maliyet Hesaplama"
        subtitle="Ham tiftikten satılabilir ürüne: fire akışı, maliyet kalemleri ve kâr analizi"
        actions={
          <div className="print-hide flex items-center gap-2">
            <PrintButton />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={resetAll}
            >
              <RotateCcw className="mr-1.5 size-3.5" />
              Sıfırla
            </Button>
          </div>
        }
      >
        <div className="grid gap-6">
          {/* Temel giriş alanları */}
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Ham Tiftik Miktarı (kg)">
              <Input
                type="text"
                inputMode="decimal"
                value={kayit.miktar}
                onChange={(event) =>
                  update({ miktar: formatInputValue(event.target.value) })
                }
                placeholder="0"
                className="tabular-nums"
              />
            </Field>
            <Field label="Alım Fiyatı">
              <div className="flex flex-col gap-2">
                <Input
                  type="text"
                  inputMode="decimal"
                  value={kayit.alimUsd}
                  onChange={(event) =>
                    update({ alimUsd: formatInputValue(event.target.value) })
                  }
                  placeholder="0,00"
                  className="tabular-nums"
                />
                <Segmented
                  options={[
                    { value: "usd", label: "USD/kg" },
                    { value: "tl", label: "TL/kg" },
                  ]}
                  value={kayit.alimBirim}
                  onChange={(v) => update({ alimBirim: v as AlimBirim })}
                />
              </div>
            </Field>
            <Field
              label="Kur (₺/USD)"
              hint={
                usdRate != null
                  ? `Canlı kur: ₺${formatNumber(usdRate, 2, 4)} — "Canlı" ile doldur`
                  : undefined
              }
            >
              <div className="flex gap-2">
                <Input
                  type="text"
                  inputMode="decimal"
                  value={kayit.kur}
                  onChange={(event) =>
                    update({ kur: formatInputValue(event.target.value) })
                  }
                  placeholder="0,00"
                  className="tabular-nums"
                />
                {usdRate != null && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => update({ kur: usdRate.toFixed(2).replace(".", ",") })}
                    title="Canlı USD kurunu kullan"
                  >
                    <Wallet className="mr-1 size-3.5" />
                    Canlı
                  </Button>
                )}
              </div>
            </Field>
            <Field
              label="Yıkama Firesi"
              hint={
                kayit.yikamaFireModu === "oran"
                  ? "Yüzde olarak girin (örn. 28)"
                  : fireKiloHint(kayit.yikamaFire, kayit.miktar)
              }
            >
              <div className="flex flex-col gap-2">
                <Input
                  type="text"
                  inputMode="decimal"
                  value={kayit.yikamaFire}
                  onChange={(event) =>
                    update({
                      yikamaFire: formatInputValue(event.target.value),
                    })
                  }
                  placeholder="0"
                  className="tabular-nums"
                />
                <Segmented
                  options={[
                    { value: "oran", label: "% Oran" },
                    { value: "kilo", label: "kg" },
                  ]}
                  value={kayit.yikamaFireModu}
                  onChange={(v) => update({ yikamaFireModu: v as FireModu })}
                />
              </div>
            </Field>
            <Field
              label="İşleme Firesi"
              hint={
                kayit.islemeFireModu === "oran"
                  ? "Yüzde olarak girin (örn. 10)"
                  : fireKiloHint(kayit.islemeFire, kayit.miktar)
              }
            >
              <div className="flex flex-col gap-2">
                <Input
                  type="text"
                  inputMode="decimal"
                  value={kayit.islemeFire}
                  onChange={(event) =>
                    update({
                      islemeFire: formatInputValue(event.target.value),
                    })
                  }
                  placeholder="0"
                  className="tabular-nums"
                />
                <Segmented
                  options={[
                    { value: "oran", label: "% Oran" },
                    { value: "kilo", label: "kg" },
                  ]}
                  value={kayit.islemeFireModu}
                  onChange={(v) => update({ islemeFireModu: v as FireModu })}
                />
              </div>
            </Field>
            <Field
              label="Boz Mal (kg)"
              hint="Sabit kg — boş bırakılırsa hesaplanamaz"
            >
              <Input
                type="text"
                inputMode="decimal"
                value={kayit.bozMal}
                onChange={(event) =>
                  update({ bozMal: formatInputValue(event.target.value) })
                }
                placeholder="0"
                className="tabular-nums"
              />
            </Field>
            <Field label="Yıkama Ücreti (₺/kg)">
              <Input
                type="text"
                inputMode="decimal"
                value={kayit.yikamaUcreti}
                onChange={(event) =>
                  update({
                    yikamaUcreti: formatInputValue(event.target.value),
                  })
                }
                placeholder="0,00"
                className="tabular-nums"
              />
            </Field>
            <Field label="Satış Fiyatı">
              <div className="flex flex-col gap-2">
                <Input
                  type="text"
                  inputMode="decimal"
                  value={kayit.satisFiyat}
                  onChange={(event) =>
                    update({
                      satisFiyat: formatInputValue(event.target.value),
                    })
                  }
                  placeholder="0,00"
                  className="tabular-nums"
                />
                <Segmented
                  options={[
                    { value: "usd", label: "USD/kg" },
                    { value: "tl", label: "TL/kg" },
                  ]}
                  value={kayit.satisBirim}
                  onChange={(v) => update({ satisBirim: v as AlimBirim })}
                />
              </div>
            </Field>
          </div>

          {/* Elle Eklenen Maliyetler */}
          <div className="rounded-lg border border-dashed border-border/70 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Elle Maliyetler
                </h3>
                <p className="text-xs text-muted-foreground">
                  Ek maliyet kalemleri girin (toplam tutar ₺ olarak hesaba katılır)
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addEkMaliyet}
              >
                <Plus className="mr-1 size-3.5" />
                Ekle
              </Button>
            </div>
            {kayit.ekMaliyetler.length === 0 && (
              <p className="text-xs text-muted-foreground italic">
                Henüz ek maliyet eklenmedi — "Ekle" butonuna tıklayın
              </p>
            )}
            {kayit.ekMaliyetler.map((item, index) => (
              <div key={index} className="flex items-end gap-3">
                <Field label="Açıklama">
                  <Input
                    type="text"
                    value={item.ad}
                    onChange={(e) => updateEkMaliyet(index, "ad", e.target.value)}
                    placeholder="Örn: Nakliye, Sigorta, Genel gider..."
                  />
                </Field>
                <Field label="Tutar (₺)">
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={item.tutar === 0 ? "" : String(item.tutar)}
                    onChange={(e) =>
                      updateEkMaliyet(index, "tutar", e.target.value)
                    }
                    placeholder="0,00"
                    className="tabular-nums"
                  />
                </Field>
                {item.tutar > 0 && (
                  <span className="mb-1.5 text-xs text-muted-foreground whitespace-nowrap">
                    ≈ {formatUSD(item.tutar / (parsePrice(kayit.kur) || 1))}
                  </span>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mb-1 text-destructive hover:text-destructive"
                  onClick={() => removeEkMaliyet(index)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>

          {/* Uyarılar */}
          {!result && (
            <p className="text-sm text-destructive">
              Lütfen geçerli değerler girin (miktar, kur ve fire oranları doğru
              olmalı).
            </p>
          )}

          {bozMalEmpty && result && (
            <InfoNote>
              <strong>Boz mal kg girilmeden</strong> net satılabilir miktar ve
              kilo başı maliyet hesaplanamaz. Boz mal kg değerini girdiğinizde
              sonuçlar otomatik dolar.
            </InfoNote>
          )}

          {netSifir && (
            <InfoNote>
              <strong>Net satılabilir miktar sıfır veya negatif.</strong> Boz mal
              miktarını azaltın ya da fire oranlarını kontrol edin.
            </InfoNote>
          )}

          {asiriFire && (
            <InfoNote>
              <strong>Dikkat:</strong> net satılabilir miktar ham miktarın
              %1'inden az — sonuçlar aşırı fireye göre hesaplanıyor, girdileri
              kontrol edin.
            </InfoNote>
          )}

          {/* Fire hesabı */}
          <ResultBox>
            <div className="flex items-center justify-between gap-4 px-5 py-2 border-b border-border/70">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Fire Hesabı
              </span>
              <div className="flex gap-8 text-xs font-medium text-muted-foreground">
                <span className="w-28 text-right">kg</span>
                <span className="w-20 text-right">%</span>
              </div>
            </div>
            <ResultRow
              label="Ham Tiftik"
              value={kg(Number.isFinite(hamMiktar) ? hamMiktar : null)}
            />
            <ResultRow
              label="Yıkama Firesi"
              value={
                result ? (
                  <span className="flex gap-6">
                    <span className="w-28 text-right font-mono text-sm font-medium tabular-nums">
                      {kg(result.yikamaFireKg)}
                    </span>
                    <span className="w-20 text-right font-mono text-sm tabular-nums text-muted-foreground">
                      %{formatNumber(result.yikamaFireOran, 2, 2)}
                    </span>
                  </span>
                ) : (
                  "—"
                )
              }
            />
            <ResultRow
              label="Boz Mal"
              value={
                result ? (
                  <span className="flex gap-6">
                    <span className="w-28 text-right font-mono text-sm font-medium tabular-nums">
                      {kg(result.bozMalFireKg)}
                    </span>
                    <span className="w-20 text-right font-mono text-sm tabular-nums text-muted-foreground">
                      %{formatNumber(result.bozMalFireOran, 2, 2)}
                    </span>
                  </span>
                ) : (
                  "—"
                )
              }
            />
            <ResultRow
              label="İşleme Firesi"
              value={
                result ? (
                  <span className="flex gap-6">
                    <span className="w-28 text-right font-mono text-sm font-medium tabular-nums">
                      {kg(result.islemeFireKg)}
                    </span>
                    <span className="w-20 text-right font-mono text-sm tabular-nums text-muted-foreground">
                      %{formatNumber(result.islemeFireOran, 2, 2)}
                    </span>
                  </span>
                ) : (
                  "—"
                )
              }
            />
            <ResultTotalRow
              label="Toplam Fire"
              value={
                result ? (
                  <span className="flex gap-6">
                    <span className="w-28 text-right font-mono text-lg font-semibold tabular-nums">
                      {kg(result.toplamFireKg)}
                    </span>
                    <span className="w-20 text-right font-mono text-lg font-semibold tabular-nums text-muted-foreground">
                      %{formatNumber(result.toplamFireOran, 2, 2)}
                    </span>
                  </span>
                ) : (
                  "—"
                )
              }
            />
            <div className="border-t border-border/70">
              <ResultTotalRow
                label="Net Satılabilir"
                value={kg(Number.isFinite(netKg) ? netKg : null)}
              />
            </div>
          </ResultBox>

          {/* Maliyet kalemleri — TL ve USD */}
          <ResultBox>
            <div className="flex items-center justify-between gap-4 px-5 py-2 border-b border-border/70">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Maliyet Kalemleri
              </span>
              <div className="flex gap-8 text-xs font-medium text-muted-foreground">
                <span className="w-28 text-right">₺</span>
                <span className="w-24 text-right">$</span>
              </div>
            </div>
            <ResultRow
              label="Ham Alım"
              value={
                result ? (
                  <DualValue
                    tl={formatTRY(result.hamAlim)}
                    usd={formatUSD(result.hamAlim / (parsePrice(kayit.kur) || 1))}
                  />
                ) : (
                  "—"
                )
              }
            />
            <ResultRow
              label="Yıkama Ücreti"
              value={
                result ? (
                  <DualValue
                    tl={formatTRY(result.yikamaUcretiToplam)}
                    usd={formatUSD(
                      result.yikamaUcretiToplam / (parsePrice(kayit.kur) || 1),
                    )}
                  />
                ) : (
                  "—"
                )
              }
            />

            {result && result.ekMaliyetlerToplam > 0 && (
              <ResultRow
                label={`Elle Eklenen (${kayit.ekMaliyetler.filter((e) => e.tutar > 0).length} kalem)`}
                value={
                  <DualValue
                    tl={formatTRY(result.ekMaliyetlerToplam)}
                    usd={formatUSD(
                      result.ekMaliyetlerToplam / (parsePrice(kayit.kur) || 1),
                    )}
                  />
                }
              />
            )}
            <ResultTotalRow
              label="Toplam Maliyet"
              value={
                result ? (
                  <DualValue
                    tl={formatTRY(result.toplamMaliyet)}
                    usd={formatUSD(result.toplamMaliyetUSD)}
                  />
                ) : (
                  "—"
                )
              }
            />
          </ResultBox>

          {/* Satış & kâr — TL ve USD */}
          <ResultBox>
            <div className="flex items-center justify-between gap-4 px-5 py-2 border-b border-border/70">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Satış & Kâr Analizi
              </span>
              <div className="flex gap-8 text-xs font-medium text-muted-foreground">
                <span className="w-28 text-right">₺</span>
                <span className="w-24 text-right">$</span>
              </div>
            </div>
            <ResultRow
              label={
                kayit.alimBirim === "usd"
                  ? `Alış — ${formatNumber(parseTurkishNumber(kayit.alimUsd) || 0, 2, 2)} USD × ${formatNumber(parseTurkishNumber(kayit.kur) || 0, 2, 2)}`
                  : `Alış — ${formatNumber(parseTurkishNumber(kayit.alimUsd) || 0, 2, 2)} ₺/kg`
              }
              value={
                result ? (
                  <DualValue
                    tl={formatTRY(result.alimTL)}
                    usd={formatUSD(result.alimUSD)}
                  />
                ) : (
                  "—"
                )
              }
            />
            <ResultRow
              label={
                kayit.satisBirim === "usd"
                  ? `Satış — ${formatNumber(parseTurkishNumber(kayit.satisFiyat) || 0, 2, 2)} USD × ${formatNumber(parseTurkishNumber(kayit.kur) || 0, 2, 2)}`
                  : `Satış — ${formatNumber(parseTurkishNumber(kayit.satisFiyat) || 0, 2, 2)} ₺/kg`
              }
              value={
                result ? (
                  <DualValue
                    tl={formatTRY(result.satisTL)}
                    usd={formatUSD(result.satisUSD)}
                  />
                ) : (
                  "—"
                )
              }
            />
            <ResultRow
              label="Kilo Başı Maliyet"
              value={
                result?.birimMaliyet != null ? (
                  <DualValue
                    tl={formatTRY(result.birimMaliyet)}
                    usd={formatUSD(result.birimMaliyetUSD!)}
                  />
                ) : (
                  "—"
                )
              }
            />
            <ResultRow
              label="Toplam Gelir"
              value={
                result?.toplamGelir != null ? (
                  <DualValue
                    tl={formatTRY(result.toplamGelir)}
                    usd={formatUSD(result.toplamGelirUSD!)}
                  />
                ) : (
                  "—"
                )
              }
            />
            <ResultRow
              label="Brüt Kâr"
              value={
                brutKar != null ? (
                  <DualValue
                    tl={`${brutKar > 0 ? "+" : ""}${formatTRY(brutKar)}`}
                    usd={`${brutKarUSD != null && brutKarUSD > 0 ? "+" : ""}${formatUSD(brutKarUSD!)}`}
                  />
                ) : (
                  "—"
                )
              }
              valueClassName={profitColor(brutKar)}
            />
            <ResultRow
              label="Kilo Başı Kâr"
              value={
                kiloBasiKar != null ? (
                  <DualValue
                    tl={`${kiloBasiKar > 0 ? "+" : ""}${formatTRY(kiloBasiKar)}`}
                    usd={`${kiloBasiKarUSD != null && kiloBasiKarUSD > 0 ? "+" : ""}${formatUSD(kiloBasiKarUSD!)}`}
                  />
                ) : (
                  "—"
                )
              }
              valueClassName={profitColor(kiloBasiKar)}
            />
            <ResultRow
              label="Kâr Marjı"
              value={
                karMarji != null
                  ? `${karMarji > 0 ? "+" : ""}${formatNumber(karMarji, 2, 2)}%`
                  : "—"
              }
              valueClassName={profitColor(karMarji)}
            />
            <ResultTotalRow
              label="Başabaş Satış Fiyatı"
              value={
                result?.basabasUsd != null && result.birimMaliyet != null
                  ? `${formatTRY(result.birimMaliyet)} · ${formatNumber(result.basabasUsd, 2, 2)} USD/kg`
                  : "—"
              }
              valueClassName={cn(
                "text-xs sm:text-sm",
                result?.basabasUsd != null &&
                  result.satisUSD != null &&
                  result.basabasUsd > result.satisUSD
                  ? "text-destructive"
                  : result?.basabasUsd != null
                    ? "text-emerald-700 dark:text-emerald-300"
                    : undefined,
              )}
            />
          </ResultBox>

          <p className="text-xs text-muted-foreground print-hide">
            Başabaş satış: kilo başı maliyetin karşılandığı fiyat. Satış fiyatı
            başabaşın altındaysa zarar edilir (kırmızı işaret).
          </p>
        </div>
      </CalcCard>
    </div>
  );
}
