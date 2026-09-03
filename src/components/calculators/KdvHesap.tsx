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
import { CalcCard, Field, ResultBox, ResultRow, ResultTotalRow, Segmented } from "./shared";

type KdvTip = "haric" | "dahil";

export function KdvHesap() {
  const [tip, setTip] = useState<KdvTip>("haric");
  const [tutar, setTutar] = useState("10000");
  const [oran, setOran] = useState("20");

  const value = parseTurkishNumber(tutar);
  const rate = Number(oran) / 100;

  const result = useMemo(() => {
    if (!Number.isFinite(value) || value <= 0) return null;
    if (tip === "haric") {
      const kdv = value * rate;
      return { matrah: value, kdv, toplam: value + kdv };
    }
    const matrah = value / (1 + rate);
    return { matrah, kdv: value - matrah, toplam: value };
  }, [tip, value, rate]);

  return (
    <CalcCard title="KDV Hesaplama" subtitle="KDV hariç / dahil dönüşümü">
      <div className="grid gap-6">
        <Segmented<KdvTip>
          options={[
            { value: "haric", label: "KDV Hariç → Dahil" },
            { value: "dahil", label: "KDV Dahil → Hariç" },
          ]}
          value={tip}
          onChange={setTip}
        />
        <div className="grid gap-5 sm:grid-cols-2">
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
  );
}
