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
import { parseTurkishNumber, todayIso } from "@/lib/finance/format";
import {
  convertHistorical,
  fetchCurrencyList,
  fetchHistoricalRates,
  type HistCurrency,
  type HistRates,
} from "@/lib/finance/historicalRates";
import { convertRate, type RateSnapshot } from "@/lib/finance/rates";
import { ArrowLeftRight } from "lucide-react";
import { useEffect, useState } from "react";
import { CalcCard, Field, InfoNote, PrintButton, PrintHeader, Segmented, formatNumber } from "./shared";

const CURRENCIES = [
  { code: "TRY", label: "Türk Lirası" },
  { code: "USD", label: "Dolar" },
  { code: "EUR", label: "Euro" },
  { code: "GBP", label: "Sterlin" },
  { code: "XAU", label: "Gram Altın" },
  { code: "XAG", label: "Gram Gümüş" },
];

const SYMBOLS: Record<string, string> = {
  TRY: "₺",
  USD: "$",
  EUR: "€",
  GBP: "£",
  XAU: "gr",
  XAG: "gr",
};

function withSymbol(code: string, value: number, maxFraction: number): string {
  const symbol = SYMBOLS[code];
  const space = code === "XAU" || code === "XAG" ? "\u00A0" : "";
  return `${symbol}${space}${formatNumber(value, 2, maxFraction)}`;
}

type KurMod = "canli" | "tarihli";

export function KurCevir({ snapshot }: { snapshot: RateSnapshot | null }) {
  const [mod, setMod] = useState<KurMod>("canli");
  const [amount, setAmount] = useState("1000");
  const [from, setFrom] = useState("TRY");
  const [to, setTo] = useState("USD");

  // Tarihli mod (170+ para birimi + kripto)
  const [hAmount, setHAmount] = useState("100");
  const [hFrom, setHFrom] = useState("USD");
  const [hTo, setHTo] = useState("EUR");
  const [tarih, setTarih] = useState(todayIso);
  const [kurList, setKurList] = useState<HistCurrency[] | null>(null);
  const [histState, setHistState] = useState<{
    istenen: string;
    data: HistRates | null;
    hata: string;
  }>({ istenen: "", data: null, hata: "" });
  // İstenen tarih henüz çekilmemişse yükleniyor sayılır — efekt içinde senkron setState yok
  const hist = histState.istenen === tarih ? histState.data : null;
  const histLoading = mod === "tarihli" && histState.istenen !== tarih;
  const histError = histState.istenen === tarih ? histState.hata : "";

  // Para birimi listesi bir kez çekilir
  useEffect(() => {
    let alive = true;
    fetchCurrencyList()
      .then((list) => {
        if (alive) setKurList(list);
      })
      .catch(() => {
        if (alive) setKurList([]); // yedek kısa liste kullanılır
      });
    return () => {
      alive = false;
    };
  }, []);

  // Seçili tarihin kurlarını getir (setState yalnızca asenkron geri çağrıda)
  useEffect(() => {
    if (mod !== "tarihli") return;
    let alive = true;
    fetchHistoricalRates(tarih)
      .then((h) => {
        if (alive) setHistState({ istenen: tarih, data: h, hata: "" });
      })
      .catch((e) => {
        if (alive)
          setHistState({
            istenen: tarih,
            data: null,
            hata:
              e instanceof Error ? e.message : "Kur geçmişi alınamadı.",
          });
      });
    return () => {
      alive = false;
    };
  }, [mod, tarih]);

  const value = parseTurkishNumber(amount);
  const hasRates = snapshot !== null;
  const result =
    hasRates && Number.isFinite(value)
      ? convertRate(snapshot.rates, from, to, value)
      : null;
  const unit =
    hasRates && convertRate(snapshot.rates, from, to, 1) !== null
      ? convertRate(snapshot.rates, from, to, 1)
      : null;

  /** EUR/USD paritesi — 1 € kaç $ eder (canlı kurlardan türetilir). */
  const parite = hasRates ? convertRate(snapshot.rates, "EUR", "USD", 1) : null;

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  const resultMax = to === "TRY" ? 2 : 4;
  const unitMax = 4;

  // Tarihli mod hesapları
  const tarihselSecenekler: { code: string; label: string }[] =
    kurList && kurList.length > 0
      ? kurList.map((c) => ({
          code: c.code,
          label: `${c.code} — ${c.name}${c.crypto ? " (kripto)" : ""}`,
        }))
      : CURRENCIES.map((c) => ({ code: c.code, label: `${c.code} — ${c.label}` }));
  const hValue = parseTurkishNumber(hAmount);
  const hResult =
    hist && Number.isFinite(hValue) && hValue > 0
      ? convertHistorical(hist.rates, hFrom, hTo, hValue)
      : null;
  const hUnit = hist ? convertHistorical(hist.rates, hFrom, hTo, 1) : null;

  return (
    <div className="print-area">
      <PrintHeader
        title="Kur Çevirme Raporu"
        subtitle={result !== null ? `${from} → ${to} dönüşümü` : undefined}
      />
      <CalcCard
        title="Kur Çevirici"
        subtitle="Canlı kurlarla para birimi dönüştürün"
        actions={<PrintButton />}
      >
      <div className="grid gap-6">
        <Segmented<KurMod>
          options={[
            { value: "canli", label: "Canlı Kur (TCMB)" },
            { value: "tarihli", label: "Tarihli Kur (170+ birim)" },
          ]}
          value={mod}
          onChange={setMod}
        />
        {mod === "canli" ? (
          <>
        <div className="grid items-end gap-5 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_1fr]">
          <Field label="Miktar">
            <Input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(formatInputValue(event.target.value))}
              placeholder="0,00"
              className="tabular-nums"
            />
          </Field>
          <Field label="Kimden">
            <Select value={from} onValueChange={setFrom}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((currency) => (
                  <SelectItem key={currency.code} value={currency.code}>
                    {currency.code} — {currency.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="flex items-end">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={swap}
              aria-label="Birimleri takas et"
            >
              <ArrowLeftRight className="size-4" />
            </Button>
          </div>
          <Field label="Kime">
            <Select value={to} onValueChange={setTo}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((currency) => (
                  <SelectItem key={currency.code} value={currency.code}>
                    {currency.code} — {currency.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className="rounded-lg border bg-muted/40 px-5 py-10 text-center">
          <p className="font-mono text-4xl font-semibold tracking-tight tabular-nums">
            {result !== null ? withSymbol(to, result, resultMax) : "—"}
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            {unit !== null
              ? `1 ${from} = ${withSymbol(to, unit, unitMax)} ${to}`
              : "Kurlar yüklenemedi — sayfayı yenileyin veya Yenile butonunu kullanın"}
          </p>
          {parite !== null && (
            <p className="mt-1 font-mono text-sm tabular-nums text-muted-foreground">
              EUR/USD Paritesi: {formatNumber(parite, 4, 4)} — 1 € = {formatNumber(parite, 2, 4)} $
            </p>
          )}
        </div>

        {!hasRates && (
          <InfoNote>
            Kur bilgisi alınamadı. İnternet bağlantınızı kontrol edip yukarıdaki
            "Yenile" butonunu kullanın.
          </InfoNote>
        )}
          </>
        ) : (
          <div className="grid gap-5">
            <div className="grid items-end gap-5 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_1fr]">
              <Field label="Miktar">
                <Input
                  type="text"
                  inputMode="decimal"
                  value={hAmount}
                  onChange={(event) => setHAmount(formatInputValue(event.target.value))}
                  placeholder="0,00"
                  className="tabular-nums"
                />
              </Field>
              <Field label="Kimden">
                <Select value={hFrom} onValueChange={setHFrom}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tarihselSecenekler.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setHFrom(hTo);
                    setHTo(hFrom);
                  }}
                  aria-label="Birimleri takas et"
                >
                  <ArrowLeftRight className="size-4" />
                </Button>
              </div>
              <Field label="Kime">
                <Select value={hTo} onValueChange={setHTo}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tarihselSecenekler.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field label="Kur Tarihi — işlem veya belge tarihi">
              <Input
                type="date"
                value={tarih}
                max={todayIso()}
                onChange={(event) =>
                  setTarih(event.target.value || todayIso())
                }
              />
            </Field>

            <div className="rounded-lg border bg-muted/40 px-5 py-10 text-center">
              {histLoading ? (
                <p className="text-sm text-muted-foreground">
                  {tarih} tarihli kurlar yükleniyor…
                </p>
              ) : histError ? (
                <p className="text-sm text-destructive">{histError}</p>
              ) : hResult !== null ? (
                <>
                  <p className="font-mono text-4xl font-semibold tracking-tight tabular-nums">
                    {formatNumber(hResult, 2, hTo === "TRY" ? 2 : 4)} {hTo}
                  </p>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {hUnit !== null
                      ? `1 ${hFrom} = ${formatNumber(hUnit, 2, 6)} ${hTo}`
                      : `${hFrom} için bu tarihte kur bulunamadı`}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Seçili tarih ve birimler için kur bulunamadı.
                </p>
              )}
            </div>

            {hist && !histLoading && !histError && (
              <p className="text-[11px] text-muted-foreground">
                Kaynak: tarihli kur sürümü · {hist.date}
                {hist.stale
                  ? ` — ${tarih} için veri yayımlanmamış, en yakın tarih kullanıldı`
                  : ""}
              </p>
            )}

            <InfoNote>
              Bu mod işlem/belge tarihine göre geçmiş kurla çevirir (170+ fiat
              para birimi ve 14 kripto). Tarihsel kurlar çevrimiçi kaynaktan
              alınır; internet bağlantısı gerekir.
            </InfoNote>
          </div>
        )}
      </div>
      </CalcCard>
    </div>
  );
}
