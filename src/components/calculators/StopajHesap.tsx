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
import { CalcCard, Field, PrintButton, PrintHeader, ResultBox, ResultRow, ResultTotalRow, Segmented } from "./shared";

const STOPAJ_TYPES = [
  { rate: 20, label: "Kira (Konut) — %20" },
  { rate: 20, label: "Kira (İşyeri) — %20" },
  { rate: 20, label: "Serbest Meslek — %20" },
  { rate: 17, label: "Menkul Kıymet — %17" },
  { rate: 15, label: "İnşaat Taahhüt — %15" },
];

type StopajSekil = "brut" | "net";

export function StopajHesap() {
  const [turIndex, setTurIndex] = useState("0");
  const [sekil, setSekil] = useState<StopajSekil>("brut");
  const [tutar, setTutar] = useState("10000");

  const tutarValue = parseTurkishNumber(tutar);
  const oran = (STOPAJ_TYPES[Number(turIndex)] ?? STOPAJ_TYPES[0]).rate / 100;

  const result = useMemo(() => {
    if (!Number.isFinite(tutarValue) || tutarValue <= 0) return null;
    if (sekil === "brut") {
      const brut = tutarValue;
      const kesinti = brut * oran;
      return { brut, kesinti, net: brut - kesinti };
    }
    const net = tutarValue;
    const brut = net / (1 - oran);
    const kesinti = brut * oran;
    return { brut, kesinti, net };
  }, [tutarValue, oran, sekil]);

  return (
    <div className="print-area">
      <PrintHeader
        title="Stopaj Hesaplama Raporu"
        subtitle={result ? `${(STOPAJ_TYPES[Number(turIndex)] ?? STOPAJ_TYPES[0]).label} · ${sekil === "brut" ? "Brüt üzerinden" : "Net üzerinden"}` : undefined}
      />
      <CalcCard
        title="Stopaj Hesaplama"
        subtitle="Kira, serbest meslek ve diğer gelir türleri için stopaj kesintisi"
        actions={<PrintButton />}
      >
      <div className="grid gap-6">
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Gelir Türü">
            <Select value={turIndex} onValueChange={setTurIndex}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STOPAJ_TYPES.map((tur, index) => (
                  <SelectItem key={index} value={String(index)}>
                    {tur.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Hesaplama Şekli">
            <Segmented<StopajSekil>
              options={[
                { value: "brut", label: "Brüt Üzerinden" },
                { value: "net", label: "Net Üzerinden" },
              ]}
              value={sekil}
              onChange={setSekil}
            />
          </Field>
          <Field label="Tutar (₺)">
            <Input
              type="text"
              inputMode="decimal"
              value={tutar}
              onChange={(event) => setTutar(formatInputValue(event.target.value))}
              placeholder="0,00"
              className="tabular-nums"
            />
          </Field>
        </div>

        <ResultBox>
          <ResultRow
            label="Brüt Tutar"
            value={result ? formatTRY(result.brut) : "—"}
          />
          <ResultRow
            label="Stopaj Kesintisi"
            value={result ? `−${formatTRY(result.kesinti)}` : "—"}
            valueClassName="text-destructive"
          />
          <ResultTotalRow
            label="Net Ödeme"
            value={result ? formatTRY(result.net) : "—"}
          />
        </ResultBox>
      </div>
      </CalcCard>
    </div>
  );
}
