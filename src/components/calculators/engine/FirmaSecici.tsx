import { Check } from "lucide-react";
import { useState } from "react";
import { UNVANLAR } from "@/data/masrafListesi";
import { araFiltre } from "@/lib/finance/araNorm";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * Firma seçici: ünvan veya vergi numarası alanları için aranabilir liste.
 * Türkçe duyarlı arama yapar ("migros" → "MİGROS TİCARET A.Ş.").
 * Seçimde ünvan + vergi no birlikte döner; liste dışında elle giriş serbesttir.
 */
interface FirmaSeciciProps {
  id?: string;
  /** "unvan": ana değer ünvan, yan bilgi vergi no · "kod": tersi */
  mod: "unvan" | "kod";
  deger: string;
  onChange: (yazi: string) => void;
  onSec: (secim: { unvan: string; kod: string }) => void;
  placeholder: string;
  className?: string;
}

export function FirmaSecici({
  id,
  mod,
  deger,
  onChange,
  onSec,
  placeholder,
  className,
}: FirmaSeciciProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Input
          id={id}
          value={deger}
          placeholder={placeholder}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          className={cn("h-9 text-sm", mod === "kod" && "tabular-nums", className)}
        />
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        <Command filter={araFiltre}>
          <CommandInput
            value={deger}
            onValueChange={onChange}
            placeholder={placeholder}
            className="h-9 text-sm"
          />
          <CommandList className="max-h-64">
            <CommandEmpty>Sonuç yok — elle girebilirsiniz.</CommandEmpty>
            {UNVANLAR.map((u) => {
              const secili = mod === "unvan" ? u.unvan === deger : u.kod === deger;
              return (
                <CommandItem
                  key={u.kod}
                  value={`${u.unvan} ${u.kod}`}
                  onSelect={() => {
                    onSec({ unvan: u.unvan, kod: u.kod });
                    setOpen(false);
                  }}
                  className="flex cursor-pointer items-center justify-between gap-3"
                >
                  <span
                    className={cn(
                      "min-w-0 truncate",
                      mod === "unvan" ? "text-sm" : "text-sm tabular-nums",
                    )}
                  >
                    {mod === "unvan" ? u.unvan : u.kod}
                  </span>
                  <span className="min-w-0 shrink truncate text-xs text-muted-foreground">
                    {mod === "unvan" ? u.kod : u.unvan}
                  </span>
                  {secili && <Check className="size-3.5 shrink-0" />}
                </CommandItem>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
