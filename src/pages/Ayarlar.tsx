import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import {
  addProduct,
  deleteProduct,
  exportFinanceData,
  importFinanceData,
  resetFinanceData,
  useFinanceData,
} from "@/lib/finance/store";
import {
  createBackup,
  downloadLastBackup,
  formatBackupDate,
  formatBytes,
  getCurrentDataSize,
  getBackupMeta,
  listBackups,
  setAutoBackupEnabled,
} from "@/lib/finance/backupManager";
import { todayIso } from "@/lib/finance/format";
import { cn } from "@/lib/utils";
import { setTheme as setAppTheme } from "@/lib/finance/theme";
import type { Product } from "@/lib/finance/types";
import {
  Clock,
  Database,
  Download,
  HardDrive,
  Info,
  Moon,
  Package,
  RotateCcw,
  Save,
  Shield,
  Sun,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export default function Ayarlar() {
  const data = useFinanceData();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);

  // Backup state
  const [backupMeta, setBackupMetaState] = useState(getBackupMeta);
  const [dataSize, setDataSize] = useState(0);
  const [backupHistory, setBackupHistory] = useState<
    { id: string; date: string; size: number }[]
  >([]);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [isDarkTheme, setIsDarkTheme] = useState(() => {
    try { return document.documentElement.classList.contains("dark"); } catch { return false; }
  });
  const [showProductForm, setShowProductForm] = useState(false);
  const [prodName, setProdName] = useState("");
  const [prodUnit, setProdUnit] = useState("adet");
  const [prodPrice, setProdPrice] = useState("");
  const [prodCategory, setProdCategory] = useState("");

  // Refresh backup info periodically
  useEffect(() => {
    const refresh = async () => {
      setBackupMetaState(getBackupMeta());
      setDataSize(getCurrentDataSize());
      setBackupHistory(await listBackups());
    };
    refresh();
    const timer = setInterval(refresh, 10_000);
    return () => clearInterval(timer);
  }, [data]);

  const handleExport = () => {
    const blob = new Blob([exportFinanceData()], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `mizan-yedek-${todayIso()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Yedek dosyası indirildi.");
  };

  const handleImportFile = async (file: File) => {
    try {
      const raw = await file.text();
      if (importFinanceData(raw)) {
        toast.success("Yedek başarıyla yüklendi.");
      } else {
        toast.error("Dosya geçersiz. Mizan yedek dosyası seçin.");
      }
    } catch {
      toast.error("Dosya okunamadı.");
    }
  };

  const handleReset = () => {
    resetFinanceData();
    setConfirmingReset(false);
    toast.success("Varsayılan verilere dönüldü.");
  };

  const handleCreateBackup = async () => {
    setCreatingBackup(true);
    try {
      const result = await createBackup();
      setBackupMetaState(getBackupMeta());
      setBackupHistory(await listBackups());
      toast.success(
        `Yedek oluşturuldu — ${formatBytes(result.size)}`,
      );
    } catch {
      toast.error("Yedek oluşturulamadı.");
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleDownloadBackup = async () => {
    const ok = await downloadLastBackup();
    if (ok) {
      toast.success("Son yedek indirildi.");
    } else {
      toast.error("İndirilecek yedek bulunamadı.");
    }
  };

  const handleToggleTheme = useCallback(() => {
    const next = isDarkTheme ? "light" : "dark";
    setAppTheme(next);
    setIsDarkTheme(next === "dark");
  }, [isDarkTheme]);

  const handleAddProduct = useCallback(() => {
    if (!prodName.trim() || !prodPrice) {
      toast.error("Ürün adı ve fiyat zorunludur.");
      return;
    }
    const price = parseFloat(prodPrice.replace(/[^\d.,]/g, "").replace(",", "."));
    if (isNaN(price) || price <= 0) {
      toast.error("Geçerli bir fiyat girin.");
      return;
    }
    addProduct({ name: prodName, unit: prodUnit, price, category: prodCategory || undefined });
    toast.success(`"${prodName}" eklendi.`);
    setProdName("");
    setProdPrice("");
    setProdCategory("");
    setShowProductForm(false);
  }, [prodName, prodUnit, prodPrice, prodCategory]);

  const handleToggleAutoBackup = () => {
    const next = !backupMeta.autoBackupEnabled;
    setAutoBackupEnabled(next);
    setBackupMetaState({ ...backupMeta, autoBackupEnabled: next });
    toast.success(
      next ? "Otomatik yedekleme açıldı (her saat)." : "Otomatik yedekleme kapatıldı.",
    );
  };

  const counts = {
    hesap: data.accounts.length,
    islem: data.transactions.length,
    cari: data.contacts.length,
    fatura: data.invoices.length,
    odeme: data.upcomingPayments.length,
    gorev: data.todos.length,
    virman: data.transfers.length,
  };

  return (
    <div className="min-h-screen bg-background pl-64 text-foreground">
      <AppHeader />

      <main className="mx-auto max-w-3xl px-6 pb-20 pt-10">
        {/* Sayfa başlığı */}
        <div>
          <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground">
            Sistem
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Ayarlar
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Verilerinizi yedekleyin, geri yükleyin veya varsayılan örnek
            verilere dönün.
          </p>
        </div>

        {/* Veri özeti */}
        <section className="mt-8 rounded-lg border bg-card">
          <header className="flex items-center gap-3 border-b border-border/70 px-5 py-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-background">
              <Database className="size-4 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Veri Durumu
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Tüm veriler bu tarayıcıda (localStorage) saklanır
              </p>
            </div>
          </header>
          <div className="grid grid-cols-3 gap-px bg-border sm:grid-cols-4 lg:grid-cols-7">
            {[
              { label: "Hesap", value: counts.hesap },
              { label: "İşlem", value: counts.islem },
              { label: "Cari", value: counts.cari },
              { label: "Ödeme", value: counts.odeme },
              { label: "Görev", value: counts.gorev },
              { label: "Virman", value: counts.virman },
              { label: "Fatura", value: counts.fatura },
            ].map((item) => (
              <div key={item.label} className="bg-card p-4 text-center">
                <p className="font-mono text-lg font-medium tabular-nums text-foreground">
                  {item.value}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {item.label}
                </p>
              </div>
            ))}
          </div>
          {/* Veri boyutu */}
          <div className="flex items-center justify-between border-t border-border/70 px-5 py-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <HardDrive className="size-3.5" />
              <span>Tahmini veri boyutu:</span>
            </div>
            <span className="font-mono text-xs font-medium tabular-nums text-foreground">
              {formatBytes(dataSize)}
            </span>
          </div>
        </section>

        {/* Tema */}
        <section className="mt-6 rounded-lg border bg-card">
          <header className="flex items-center gap-3 border-b border-border/70 px-5 py-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-background">
              {isDarkTheme ? <Sun className="size-4 text-muted-foreground" /> : <Moon className="size-4 text-muted-foreground" />}
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-foreground">Tema</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Karanlık veya aydınlık mod seçin</p>
            </div>
            <button type="button" onClick={handleToggleTheme} className={cn("relative h-6 w-11 rounded-full transition-colors", isDarkTheme ? "bg-foreground" : "bg-muted")}>
              <span className={cn("absolute top-0.5 left-0.5 size-5 rounded-full bg-background shadow transition-transform", isDarkTheme && "translate-x-5")} />
            </button>
          </header>
          <div className="px-5 py-4">
            <div className="flex gap-3">
              <button type="button" onClick={() => { setAppTheme("light"); setIsDarkTheme(false); }} className={cn("flex-1 rounded-lg border p-4 text-center text-sm font-medium transition-colors", !isDarkTheme ? "border-foreground bg-foreground text-background" : "border-border/70 bg-background text-muted-foreground hover:bg-muted")}>
                <Sun className="mx-auto mb-2 size-5" /> Aydınlık
              </button>
              <button type="button" onClick={() => { setAppTheme("dark"); setIsDarkTheme(true); }} className={cn("flex-1 rounded-lg border p-4 text-center text-sm font-medium transition-colors", isDarkTheme ? "border-foreground bg-foreground text-background" : "border-border/70 bg-background text-muted-foreground hover:bg-muted")}>
                <Moon className="mx-auto mb-2 size-5" /> Karanlık
              </button>
            </div>
            <p className="mt-3 text-center text-[11px] text-muted-foreground/60">Klavye kısayolu: Ctrl+D</p>
          </div>
        </section>

        {/* Ürün/Hizmet Listesi */}
        <section className="mt-6 rounded-lg border bg-card">
          <header className="flex items-center gap-3 border-b border-border/70 px-5 py-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-background">
              <Package className="size-4 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-foreground">Ürün / Hizmet Listesi</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Sık kullanılan ürün ve hizmetlerinizi kaydedin</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setShowProductForm(!showProductForm)}>
              {showProductForm ? "İptal" : "+ Ekle"}
            </Button>
          </header>
          {showProductForm && (
            <div className="grid grid-cols-2 gap-3 border-b border-border/70 px-5 py-4 sm:grid-cols-4">
              <input type="text" placeholder="Ürün adı" className="rounded-md border border-border/70 bg-background px-3 py-2 text-sm" value={prodName} onChange={(e) => setProdName(e.target.value)} />
              <input type="text" placeholder="Birim (adet, kg, lt)" className="rounded-md border border-border/70 bg-background px-3 py-2 text-sm" value={prodUnit} onChange={(e) => setProdUnit(e.target.value)} />
              <input type="text" placeholder="Fiyat (₺)" className="rounded-md border border-border/70 bg-background px-3 py-2 text-sm font-mono" value={prodPrice} onChange={(e) => setProdPrice(e.target.value)} />
              <input type="text" placeholder="Kategori (opsiyonel)" className="rounded-md border border-border/70 bg-background px-3 py-2 text-sm" value={prodCategory} onChange={(e) => setProdCategory(e.target.value)} />
              <div className="col-span-2 sm:col-span-4">
                <Button type="button" size="sm" onClick={handleAddProduct}>Kaydet</Button>
              </div>
            </div>
          )}
          {data.products.length > 0 ? (
            <ul className="divide-y divide-border/70">
              {data.products.map((p) => (
                <li key={p.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.unit}{p.category ? ` · ${p.category}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm tabular-nums text-foreground">₺{p.price.toLocaleString("tr-TR")}</span>
                    <button type="button" className="text-muted-foreground hover:text-destructive" onClick={() => { deleteProduct(p.id); toast.success("Ürün silindi."); }}>
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-5 py-6 text-center">
              <p className="text-xs text-muted-foreground">Henüz ürün eklenmemiş</p>
            </div>
          )}
        </section>

        {/* Otomatik Yedekleme */}
        <section className="mt-6 rounded-lg border bg-card">
          <header className="flex items-center gap-3 border-b border-border/70 px-5 py-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-background">
              <Shield className="size-4 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-foreground">
                Otomatik Yedekleme
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Verileriniz her saat otomatik olarak yedeklenir
              </p>
            </div>
            <button
              type="button"
              onClick={handleToggleAutoBackup}
              className={cn(
                "relative h-6 w-11 rounded-full transition-colors",
                backupMeta.autoBackupEnabled
                  ? "bg-foreground"
                  : "bg-muted",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 left-0.5 size-5 rounded-full bg-background shadow transition-transform",
                  backupMeta.autoBackupEnabled && "translate-x-5",
                )}
              />
            </button>
          </header>

          {/* İstatistikler */}
          <div className="grid grid-cols-3 gap-px bg-border">
            <div className="bg-card p-4 text-center">
              <p className="font-mono text-lg font-medium tabular-nums text-foreground">
                {backupMeta.backupCount}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Toplam Yedek
              </p>
            </div>
            <div className="bg-card p-4 text-center">
              <p className="font-mono text-sm font-medium tabular-nums text-foreground">
                {backupMeta.lastBackupAt
                  ? formatBackupDate(backupMeta.lastBackupAt)
                  : "—"}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Son Yedek
              </p>
            </div>
            <div className="bg-card p-4 text-center">
              <p className="font-mono text-sm font-medium tabular-nums text-foreground">
                {backupMeta.lastBackupSize > 0
                  ? formatBytes(backupMeta.lastBackupSize)
                  : "—"}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Son Yedek Boyutu
              </p>
            </div>
          </div>

          {/* Manuel yedekleme butonları */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border/70 p-5 sm:p-6">
            <div>
              <p className="text-sm font-medium text-foreground">
                Manuel Yedekleme
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Hemen bir yedek oluştur veya son yedeği indir
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCreateBackup}
                disabled={creatingBackup}
              >
                <Save className="mr-2 size-3.5" />
                {creatingBackup ? "Oluşturuluyor..." : "Yedek Oluştur"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDownloadBackup}
                disabled={backupMeta.backupCount === 0}
              >
                <Download className="mr-2 size-3.5" />
                Son Yedeği İndir
              </Button>
            </div>
          </div>

          {/* Yedek geçmişi */}
          {backupHistory.length > 0 && (
            <div className="border-t border-border/70">
              <div className="px-5 py-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Son Yedekler (en fazla 10 tanesi tutulur)
                </p>
              </div>
              <div className="max-h-48 overflow-y-auto px-5 pb-4">
                {backupHistory.map((backup) => (
                  <div
                    key={backup.id}
                    className="flex items-center justify-between border-b border-border/50 py-2 text-xs last:border-0"
                  >
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="size-3" />
                      <span>{formatBackupDate(backup.date)}</span>
                    </div>
                    <span className="font-mono tabular-nums text-foreground">
                      {formatBytes(backup.size)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Manuel Yedekleme / İçe Aktarma */}
        <section className="mt-6 rounded-lg border bg-card">
          <header className="border-b border-border/70 px-5 py-4">
            <h2 className="text-sm font-semibold text-foreground">
              Manuel Yedekleme
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Tüm verileri tek bir JSON dosyası olarak dışa aktarın veya
              önceden aldığınız bir yedekten geri yükleyin
            </p>
          </header>
          <div className="grid gap-4 p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Yedek indir
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Hesap, işlem, cari, fatura ve virman kayıtlarını kapsar
                </p>
              </div>
              <Button type="button" variant="outline" onClick={handleExport}>
                <Download className="mr-2 size-4" />
                JSON İndir
              </Button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border/70 pt-4">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Yedekten yükle
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Mevcut verilerin üzerine yazılır — önce yedek almanız önerilir
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-2 size-4" />
                Dosya Seç
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleImportFile(file);
                  event.target.value = "";
                }}
              />
            </div>
          </div>
        </section>

        {/* Sıfırlama */}
        <section className="mt-6 rounded-lg border bg-card">
          <header className="border-b border-border/70 px-5 py-4">
            <h2 className="text-sm font-semibold text-foreground">
              Varsayılan Veriye Dön
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Tüm kayıtlar silinir ve örnek veriler yeniden yüklenir
            </p>
          </header>
          <div className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
            <p className="text-sm text-muted-foreground">
              Bu işlem geri alınamaz.
            </p>
            {confirmingReset ? (
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={handleReset}
                >
                  Evet, sıfırla
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmingReset(false)}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn("text-destructive hover:text-destructive")}
                onClick={() => setConfirmingReset(true)}
              >
                <RotateCcw className="mr-2 size-4" />
                Sıfırla
              </Button>
            )}
          </div>
        </section>

        {/* Not */}
        <section className="mt-6 flex items-start gap-3 rounded-lg border border-border/70 bg-card p-5">
          <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="text-xs leading-5 text-muted-foreground">
            Veriler yalnızca bu tarayıcıda saklanır; başka cihazlara
            taşımak için yedek dosyasını kullanın. Otomatik yedekleme
            açıkken verileriniz her saat IndexedDB'de güvenle saklanır.
            Tarayıcı verilerini temizlemek kalıcı veri kaybına yol açar.
          </p>
        </section>

        <footer className="mt-14 border-t border-border/70 pt-6 text-center text-xs text-muted-foreground">
          Mizan — verileriniz bu tarayıcıda güvenle saklanır ve sayfa
          yenilense de korunur.
        </footer>
      </main>
    </div>
  );
}
