import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/Wordmark";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CalendarClock,
  LayoutList,
  Users,
  Wallet,
} from "lucide-react";
import { Link } from "react-router";

const features = [
  {
    icon: Wallet,
    title: "Kasa & Banka",
    text: "Nakit ve banka hesaplarınızı tek listede, güncel bakiyeleriyle izleyin.",
  },
  {
    icon: CalendarClock,
    title: "Ödeme Takibi",
    text: "Yaklaşan ödemelerinizi planlayın, gecikenleri takip edin ve rapor alın.",
  },
  {
    icon: Users,
    title: "Cari Yönetimi",
    text: "Müşteri ve tedarikçi bakiyelerini alacak / borç dengesiyle takip edin.",
  },
  {
    icon: LayoutList,
    title: "Görev Yönetimi",
    text: "Günlük görevlerinizi Todoist gibi organize edin, bölümlere ayırın ve takip edin.",
  },
];

const previewBars = [34, 52, 40, 66, 48, 74, 58, 62, 44, 70, 55, 60];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Üst çubuk */}
      <header className="border-b border-border/70">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Wordmark />
          <Button asChild variant="ghost" size="sm">
            <Link to="/dashboard">Panele Git</Link>
          </Button>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-6 pb-20 pt-20 sm:pt-28">
          <div className="mx-auto max-w-2xl text-center">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground">
                Profesyonel Muhasebe Yazılımı
              </p>
              <h1 className="mt-5 text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
                İşletmenizin mali durumu, tek ekranda.
              </h1>
              <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-muted-foreground">
                Mizan ile kasa ve bankalarınızı, gelir ve giderlerinizi sade bir
                panelden izleyin. Verileriniz bu tarayıcıda güvenle saklanır,
                sayfa yenilense de korunur.
              </p>
              <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
                <Button asChild size="lg">
                  <Link to="/dashboard">
                    Panele giriş yapın
                    <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <a href="#ozellikler">Özellikleri incele</a>
                </Button>
              </div>
            </motion.div>

            {/* Ürün önizlemesi — statik, tek renk */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
              className="mx-auto mt-16 max-w-3xl rounded-lg border bg-card p-6 text-left sm:p-8"
            >
              <div className="flex flex-wrap items-start justify-between gap-6">
                <div>
                  <p className="text-xs text-muted-foreground">Toplam Kasa</p>
                  <p className="mt-1 font-mono text-2xl font-medium tabular-nums tracking-tight">
                    ₺295.550,00
                  </p>
                </div>
                <div className="flex gap-8">
                  <div>
                    <p className="text-xs text-muted-foreground">Bu Ay Gelir</p>
                    <p className="mt-1 font-mono text-sm tabular-nums">
                      ₺110.620
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Bu Ay Gider</p>
                    <p className="mt-1 font-mono text-sm tabular-nums">
                      ₺73.410
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Net</p>
                    <p className="mt-1 font-mono text-sm tabular-nums">
                      ₺37.210
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-8 flex h-28 items-end gap-1.5 border-b border-border">
                {previewBars.map((height, index) => (
                  <div
                    key={index}
                    className={
                      index % 2 === 0
                        ? "flex-1 rounded-t-[2px] bg-foreground/90"
                        : "flex-1 rounded-t-[2px] bg-muted-foreground/40"
                    }
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Ağustos 2026 — günlük gelir / gider özeti
              </p>
            </motion.div>
          </div>
        </section>

        {/* Özellikler */}
        <section
          id="ozellikler"
          className="mx-auto max-w-6xl scroll-mt-16 px-6 pb-24"
        >
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight">
              Muhasebecinizin ihtiyaç duyduğu her şey
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Kasadan ödeme planlamaya, cari hesaptan aylık özete — Mizan
              modülleri tek bir sade arayüzde toplanır.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <div key={feature.title} className="bg-card p-6">
                <feature.icon className="size-5 text-foreground" strokeWidth={1.5} />
                <h3 className="mt-4 text-sm font-semibold text-foreground">
                  {feature.title}
                </h3>
                <p className="mt-2 text-[13px] leading-5 text-muted-foreground">
                  {feature.text}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Kapanış CTA */}
        <section className="border-t border-border/70">
          <div className="mx-auto max-w-6xl px-6 py-20 text-center">
            <h2 className="text-2xl font-semibold tracking-tight">
              Bugün başlayın — sadece birkaç saniye.
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
              Verileriniz bu tarayıcıda güvenle saklanır; hesap veya şifre
              gerekmez. Panele girin, ilk genel bakışınız hazır olsun.
            </p>
            <Button asChild size="lg" className="mt-8">
              <Link to="/dashboard">
                Panele giriş yapın
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      {/* Alt bilgi */}
      <footer className="border-t border-border/70">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
          <Wordmark />
          <p className="text-xs text-muted-foreground">
            © 2026 Mizan — Profesyonel Muhasebe Yazılımı
          </p>
          <div className="flex items-center gap-5 text-xs text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors">
              Gizlilik
            </a>
            <a href="#" className="hover:text-foreground transition-colors">
              Destek
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
