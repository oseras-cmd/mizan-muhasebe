import { formatInputValue } from "@/lib/finance/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatTRY, parseTurkishNumber, todayIso } from "@/lib/finance/format";
import {
  getRateSnapshotCached,
  type RateCurrency,
} from "@/lib/finance/rates";
import { cn } from "@/lib/utils";
import { Calculator } from "lucide-react";
import { useState } from "react";
import {
  CalcCard,
  Field,
  ResultBox,
  ResultRow,
  ResultTotalRow,
  formatNumber,
} from "./shared";

const DOVIZ_OPTIONS: { code: RateCurrency; label: string }[] = [
  { code: "USD", label: "USD — Dolar" },
  { code: "EUR", label: "EUR — Euro" },
  { code: "GBP", label: "GBP — Sterlin" },
];

interface KurFarkiResult {
  startDate: string;
  endDate: string;
  startRate: number;
  endRate: number;
  eskiDeger: number;
  yeniDeger: number;
  fark: number;
  pct: number;
}

export function KurFarki() {
  const [doviz, setDoviz] = useState<RateCurrency>("USD");
  const [tutar, setTutar] = useState("10000");
  const [baslangic, setBaslangic] = useState("");
  const [bitis, setBitis] = useState(todayIso);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<KurFarkiResult | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const value = parseTurkishNumber(tutar);
    if (!baslangic) {
      setError("Lütfen başlangıç tarihini girin.");
      return;
    }
    if (!Number.isFinite(value) || value <= 0) {
      setError("Lütfen geçerli bir döviz tutarı girin.");
      return;
    }
    if (bitis && bitis < baslangic) {
      setError("Bitiş tarihi başlangıç tarihinden önce olamaz.");
      return;
    }

    setLoading(true);
    try {
      const [startSnap, endSnap] = await Promise.all([
        getRateSnapshotCached(baslangic),
        getRateSnapshotCached(bitis || todayIso()),
      ]);
      const startRate = startSnap?.rates[doviz];
      const endRate = endSnap?.rates[doviz];
      if (startRate == null || endRate == null) {
        setError(
          "Seçilen tarih için kur bulunamadı (hafta sonu veya tatil günü olabilir).",
        );
        return;
      }
      const eskiDeger = value * startRate;
      const yeniDeger = value * endRate;
      const fark = yeniDeger - eskiDeger;
      const pct = ((endRate - startRate) / startRate) * 100;
      setResult({
        startDate: startSnap?.date ?? baslangic,
        endDate: endSnap?.date ?? bitis,
        startRate,
        endRate,
        eskiDeger,
        yeniDeger,
        fark,
        pct,
      });
    } catch {
      setError("Kurlar çekilemedi. İnternet bağlantınızı kontrol edin.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <CalcCard
      title="İki Tarih Arası Kur Farkı"
      subtitle="Döviz cinsi ve tutar için kambiyo kârı / zararı hesaplama"
    >
      <div className="grid gap-6">
        <form onSubmit={handleSubmit} className="grid gap-6">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Döviz Cinsi">
              <Select
                value={doviz}
                onValueChange={(value) => setDoviz(value as RateCurrency)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOVIZ_OPTIONS.map((option) => (
                    <SelectItem key={option.code} value={option.code}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Döviz Tutarı">
              <Input
                type="text"
                inputMode="decimal"
                value={tutar}
                onChange={(event) => setTutar(formatInputValue(event.target.value))}
                placeholder="0,00"
                className="tabular-nums"
              />
            </Field>
            <Field label="Başlangıç Tarihi">
              <Input
                type="date"
                value={baslangic}
                onChange={(event) => setBaslangic(formatInputValue(event.target.value))}
                required
              />
            </Field>
            <Field label="Bitiş Tarihi" hint="Boş bırakılırsa bugün kullanılır">
              <Input
                type="date"
                value={bitis}
                onChange={(event) => setBitis(formatInputValue(event.target.value))}
              />
            </Field>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div>
            <Button type="submit" disabled={loading} className="w-full sm:w-auto">
              <Calculator className="mr-2 size-4" />
              {loading ? "Kurlar çekiliyor…" : "Kur Farkını Hesapla"}
            </Button>
          </div>
        </form>

        {result && (
          <ResultBox>
            <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {doviz} Kur Farkı
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {result.startDate} — {result.endDate} tarihleri arası
                </p>
              </div>
              <span
                className={cn(
                  "rounded px-2 py-0.5 font-mono text-xs font-semibold",
                  result.fark > 0
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : result.fark < 0
                      ? "bg-destructive/10 text-destructive"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {result.fark > 0
                  ? "KAMBİYO KÂRI"
                  : result.fark < 0
                    ? "KAMBİYO ZARARI"
                    : "NÖTR"}
              </span>
            </div>
            <ResultRow
              label={`Başlangıç Kuru (1 ${doviz})`}
              value={`₺${formatNumber(result.startRate, 2, 4)}`}
            />
            <ResultRow
              label={`Bitiş Kuru (1 ${doviz})`}
              value={`₺${formatNumber(result.endRate, 2, 4)}`}
            />
            <ResultRow
              label="Kur Değişimi"
              value={`${result.pct > 0 ? "+" : ""}${formatNumber(result.pct, 2, 2)}%`}
              valueClassName={
                result.pct > 0
                  ? "text-emerald-700 dark:text-emerald-300"
                  : result.pct < 0
                    ? "text-destructive"
                    : undefined
              }
            />
            <ResultRow
              label="Eski Değer (TL)"
              value={formatTRY(result.eskiDeger)}
            />
            <ResultRow
              label="Yeni Değer (TL)"
              value={formatTRY(result.yeniDeger)}
            />
            <ResultTotalRow
              label="KUR FARKI (TL)"
              value={`${result.fark > 0 ? "+" : ""}${formatTRY(result.fark)}`}
              valueClassName={
                result.fark > 0
                  ? "text-emerald-700 dark:text-emerald-300"
                  : result.fark < 0
                    ? "text-destructive"
                    : undefined
              }
            />
          </ResultBox>
        )}
      </div>
    </CalcCard>
  );
}
