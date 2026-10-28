import { Check } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { UNVANLAR } from "@/data/masrafListesi";
import { araNorm } from "@/lib/finance/araNorm";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * Firma seçici: ünvan veya vergi numarası alanları için aranabilir + serbest yazım
 * girebilen combobox.
 *
 * - Elle giriş serbesttir: yazılan metin alana aynen kaydedilir, listede
 *   eşleşme yoksa da "yazdığınız olarak kalır".
 * - Arama listeyi filtreler: Türkçe duyarlı ("migros" → "MİGROS TİCARET A.Ş."),
 *   ünvan VE vergi numarası üzerinde arar ("1906" ya da "opet" yeter).
 * - Klavye: ↑/↓ liste içinde gezinir, Enter vurgulanan satırı seçer, Escape kapatır.
 * - Liste, statik rehberin önüne eklenen kullanıcı kayıtlarıyla gelir.
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

/** Arama boşken liste çok uzamasın: ilk bu kadar kayıt gösterilir. */
const AZAMI_SONUC = 100;

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
  const [vurgu, setVurgu] = useState(0);
  const satirRef = useRef<(HTMLButtonElement | null)[]>([]);

  /** Tekilleştirilmiş tam liste: kullanıcı kayıtları önce, statik rehber sonra. */
  const rehber = useMemo(() => {
    const gorulen = new Set<string>();
    const cikti: { kod: string; unvan: string }[] = [];
    for (const u of [...(ekRehber ?? []), ...UNVANLAR]) {
      const unvan = (u.unvan ?? "").trim();
      const kod = (u.kod ?? "").trim();
      if (!unvan && !kod) continue;
      const key = `${unvan.toLocaleUpperCase("tr-TR")}|${kod}`;
      if (gorulen.has(key)) continue;
      gorulen.add(key);
      cikti.push({ kod, unvan });
    }
    return cikti;
  }, [ekRehber]);

  /** Türkçe duyarlı filtre: sorgudaki tüm kelimeler ünvan+vergino birleşiminde geçmeli. */
  const sonuc = useMemo(() => {
    const sorgu = deger.trim();
    if (!sorgu) return rehber;
    const kelimeler = araNorm(sorgu).split(/\s+/).filter(Boolean);
    const eslenen = rehber.filter((u) => {
      const hedef = araNorm(`${u.unvan} ${u.kod}`);
      return kelimeler.every((k) => hedef.includes(k));
    });
    return eslenen.slice(0, AZAMI_SONUC);
  }, [rehber, deger]);

  /** Liste tanımına göre sınırda tutulan vurgu (render sırasında clamp edilir). */
  const satir = Math.min(vurgu, Math.max(0, sonuc.length - 1));

  /* Vurgulanan satırı görüş alanına kaydır. */
  useEffect(() => {
    if (!open) return;
    satirRef.current[satir]?.scrollIntoView({ block: "nearest" });
  }, [satir, open]);

  const sec = (u: { kod: string; unvan: string }) => {
    onSec({ unvan: u.unvan, kod: u.kod });
    setOpen(false);
  };

  const klavye = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!open) {
        setOpen(true);
        return;
      }
      e.preventDefault();
      if (sonuc.length === 0) return;
      if (e.key === "ArrowDown") setVurgu(Math.min(satir + 1, sonuc.length - 1));
      else setVurgu(Math.max(satir - 1, 0));
      return;
    }
    if (e.key === "Enter" && open && sonuc.length > 0) {
      e.preventDefault();
      sec(sonuc[satir]);
    }
  };

  /** Liste satırına tıklarken girdinin odağını koru — yazı silinmesin. */
  const yazimSirasinda = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
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
            setVurgu(0); // yeni aramada vurgu başa dönsün
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={klavye}
          className={cn("h-9 text-sm", mod === "kod" && "tabular-nums", className)}
        />
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        /** Odak girdide kalsın — yazmaya devam edilebilsin. */
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div
          role="listbox"
          aria-label={mod === "unvan" ? "Firma listesi" : "Vergi numarası listesi"}
          className="max-h-64 overflow-y-auto py-1"
        >
          {sonuc.length === 0 ? (
            <p className="text-muted-foreground px-3 py-4 text-center text-sm">
              Sonuç yok — yazdığınız olarak kalır.
            </p>
          ) : (
            sonuc.map((u, i) => {
              const secili = mod === "unvan" ? u.unvan === deger : u.kod === deger;
              return (
                <button
                  key={`${u.kod || "-"}|${u.unvan}`}
                  type="button"
                  role="option"
                  aria-selected={i === satir}
                  ref={(el) => {
                    satirRef.current[i] = el;
                  }}
                  onMouseDown={yazimSirasinda}
                  onMouseMove={() => setVurgu(i)}
                  onClick={() => sec(u)}
                  className={cn(
                    "hover:bg-accent hover:text-accent-foreground flex w-full cursor-pointer items-center justify-between gap-3 px-2 py-1.5 text-left text-sm outline-none",
                    i === satir && "bg-accent text-accent-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "min-w-0 truncate",
                      mod === "unvan" ? "" : "tabular-nums",
                    )}
                  >
                    {mod === "unvan" ? u.unvan : u.kod}
                  </span>
                  <span className="text-muted-foreground min-w-0 shrink truncate text-xs">
                    {mod === "unvan" ? u.kod : u.unvan}
                  </span>
                  {secili && <Check className="size-3.5 shrink-0" />}
                </button>
              );
            })
          )}
        </div>
        {deger.trim() && rehber.length > AZAMI_SONUC && (
          <p className="text-muted-foreground border-t px-3 py-2 text-[11px]">
            İlk {AZAMI_SONUC} sonuç — daha dar arama yazın.
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
