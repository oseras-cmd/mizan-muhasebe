import { Check } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { UNVANLAR } from "@/data/masrafListesi";
import { araFiltre } from "@/lib/finance/araNorm";
import {
  Command,
  CommandEmpty,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * Firma seçici: ünvan veya vergi numarası alanları için aranabilir liste.
 * Türkçe duyarlı arama yapar ("migros" → "MİGROS TİCARET A.Ş.").
 *
 * Odak her zaman girdide kalır: öneri paneli fokus çalmaz ve Enter yazdığınız
 * metni bozmaz; rehberden seçmek için öğeye tıklayın.
 * Liste, statik rehberin önüne eklenen kullanıcı kayıtlarıyla gelir.
 */
interface FirmaSeciciProps {
  id?: string;
  /** "unvan": ana değer ünvan, yan bilgi vergi no · "kod": tersi */
  mod: "unvan" | "kod";
  deger: string;
  onChange: (yazi: string) => void;
  onSec: (secim: { unvan: string; kod: string }) => void;
  placeholder: string;
  /** Statik rehbere ek kullanıcı kayıtları (ünvan + vergi no). */
  ekRehber?: { kod: string; unvan: string }[];
  className?: string;
}

export function FirmaSecici({
  id,
  mod,
  deger,
  onChange,
  onSec,
  placeholder,
  ekRehber,
  className,
}: FirmaSeciciProps) {
  const [open, setOpen] = useState(false);
  const rehber = ekRehber ? [...ekRehber, ...UNVANLAR] : UNVANLAR;

  const kapat = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      setOpen(false);
    }
  };

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
          onKeyDown={kapat}
          className={cn("h-9 text-sm", mod === "kod" && "tabular-nums", className)}
        />
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        /** Odak girdiyi ele geçirmesin — yazı girişi duruyor. */
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command value={deger} filter={araFiltre} shouldFilter={true}>
          <CommandList className="max-h-64">
            <CommandEmpty>Sonuç yok — yazdığınız olarak kalır.</CommandEmpty>
            {rehber.map((u) => {
              const secili = mod === "unvan" ? u.unvan === deger : u.kod === deger;
              return (
                <CommandItem
                  key={`${u.kod}|${u.unvan}`}
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
