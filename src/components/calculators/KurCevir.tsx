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
import { parseTurkishNumber } from "@/lib/finance/format";
import { convertRate, type RateSnapshot } from "@/lib/finance/rates";
import { ArrowLeftRight } from "lucide-react";
import { useState } from "react";
import { CalcCard, Field, InfoNote, PrintButton, PrintHeader, formatNumber } from "./shared";

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

export function KurCevir({ snapshot }: { snapshot: RateSnapshot | null }) {
  const [amount, setAmount] = useState("1000");
  const [from, setFrom] = useState("TRY");
  const [to, setTo] = useState("USD");

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
      </div>
      </CalcCard>
    </div>
  );
}
