import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { KurCevir } from "@/components/calculators/KurCevir";
import { KurFarki } from "@/components/calculators/KurFarki";
import { PoliceGider } from "@/components/calculators/PoliceGider";
import { KdvHesap } from "@/components/calculators/KdvHesap";
import { TevkifatHesap } from "@/components/calculators/TevkifatHesap";
import { StopajHesap } from "@/components/calculators/StopajHesap";
import { GelirVergisiDilimHesap } from "@/components/calculators/GelirVergisiDilimHesap";
import { MaliyetHesap } from "@/components/calculators/MaliyetHesap";
import { TiftikMaliyet } from "@/components/calculators/TiftikMaliyet";
import { MesaiHesap } from "@/components/calculators/MesaiHesap";
import { MasrafHesap } from "@/components/calculators/MasrafHesap";
import { KdvBeyannameHesap } from "@/components/calculators/KdvBeyannameHesap";
import { DamgaVergisiHesap } from "@/components/calculators/DamgaVergisiHesap";
import { GiderPusulasiHesap } from "@/components/calculators/GiderPusulasiHesap";
import { SmmMakbuzuHesap } from "@/components/calculators/SmmMakbuzuHesap";
import { FinansmanKisitlamaHesap } from "@/components/calculators/FinansmanKisitlamaHesap";
import { BinekOtoHesap } from "@/components/calculators/BinekOtoHesap";
import { KidemIhbarHesap } from "@/components/calculators/KidemIhbarHesap";
import { GirisCikisHesap } from "@/components/calculators/GirisCikisHesap";
import { HarcirahHesap } from "@/components/calculators/HarcirahHesap";
import { AmortismanHesap } from "@/components/calculators/AmortismanHesap";
import { ReeskontHesap } from "@/components/calculators/ReeskontHesap";
import { EnflasyonHesap } from "@/components/calculators/EnflasyonHesap";
import { IbkbHesap } from "@/components/calculators/IbkbHesap";
import { MizanAnalizHesap } from "@/components/calculators/MizanAnalizHesap";
import { XmlEdefterHesap } from "@/components/calculators/XmlEdefterHesap";
import { MukellefProfilHesap } from "@/components/calculators/MukellefProfilHesap";
import { VergiTakvimiHesap } from "@/components/calculators/VergiTakvimiHesap";
import { formatNumber } from "@/components/calculators/shared";
import { type RateCurrency, type ExchangeRates } from "@/lib/finance/rates";
import { useTcmbRates } from "@/lib/finance/tcmbRates";
import { cn } from "@/lib/utils";
import {
  ArrowLeftRight,
  BarChart3,
  BookOpenCheck,
  Boxes,
  Building2,
  CalendarClock,
  CalendarRange,
  Car,
  Clock,
  Coins,
  Equal,
  FileDigit,
  FileSpreadsheet,
  FileText,
  FileSearch,
  Landmark,
  Layers,
  Percent,
  Plane,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  Stamp,
  Table2,
  TrendingUp,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router";

const TABS = [
  { id: "kur", label: "Kur Çevir", icon: ArrowLeftRight },
  { id: "kurfarki", label: "İki Tarih Arası Kur", icon: CalendarRange },
  { id: "ibkb", label: "İBKB Döviz", icon: Coins },
  { id: "police", label: "Poliçe Gider", icon: ShieldCheck },
  { id: "kdv", label: "KDV", icon: Percent },
  { id: "kdvbeyanname", label: "KDV Beyanname", icon: FileSpreadsheet },
  { id: "tevkifat", label: "Tevkifat", icon: FileText },
  { id: "smm", label: "SMM Makbuzu", icon: ReceiptText },
  { id: "stopaj", label: "Stopaj", icon: Building2 },
  { id: "gvDilim", label: "GV Dilim", icon: TrendingUp },
  { id: "damga", label: "Damga Vergisi", icon: Stamp },
  { id: "giderpusulasi", label: "Gider Pusulası", icon: FileDigit },
  { id: "finansman", label: "Finansman Kısıtlama", icon: Equal },
  { id: "binek", label: "Binek Oto Kısıtlama", icon: Car },
  { id: "maliyet", label: "Maliyet", icon: Boxes },
  { id: "tiftik", label: "Tiftik Maliyet", icon: Layers },
  { id: "mesai", label: "Mesai", icon: Clock },
  { id: "masraf", label: "Masraf Listesi", icon: ReceiptText },
  { id: "kidem", label: "Kıdem & İhbar", icon: UserRound },
  { id: "giriscikis", label: "İşe Giriş / Çıkış", icon: Users },
  { id: "harcirah", label: "Harcırah", icon: Plane },
  { id: "amortisman", label: "Amortisman", icon: Table2 },
  { id: "reeskont", label: "Reeskont & Adat", icon: Landmark },
  { id: "enflasyon", label: "Enflasyon Düzeltme", icon: BarChart3 },
  { id: "mizan", label: "Mizan Analiz", icon: FileSearch },
  { id: "edefter", label: "XML e-Defter", icon: BookOpenCheck },
  { id: "mukellef", label: "Mükellef Profil", icon: Wallet },
  { id: "takvim", label: "Vergi Takvimi", icon: CalendarClock },
] as const;

type TabId = (typeof TABS)[number]["id"];

const TAB_GROUPS: { label: string; ids: TabId[] }[] = [
  { label: "Kur & Döviz", ids: ["kur", "kurfarki", "ibkb"] },
  { label: "KDV & Belgeler", ids: ["kdv", "kdvbeyanname", "tevkifat", "smm", "giderpusulasi"] },
  { label: "Vergi Hesapları", ids: ["stopaj", "gvDilim", "damga", "finansman", "binek"] },
  { label: "Bordro & Personel", ids: ["mesai", "kidem", "giriscikis", "harcirah"] },
  { label: "Maliyet & Varlıklar", ids: ["maliyet", "tiftik", "masraf", "police", "amortisman", "reeskont", "enflasyon"] },
  { label: "Analiz & Takip", ids: ["mizan", "edefter", "mukellef", "takvim"] },
];

const RATE_ITEMS: { code: RateCurrency; label: string }[] = [
  { code: "USD", label: "USD" },
  { code: "EUR", label: "EUR" },
  { code: "GBP", label: "GBP" },
  { code: "XAU", label: "ALTIN · GR" },
  { code: "XAG", label: "GÜMÜŞ · GR" },
];

export default function Hesaplayicilar() {
  // ?tab=takvim gibi deep link desteği (örn. ana sayfadaki Vergi Takvimi kartından)
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initialTab = TABS.some((t) => t.id === tabParam) ? (tabParam as TabId) : "kur";
  const [active, setActive] = useState<TabId>(initialTab);
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

      <main className="mx-auto max-w-7xl px-6 pb-20 pt-10 lg:px-8">
        {/* Sayfa başlığı */}
        <div>
          <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground">
            Hesap Araçları
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Hesaplayıcılar
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Canlı döviz kurları, vergi, bordro, maliyet ve analiz hesaplamaları — günlük
            muhasebe işleriniz için {TABS.length} araç. Tüm sonuçlar Excel, PDF ve
            yazdırılabilir rapor olarak alınabilir.
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

        {/* Gruplu sekme barı */}
        <div className="mt-8 space-y-3 border-b border-border/70 pb-4">
          {TAB_GROUPS.map((group) => (
            <div key={group.label} className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 w-36 shrink-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60">
                {group.label}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {group.ids.map((id) => {
                  const tab = TABS.find((t) => t.id === id)!;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setActive(id)}
                      className={cn(
                        "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
                        active === id
                          ? "border-foreground bg-foreground text-background"
                          : "border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                      )}
                    >
                      <tab.icon className="size-3.5" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6">
          {active === "kur" && <KurCevir snapshot={snapshot} />}
          {active === "kurfarki" && <KurFarki />}
          {active === "ibkb" && <IbkbHesap />}
          {active === "police" && <PoliceGider />}
          {active === "kdv" && <KdvHesap />}
          {active === "kdvbeyanname" && <KdvBeyannameHesap />}
          {active === "tevkifat" && <TevkifatHesap />}
          {active === "smm" && <SmmMakbuzuHesap />}
          {active === "stopaj" && <StopajHesap />}
          {active === "gvDilim" && <GelirVergisiDilimHesap />}
          {active === "damga" && <DamgaVergisiHesap />}
          {active === "giderpusulasi" && <GiderPusulasiHesap />}
          {active === "finansman" && <FinansmanKisitlamaHesap />}
          {active === "binek" && <BinekOtoHesap />}
          {active === "maliyet" && <MaliyetHesap />}
          {active === "tiftik" && (
            <TiftikMaliyet usdRate={snapshot?.rates.USD ?? null} />
          )}
          {active === "mesai" && <MesaiHesap />}
          {active === "masraf" && <MasrafHesap />}
          {active === "kidem" && <KidemIhbarHesap />}
          {active === "giriscikis" && <GirisCikisHesap />}
          {active === "harcirah" && <HarcirahHesap />}
          {active === "amortisman" && <AmortismanHesap />}
          {active === "reeskont" && <ReeskontHesap />}
          {active === "enflasyon" && <EnflasyonHesap />}
          {active === "mizan" && <MizanAnalizHesap />}
          {active === "edefter" && <XmlEdefterHesap />}
          {active === "mukellef" && <MukellefProfilHesap />}
          {active === "takvim" && <VergiTakvimiHesap />}
        </div>

        <footer className="mt-14 border-t border-border/70 pt-6 text-center text-xs text-muted-foreground">
          Mizan — verileriniz bu tarayıcıda güvenle saklanır ve sayfa
          yenilense de korunur.
        </footer>
      </main>
    </div>
  );
}
