import { cn } from "@/lib/utils";
import { formatInputValue } from "@/lib/finance/format";
import { useCallback, useRef, useState } from "react";

interface FormattedInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  value: number;
  onChange: (value: number) => void;
}

/**
 * Sayısal input: yazarken 100.000, kaydedince 100000 (sayı).
 * Ondalık virgülle girilir: 1234,56
 * Zorla ondalık eklenmez — sadece binlik ayraç.
 */
export function FormattedInput({
  value,
  onChange,
  className,
  ...rest
}: FormattedInputProps) {
  // Sayıyı binlik ayraçlarıyla göster (ondalık yok)
  const formatDisplay = (num: number): string => {
    if (num === 0) return "";
    // Ondalıksız göster
    return formatInputValue(Math.round(num).toString());
  };

  const [displayValue, setDisplayValue] = useState(() => formatDisplay(value));
  const lastEmitted = useRef(value);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      // Sadece rakam, nokta ve virgüle izin ver
      let cleaned = raw.replace(/[^\d.,]/g, "");
      // Birden fazla virgül/nokta varsa düzelt
      cleaned = cleaned.replace(/\.+/g, ".").replace(/,/, ",");

      // Virgül varsa ondalıklı, yoksa ondalıksız
      if (cleaned.includes(",")) {
        // Virgülden sonra en fazla 2 basamak
        const [intPart, decPart] = cleaned.split(",");
        const limitedDec = decPart?.slice(0, 2) ?? "";
        const formattedInt = formatInputValue(intPart ?? "0");
        setDisplayValue(`${formattedInt}${limitedDec ? "," + limitedDec : ","}`);
      } else {
        // Binlik ayraçları ekle
        const numericValue = parseInt(cleaned.replace(/\./g, ""), 10);
        if (!isNaN(numericValue)) {
          setDisplayValue(formatInputValue(numericValue.toString()));
        } else if (cleaned === "" || cleaned === ".") {
          setDisplayValue(cleaned);
        }
      }

      // Sayısal değeri hesapla ve ata
      const num = parseFloat(cleaned.replace(/\./g, "").replace(",", "."));
      if (!isNaN(num) && num !== lastEmitted.current) {
        lastEmitted.current = num;
        onChange(num);
      }
    },
    [onChange],
  );

  const handleBlur = useCallback(() => {
    setDisplayValue(formatDisplay(lastEmitted.current));
  }, []);

  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      className={cn(
        "rounded-md border border-border/70 bg-background px-3 py-2 text-sm font-medium tabular-nums text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/30",
        className,
      )}
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      {...rest}
    />
  );
}
