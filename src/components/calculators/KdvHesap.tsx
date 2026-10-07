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

type KdvTip = "haric" | "dahil" | "kdvden";

/** 2 ondalıklı tutar normalizasyonu — gösterilen kalemler toplamıyla tutarlı olsun. */
function r2(x: number): number {
  return Math.round(x * 100) / 100;
}

export function KdvHesap() {
  const [tip, setTip] = useState<KdvTip>("haric");
  const [tutar, setTutar] = useState("10000");
  const [oran, setOran] = useState("20");

  const value = parseTurkishNumber(tutar);
  const rate = Number(oran) / 100;

  const result = useMemo(() => {
    if (!Number.isFinite(value) || value <= 0) return null;
    if (tip === "haric") {
      const kdv = r2(value * rate);
      return { matrah: value, kdv, toplam: value + kdv };
    }
    if (tip === "kdvden") {
      // KDV tutarından matrah: Matrah = KDV ÷ Oran, Toplam = Matrah + KDV
      if (rate <= 0) return null;
      const matrah = r2(value / rate);
      return { matrah, kdv: value, toplam: matrah + value };
    }
    const matrah = r2(value / (1 + rate));
    return { matrah, kdv: value - matrah, toplam: value };
  }, [tip, value, rate]);

  return (
    <div className="print-area">
      <PrintHeader
        title="KDV Hesaplama Raporu"
        subtitle={
          result
            ? `${tip === "haric" ? "KDV hariç tutardan" : tip === "dahil" ? "KDV dahil tutardan" : "KDV tutarından matrah"} · Oran %${oran}`
            : undefined
        }
      />
      <CalcCard
        title="KDV Hesaplama"
        subtitle="KDV hariç / dahil dönüşümü ve KDV tutarından matrah bulma"
        actions={<PrintButton />}
      >
      <div className="grid gap-6">
        <Segmented<KdvTip>
          options={[
            { value: "haric", label: "KDV Hariç → Dahil" },
            { value: "dahil", label: "KDV Dahil → Hariç" },
            { value: "kdvden", label: "KDV Tutarından → Matrah" },
          ]}
          value={tip}
          onChange={setTip}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label={
              tip === "kdvden"
                ? "KDV Tutarı (₺)"
                : tip === "dahil"
                  ? "KDV Dahil Tutar (₺)"
                  : "KDV Hariç Tutar / Matrah (₺)"
            }
            hint={
              tip === "kdvden"
                ? "Girdiğiniz tutar KDV tutarıdır — Matrah = KDV ÷ Oran"
                : tip === "dahil"
                  ? "Girdiğiniz tutarın içinde KDV vardır — matrah ve KDV ayrıştırılır"
                  : "Girdiğiniz tutar KDV hariçtir — üzerine KDV eklenerek toplam bulunur"
            }
          >
            <Input
              type="text"
              inputMode="decimal"
              value={tutar}
              onChange={(event) => setTutar(formatInputValue(event.target.value))}
              placeholder="0,00"
              className="tabular-nums"
            />
          </Field>
          <Field label="KDV Oranı">
            <Select value={oran} onValueChange={setOran}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">%1</SelectItem>
                <SelectItem value="10">%10</SelectItem>
                <SelectItem value="20">%20</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>

        <ResultBox>
          <ResultRow
            label="Matrah (KDV Hariç)"
            value={result ? formatTRY(result.matrah) : "—"}
          />
          <ResultRow
            label="KDV Tutarı"
            value={result ? formatTRY(result.kdv) : "—"}
          />
          <ResultTotalRow
            label="Toplam (KDV Dahil)"
            value={result ? formatTRY(result.toplam) : "—"}
          />
        </ResultBox>
      </div>
      </CalcCard>
    </div>
  );
}
