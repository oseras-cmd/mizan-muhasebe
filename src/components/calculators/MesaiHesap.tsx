import { formatInputValue } from "@/lib/finance/format";
import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Field, CalcCard, ResultBox, ResultRow, ResultTotalRow, Segmented, InfoNote } from "./shared";
import { formatTRY, parseTurkishNumber } from "@/lib/finance/format";
import { cn } from "@/lib/utils";

/* ─────────────── Varsayılan oranlar (%) ─────────────── */

interface RateState {
  /** Fazla mesai_%150: kanuni fazla mesai (ilk 1 saat veya 11. saat sonrası) */
  overtimeNormal: number;
  /** Fazla mesai_%200: 2. fazla mesai saati / hafta tatili */
  overtimeDouble: number;
  /** Tatil çalışması */
  holidayPay: number;
  /** Gece mesaisi ekstra (22:00-06:00) */
  nightShift: number;
  /** Kısmi süreli çalışma ek */
  partTimeExtra: number;
}

const DEFAULT_RATES: RateState = {
  overtimeNormal: 150,
  overtimeDouble: 200,
  holidayPay: 200,
  nightShift: 27.5,
  partTimeExtra: 25,
};

/* ─────────────── Yardımcı fonksiyonlar ─────────────── */

const gross2daily = (gross: number) => gross / 30;
const daily2hourly = (daily: number) => daily / 7.5;

/* ─────────────── Bileşen ─────────────── */

export function MesaiHesap() {
  const [brut, setBrut] = useState("20000");
  const [gunlukSaat, setGunlukSaat] = useState("8");
  const [fazlaGunlukSaat, setFazlaGunlukSaat] = useState("2");
  const [geceSaat, setGeceSaat] = useState("0");
  const [tatilGun, setTatilGun] = useState("0");

  const [rates, setRates] = useState<RateState>(DEFAULT_RATES);

  const setRate = (key: keyof RateState, value: string) => {
    const num = parseTurkishNumber(value);
    setRates((prev) => ({ ...prev, [key]: Number.isFinite(num) ? num : 0 }));
  };

  const brutValue = parseTurkishNumber(brut);
  const gunlukSaatValue = parseTurkishNumber(gunlukSaat);
  const fazlaGunlukSaatValue = parseTurkishNumber(fazlaGunlukSaat);
  const geceSaatValue = parseTurkishNumber(geceSaat);
  const tatilGunValue = parseTurkishNumber(tatilGun);

  const sonuc = useMemo(() => {
    if (!Number.isFinite(brutValue) || brutValue <= 0) return null;

    const gunlukBrut = gross2daily(brutValue);
    const saatlikBrut = daily2hourly(gunlukBrut);

    // Türkiye'de ayda ortalama ~22,5 iş günü kabul edilir
    const aylikIsgunu = 22.5;

    // ── Fazla mesai ücreti (iş gününde)
    // Kullanıcı "fazlaGunlukSaat" kadar fazla mesai yapıyor,
    // bunun içinde gece saatleri de olabilir.
    // Fazla saat × saatlik × (fazlaMesaiOranı / 100) × 22,5
    const fazlaMesaiAylik =
      fazlaGunlukSaatValue * saatlikBrut * (rates.overtimeNormal / 100) * aylikIsgunu;

    // ── Gece mesai ek +%X
    // 22:00-06:00 arası çalışılan SAATLERE (fazla veya normal fark etmez) ek +%27,5 gibi
    // Burada geceSaatValue, o ayki TOPLAM gece çalışma saatini temsil eder.
    const geceEkAylik =
      geceSaatValue * saatlikBrut * (rates.nightShift / 100);

    // ── Tatil günü ücreti
    const tatilUcret = tatilGunValue * gunlukBrut * (rates.holidayPay / 100);

    // ── Kısmi süreli / ek ödemeler
    const kismiSuresiAylik = brutValue * (rates.partTimeExtra / 100);

    const toplamEk = fazlaMesaiAylik + geceEkAylik + tatilUcret + kismiSuresiAylik;
    const toplamAylikBrut = brutValue + toplamEk;

    return {
      gunlukBrut,
      saatlikBrut,
      fazlaMesaiAylik,
      geceEkAylik,
      tatilUcret,
      kismiSuresiAylik,
      toplamEk,
      toplamAylikBrut,
    };
  }, [
    brutValue,
    gunlukSaatValue,
    fazlaGunlukSaatValue,
    geceSaatValue,
    tatilGunValue,
    rates,
  ]);

  const rateInputs: { key: keyof RateState; label: string; suffix?: string }[] = [
    { key: "overtimeNormal", label: "Fazla Mesai (%150)", suffix: "%" },
    { key: "overtimeDouble", label: "Fazla Mesai (%200)", suffix: "%" },
    { key: "holidayPay", label: "Tatil Günü", suffix: "%" },
    { key: "nightShift", label: "Gece Mesai Ek", suffix: "%" },
    { key: "partTimeExtra", label: "Kısmi Süreli Ek", suffix: "%" },
  ];

  return (
    <CalcCard
      title="İşçi Mesai Hesaplama"
      subtitle="Brüt aylık ücrete göre fazla mesai, gece ve tatil ücretlerini hesaplayın"
      actions={
        <button
          type="button"
          className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          onClick={() => setRates(DEFAULT_RATES)}
        >
          Varsayılana sıfırla
        </button>
      }
    >
      <div className="grid gap-6">
        {/* Girdi alanları */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Aylık Brüt Ücret (₺)">
            <Input
              type="text"
              inputMode="decimal"
              value={brut}
              onChange={(e) => setBrut(formatInputValue(e.target.value))}
              placeholder="20.000,00"
            />
          </Field>
          <Field label="Günlük Çalışma Saati">
            <Input
              type="text"
              inputMode="decimal"
              value={gunlukSaat}
              onChange={(e) => setGunlukSaat(formatInputValue(e.target.value))}
            />
          </Field>
          <Field label="Fazla Mesai (saat/gün)">
            <Input
              type="text"
              inputMode="decimal"
              value={fazlaGunlukSaat}
              onChange={(e) => setFazlaGunlukSaat(formatInputValue(e.target.value))}
            />
          </Field>
          <Field label="Gece Mesai (saat/gün)">
            <Input
              type="text"
              inputMode="decimal"
              value={geceSaat}
              onChange={(e) => setGeceSaat(formatInputValue(e.target.value))}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Tatil Günü (ayda)">
            <Input
              type="text"
              inputMode="decimal"
              value={tatilGun}
              onChange={(e) => setTatilGun(formatInputValue(e.target.value))}
            />
          </Field>
        </div>

        {/* Oranlar (değiştirilebilir) */}
        <div>
          <p className="mb-3 text-xs font-medium text-muted-foreground">
            Oranlar (değiştirilebilir)
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rateInputs.map(({ key, label }) => (
              <div key={key} className="flex items-center gap-2">
                <span className="w-36 shrink-0 text-xs text-muted-foreground">
                  {label}
                </span>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={String(rates[key])}
                  onChange={(e) => setRate(key, e.target.value)}
                  className="w-24"
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Sonuçlar */}
        {sonuc && (
          <ResultBox>
            <ResultRow
              label="Günlük Brüt"
              value={formatTRY(sonuc.gunlukBrut)}
            />
            <ResultRow
              label="Saatlik Brüt (÷ 7,5)"
              value={formatTRY(sonuc.saatlikBrut)}
            />
            <ResultRow
              label="Fazla Mesai (aylık)"
              value={formatTRY(sonuc.fazlaMesaiAylik)}
            />
            {sonuc.geceEkAylik > 0 && (
              <ResultRow
                label="Gece Mesai Ek (aylık)"
                value={formatTRY(sonuc.geceEkAylik)}
              />
            )}
            {sonuc.tatilUcret > 0 && (
              <ResultRow
                label="Tatil Ücreti"
                value={formatTRY(sonuc.tatilUcret)}
              />
            )}
            {sonuc.kismiSuresiAylik > 0 && (
              <ResultRow
                label="Kısmi Süreli Ek"
                value={formatTRY(sonuc.kismiSuresiAylik)}
              />
            )}
            <ResultRow
              label="Toplam Ek Ödeme (aylık)"
              value={formatTRY(sonuc.toplamEk)}
              valueClassName="text-amber-600 dark:text-amber-400"
            />
            <ResultTotalRow
              label="Toplam Aylık Brüt"
              value={formatTRY(sonuc.toplamAylikBrut)}
            />
          </ResultBox>
        )}

        <InfoNote>
          hesaplamada 1 ay = 22,5 iş günü, günlük standart süre = 7,5 saat olarak kabul edilmiştir.
          Oranlar 2026 yılı mevzuatına göre ayarlanmıştır.
        </InfoNote>
      </div>
    </CalcCard>
  );
}
