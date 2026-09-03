import { formatInputValue } from "@/lib/finance/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatTRY, formatUSD, parseTurkishNumber } from "@/lib/finance/format";
import { computeTiftikMaliyet, type EkMaliyet } from "@/lib/finance/tiftik";
import { cn } from "@/lib/utils";
import { Plus, RotateCcw, Trash2, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import {
  CalcCard,
  Field,
  InfoNote,
  ResultBox,
  ResultRow,
  ResultTotalRow,
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
  genelGiderler: "0",
  satisUsd: "18",
} satisfies Record<string, string>;

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
  const [miktar, setMiktar] = useState(DEFAULTS.miktar);
  const [alimUsd, setAlimUsd] = useState(DEFAULTS.alimUsd);
  const [kur, setKur] = useState(DEFAULTS.kur);
  const [yikamaFire, setYikamaFire] = useState(DEFAULTS.yikamaFire);
  const [islemeFire, setIslemeFire] = useState(DEFAULTS.islemeFire);
  const [bozMal, setBozMal] = useState(DEFAULTS.bozMal);
  const [yikamaUcreti, setYikamaUcreti] = useState(DEFAULTS.yikamaUcreti);
  const [genelGiderler, setGenelGiderler] = useState(DEFAULTS.genelGiderler);
  const [satisUsd, setSatisUsd] = useState(DEFAULTS.satisUsd);
  const [ekMaliyetler, setEkMaliyetler] = useState<EkMaliyet[]>([]);

  const bozMalEmpty = bozMal.trim() === "";

  const result = useMemo(() => {
    const m = parseTurkishNumber(miktar);
    const a = parsePrice(alimUsd);
    const k = parsePrice(kur);
    const yf = parseTurkishNumber(yikamaFire);
    const ifr = parseTurkishNumber(islemeFire);
    const b = bozMalEmpty ? NaN : parseTurkishNumber(bozMal);
    const yu = parseTurkishNumber(yikamaUcreti);
    const gg = parseTurkishNumber(genelGiderler);
    const s = parsePrice(satisUsd);

    if (!Number.isFinite(m) || m <= 0) return null;
    if (!Number.isFinite(a) || a < 0) return null;
    if (!Number.isFinite(k) || k <= 0) return null;
    if (!Number.isFinite(yf) || yf < 0 || yf >= 100) return null;
    if (!Number.isFinite(ifr) || ifr < 0 || ifr >= 100) return null;
    if (!bozMalEmpty && (!Number.isFinite(b) || b < 0)) return null;
    if (!Number.isFinite(yu) || yu < 0) return null;
    if (!Number.isFinite(gg) || gg < 0) return null;
    if (!Number.isFinite(s) || s < 0) return null;

    return computeTiftikMaliyet({
      miktar: m,
      alimUsd: a,
      kur: k,
      yikamaFirePct: yf,
      islemeFirePct: ifr,
      bozMalKg: b,
      yikamaUcreti: yu,
      genelGiderler: gg,
      satisUsd: s,
      ekMaliyetler,
    });
  }, [
    miktar,
    alimUsd,
    kur,
    yikamaFire,
    islemeFire,
    bozMal,
    bozMalEmpty,
    yikamaUcreti,
    genelGiderler,
    satisUsd,
    ekMaliyetler,
  ]);

  const hamMiktar = parseTurkishNumber(miktar);
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
    setEkMaliyetler((prev) => [...prev, { ad: "", tutar: 0 }]);
  }
  function removeEkMaliyet(index: number) {
    setEkMaliyetler((prev) => prev.filter((_, i) => i !== index));
  }
  function updateEkMaliyet(
    index: number,
    field: "ad" | "tutar",
    value: string,
  ) {
    setEkMaliyetler((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              [field]: field === "ad" ? value : parseTurkishNumber(value) || 0,
            }
          : item,
      ),
    );
  }

  function resetAll() {
    setMiktar(DEFAULTS.miktar);
    setAlimUsd(DEFAULTS.alimUsd);
    setKur(DEFAULTS.kur);
    setYikamaFire(DEFAULTS.yikamaFire);
    setIslemeFire(DEFAULTS.islemeFire);
    setBozMal(DEFAULTS.bozMal);
    setYikamaUcreti(DEFAULTS.yikamaUcreti);
    setGenelGiderler(DEFAULTS.genelGiderler);
    setSatisUsd(DEFAULTS.satisUsd);
    setEkMaliyetler([]);
  }

  return (
    <CalcCard
      title="Tiftik Maliyet Hesaplama"
      subtitle="Ham tiftikten satılabilir ürüne: fire akışı, maliyet kalemleri ve kâr analizi"
      actions={
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={resetAll}
        >
          <RotateCcw className="mr-1.5 size-3.5" />
          Sıfırla
        </Button>
      }
    >
      <div className="grid gap-6">
        {/* Temel giriş alanları */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Ham Tiftik Miktarı (kg)">
            <Input
              type="text"
              inputMode="decimal"
              value={miktar}
              onChange={(event) => setMiktar(formatInputValue(event.target.value))}
              placeholder="0"
              className="tabular-nums"
            />
          </Field>
          <Field label="Alım (USD/kg)">
            <Input
              type="text"
              inputMode="decimal"
              value={alimUsd}
              onChange={(event) => setAlimUsd(formatInputValue(event.target.value))}
              placeholder="0,00"
              className="tabular-nums"
            />
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
                value={kur}
                onChange={(event) => setKur(formatInputValue(event.target.value))}
                placeholder="0,00"
                className="tabular-nums"
              />
              {usdRate != null && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setKur(usdRate.toFixed(2).replace(".", ","))}
                  title="Canlı USD kurunu kullan"
                >
                  <Wallet className="mr-1 size-3.5" />
                  Canlı
                </Button>
              )}
            </div>
          </Field>
          <Field label="Yıkama Firesi (%)">
            <Input
              type="text"
              inputMode="decimal"
              value={yikamaFire}
              onChange={(event) => setYikamaFire(formatInputValue(event.target.value))}
              placeholder="0"
              className="tabular-nums"
            />
          </Field>
          <Field label="İşleme Firesi (%)">
            <Input
              type="text"
              inputMode="decimal"
              value={islemeFire}
              onChange={(event) => setIslemeFire(formatInputValue(event.target.value))}
              placeholder="0"
              className="tabular-nums"
            />
          </Field>
          <Field
            label="Boz Mal (kg)"
            hint="Sabit kg — boş bırakılırsa hesaplanamaz"
          >
            <Input
              type="text"
              inputMode="decimal"
              value={bozMal}
              onChange={(event) => setBozMal(formatInputValue(event.target.value))}
              placeholder="0"
              className="tabular-nums"
            />
          </Field>
          <Field label="Yıkama Ücreti (₺/kg)">
            <Input
              type="text"
              inputMode="decimal"
              value={yikamaUcreti}
              onChange={(event) => setYikamaUcreti(formatInputValue(event.target.value))}
              placeholder="0,00"
              className="tabular-nums"
            />
          </Field>
          <Field label="Genel Giderler (₺)">
            <Input
              type="text"
              inputMode="decimal"
              value={genelGiderler}
              onChange={(event) => setGenelGiderler(formatInputValue(event.target.value))}
              placeholder="0,00"
              className="tabular-nums"
            />
          </Field>
          <Field label="Satış (USD/kg)">
            <Input
              type="text"
              inputMode="decimal"
              value={satisUsd}
              onChange={(event) => setSatisUsd(formatInputValue(event.target.value))}
              placeholder="0,00"
              className="tabular-nums"
            />
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
          {ekMaliyetler.length === 0 && (
            <p className="text-xs text-muted-foreground italic">
              Henüz ek maliyet eklenmedi — "Ekle" butonuna tıklayın
            </p>
          )}
          {ekMaliyetler.map((item, index) => (
            <div key={index} className="flex items-end gap-3">
              <Field label="Açıklama">
                <Input
                  type="text"
                  value={item.ad}
                  onChange={(e) => updateEkMaliyet(index, "ad", e.target.value)}
                  placeholder="Örn: Nakliye, Sigorta..."
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
                  ≈ {formatUSD(item.tutar / (parsePrice(kur) || 1))}
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
                  usd={formatUSD(result.hamAlim / (parsePrice(kur) || 1))}
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
                    result.yikamaUcretiToplam / (parsePrice(kur) || 1),
                  )}
                />
              ) : (
                "—"
              )
            }
          />
          <ResultRow
            label="Genel Giderler"
            value={
              result ? (
                <DualValue
                  tl={formatTRY(parseTurkishNumber(genelGiderler) || 0)}
                  usd={formatUSD(
                    (parseTurkishNumber(genelGiderler) || 0) /
                      (parsePrice(kur) || 1),
                  )}
                />
              ) : (
                "—"
              )
            }
          />

          {result && result.ekMaliyetlerToplam > 0 && (
            <ResultRow
              label={`Elle Eklenen (${ekMaliyetler.filter((e) => e.tutar > 0).length} kalem)`}
              value={
                <DualValue
                  tl={formatTRY(result.ekMaliyetlerToplam)}
                  usd={formatUSD(
                    result.ekMaliyetlerToplam / (parsePrice(kur) || 1),
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
            label={`Alış — ${formatNumber(parseTurkishNumber(alimUsd) || 0, 2, 2)} USD × ${formatNumber(parseTurkishNumber(kur) || 0, 2, 2)}`}
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
            label={`Satış — ${formatNumber(parseTurkishNumber(satisUsd) || 0, 2, 2)} USD × ${formatNumber(parseTurkishNumber(kur) || 0, 2, 2)}`}
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
                result.basabasUsd > parseTurkishNumber(satisUsd)
                ? "text-destructive"
                : result?.basabasUsd != null
                  ? "text-emerald-700 dark:text-emerald-300"
                  : undefined,
            )}
          />
        </ResultBox>

        <p className="text-xs text-muted-foreground">
          Başabaş satış: kilo başı maliyetin karşılandığı fiyat. Satış fiyatı
          başabaşın altındaysa zarar edilir (kırmızı işaret).
        </p>
      </div>
    </CalcCard>
  );
}
