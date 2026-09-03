import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { KurCevir } from "@/components/calculators/KurCevir";
import { KurFarki } from "@/components/calculators/KurFarki";
import { PoliceGider } from "@/components/calculators/PoliceGider";
import { KdvHesap } from "@/components/calculators/KdvHesap";
import { TevkifatHesap } from "@/components/calculators/TevkifatHesap";
import { StopajHesap } from "@/components/calculators/StopajHesap";
import { MaliyetHesap } from "@/components/calculators/MaliyetHesap";
import { TiftikMaliyet } from "@/components/calculators/TiftikMaliyet";
import { MesaiHesap } from "@/components/calculators/MesaiHesap";
import { MasrafHesap } from "@/components/calculators/MasrafHesap";
import { formatNumber } from "@/components/calculators/shared";
import { type RateCurrency, type ExchangeRates } from "@/lib/finance/rates";
import { useTcmbRates } from "@/lib/finance/tcmbRates";
import { cn } from "@/lib/utils";
import {
  ArrowLeftRight,
  Boxes,
  Building2,
  CalendarRange,
  Clock,
  FileText,
  Layers,
  Percent,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";

const TABS = [
  { id: "kur", label: "Kur Çevir", icon: ArrowLeftRight },
  { id: "kurfarki", label: "İki Tarih Arası Kur", icon: CalendarRange },
  { id: "police", label: "Poliçe Gider", icon: ShieldCheck },
  { id: "kdv", label: "KDV", icon: Percent },
  { id: "tevkifat", label: "Tevkifat", icon: FileText },
  { id: "stopaj", label: "Stopaj", icon: Building2 },
  { id: "maliyet", label: "Maliyet", icon: Boxes },
  { id: "tiftik", label: "Tiftik Maliyet", icon: Layers },
  { id: "mesai", label: "Mesai", icon: Clock },
  { id: "masraf", label: "Masraf Listesi", icon: ReceiptText },
] as const;

type TabId = (typeof TABS)[number]["id"];

const RATE_ITEMS: { code: RateCurrency; label: string }[] = [
  { code: "USD", label: "USD" },
  { code: "EUR", label: "EUR" },
  { code: "GBP", label: "GBP" },
  { code: "XAU", label: "ALTIN · GR" },
  { code: "XAG", label: "GÜMÜŞ · GR" },
];

export default function Hesaplayicilar() {
  const [active, setActive] = useState<TabId>("kur");
  const { data: tcmbData, loading, error: ratesError, refresh: refreshRates } = useTcmbRates();
  // Map TcmbRate[] → RateSnapshot for KurCevir/KurFarki
  const snapshot = tcmbData
    ? {
        date: tcmbData.date,
        rates: {
          USD: tcmbData.rates.find((r) => r.code === "USD")?.forexSelling ?? null,
          EUR: tcmbData.rates.find((r) => r.code === "EUR")?.forexSelling ?? null,
          GBP: tcmbData.rates.find((r) => r.code === "GBP")?.forexSelling ?? null,
          XAU: null,
          XAG: null,
        } satisfies ExchangeRates,
      }
    : null;
  const failed = !snapshot && !loading;

  return (
    <div className="min-h-screen bg-background pl-64 text-foreground">
      <AppHeader />

      <main className="mx-auto max-w-6xl px-6 pb-20 pt-10">
        {/* Sayfa başlığı */}
        <div>
          <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground">
            Hesap Araçları
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Hesaplayıcılar
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Canlı döviz kurları, sigorta ve vergi hesaplamaları — günlük
            muhasebe işleriniz için.
          </p>
        </div>

        {/* Canlı kur şeridi */}
        <section className="mt-8 rounded-lg border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-5 py-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Canlı Kurlar
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {loading && !snapshot
                  ? "Güncelleniyor…"
                  : snapshot
                    ? `${snapshot.date} itibarıyla${ratesError ? " · yaklaşık değerler" : ""}`
                    : ratesError
                      ? ratesError
                      : ""}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => refreshRates()}
              disabled={loading}
            >
              <RefreshCw
                className={cn("size-3.5", loading && "animate-spin")}
              />
              Yenile
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3 lg:grid-cols-5">
            {RATE_ITEMS.map((item) => {
              const rate = snapshot?.rates[item.code];
              return (
                <div key={item.code} className="bg-card px-5 py-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {item.label}
                  </p>
                  <p className="mt-1 font-mono text-lg font-semibold tabular-nums">
                    {loading && !snapshot
                      ? "…"
                      : rate != null
                        ? `₺${formatNumber(rate, 2, 4)}`
                        : "—"}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Sekmeler */}
        <div className="mt-8 flex gap-1 overflow-x-auto border-b border-border/70 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActive(tab.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                active === tab.id
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <tab.icon className="size-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {active === "kur" && <KurCevir snapshot={snapshot} />}
          {active === "kurfarki" && <KurFarki />}
          {active === "police" && <PoliceGider />}
          {active === "kdv" && <KdvHesap />}
          {active === "tevkifat" && <TevkifatHesap />}          { active === "stopaj" && <StopajHesap /> }
          { active === "maliyet" && <MaliyetHesap /> }
          { active === "tiftik" && (
            <TiftikMaliyet usdRate={snapshot?.rates.USD ?? null} />
          )}
          { active === "mesai" && <MesaiHesap /> }
          { active === "masraf" && <MasrafHesap /> }
        </div>

        <footer className="mt-14 border-t border-border/70 pt-6 text-center text-xs text-muted-foreground">
          Mizan — verileriniz bu tarayıcıda güvenle saklanır ve sayfa
          yenilense de korunur.
        </footer>
      </main>
    </div>
  );
}
