# Mizan — Muhasebe ve Hesaplama Araçları

**Mizan**, muhasebeciler ve küçük işletmeler için geliştirilmiş, tarayıcıda çalışan (isterseniz Electron ile masaüstü uygulamasına paketlenen) bir ön muhasebe uygulamasıdır. Ödeme takibi, belge arşivi, görev listesi ve **30 hesaplama aracını** tek çatı altında toplar.

> Tüm veriler **cihazınızın yerel deposunda** (`localStorage`) tutulur; hiçbir veri sunucuya gönderilmez. Ayarlar sayfasından yedek alıp geri yükleyebilirsiniz.

---

## Özellikler

| Bölüm | Ne yapar? |
|---|---|
| **Panel** (`/dashboard`) | Günlük özet: yaklaşan ödemeler, son işlemler, grafikler |
| **Ödemeler** (`/odemeler`) | Tekrarlayan/planlı ödemeler, fatura ve cari takibi |
| **Ödeme Geçmişi** (`/odeme-gecmisi`) | Yapılan ödemelerin dökümü ve araması |
| **Rapor** (`/rapor`) | Gelir–gider raporları ve dışa aktarım |
| **Görevler** (`/gorevler`) | Muhasebe takvimine yönelik görev listesi |
| **Hesaplayıcılar** (`/hesaplayicilar`) | 30 araç — aşağıda detaylı |
| **Belgeler** (`/belgeler`) | Belge arşivi ve OCR ile belge okuma |
| **Ayarlar** (`/ayarlar`) | Tema, yedek al/geri yükle, uygulama bilgileri |

### Hesaplayıcılar (30 araç)

- **Kur & Döviz:** Kur Çevir, İki Tarih Arası Kur, İBKB Döviz (canlı TCMB kurları)
- **KDV & Belgeler:** KDV, KDV Beyanname, Tevkifat, SMM Makbuzu, Gider Pusulası
- **Vergi Hesapları:** Stopaj, Gelir Vergisi Dilim, Damga Vergisi, Finansman Kısıtlama, Binek Oto Kısıtlama
- **Bordro & Personel:** Maaş, Mesai, Kıdem & İhbar, İşe Giriş / Çıkış, Harcırah
- **Maliyet & Varlıklar:** Maliyet, Tiftik Maliyet, Masraf Listesi, Poliçe Gider, Amortisman, Reeskont & Adat, Kasa/Cari Adat, Enflasyon Düzeltme
- **Analiz & Takip:** Mizan Analiz, XML e-Defter, Mükellef Profil, Vergi Takvimi

Her hesaplayıcıda:

- **Kaydet / Kayıtlar** — hesaplamayı yerel depoya kaydet, listele, geri yükle, sil
- **Excel / PDF / Yazdır** — sonucu üç şekilde dışa aktar
- **⭐ Favori** — yıldızla Favoriler bölümüne ekle, istediğin an çıkar (tarayıcıda saklanır)

### Masraf Listesi içe aktarma

Masraf Listesi hesaplayıcısında **"İçe Aktar"** ile *GÜNCEL MASRAF LİSTESİ .xlsx* dosyanızı seçin;
uygulama dosyadaki sayfaları listeler, seçtiklerinizi uygulamaya aktarır. Masraf türleri, ödeme
türleri, araç plakaları, iller ve 715 satıcıdan oluşan rehber `VERİ BANKASI` sayfasından
uygulamaya gömülüdür ve form alanlarında otomatik tamamlama olarak sunulur.

---

## Teknolojiler

- **Vite + TypeScript + React 19**
- **Tailwind CSS v4** + **Shadcn UI** (Radix primitives)
- **React Router v7** (`react-router` import yolu)
- **lucide-react** (ikonlar), **recharts** (grafikler), **sonner** (bildirimler)
- **xlsx** (Excel okuma/yazma), **jspdf** + `snapdom` (PDF)
- **Electron** (masaüstü paketi), **GitHub Actions** (otomatik Windows derlemesi)

Paket yöneticisi: **bun**

---

## Kurulum

```bash
bun install        # bağımlılıkları kur
bun run dev        # geliştirme sunucusu → http://localhost:5173
```

### Diğer komutlar

| Komut | Ne yapar |
|---|---|
| `bun run build` | `tsc -b` + üretim derlemesi (`dist/`) |
| `bun run lint` | ESLint kontrolü |
| `bun test` | Tüm testler (bun:test) |
| `bun run format` | Prettier ile biçimlendirme |
| `bun run electron:dev` | Masaüstü modunda çalıştır (önce web derlemesi) |
| `bun run electron:build` | Windows portable `.exe` üret (`release/`) |

Ortam değişkeni gerekmez; uygulama çevrimdışı çalışır (canlı kurlar için internet gerekir).

---

## Proje yapısı

```
src/
├── pages/                  # Route sayfaları (main.tsx içinde lazy yüklenir)
├── components/
│   ├── calculators/        # 30 hesaplayıcı + engine/ (kaydet, dışa aktar, hesap çekirdeği)
│   ├── ui/                 # Shadcn bileşenleri
│   └── ...                 # AppHeader, UpdateChecker vb.
├── lib/finance/            # Çekirdek: store, format, rates, dashboard, yedekleme, tema
├── data/                   # Sabit veri listeleri (ör. VERİ BANKASI → masrafListesi.ts)
└── convex/                 # (starter kaynaklı — uygulama tarafında kullanılmıyor)
electron/                   # Masaüstü kabuğu (main.cjs, preload.cjs)
tests/ + src/**/__tests__/  # Testler
.github/workflows/          # release.yml → push'da Windows exe + GitHub Release
```

---

## Sürümleme ve yayın

1. `package.json` → `version` değerini artırın.
2. `main` dalına push edin.
3. GitHub Actions ("Windows EXE Derle ve Yayınla") portable exe'yi derler ve
   yeni sürümü **GitHub Releases** sayfasında yayınlar.
4. Uygulama içindeki güncelleme denetleyicisi yeni sürümü fark edince indirme
   bağlantısı gösterir.

---

## Notlar

- Veriler yalnız o cihazın tarayıcısında saklanır; cihaz değişirse Ayarlar'dan
  aldığınız yedek dosyasını geri yükleyin.
- Vergi oranları, asgari ücret ve tavanlar gibi parametreler
  `src/lib/finance/params.ts` içinde toplanmıştır; yıl güncellemeleri orada yapılır.
- `GÜNCEL MASRAF LİSTESİ 2026.xlsx` reposun kökünde örnek/veri kaynağı dosyasıdır.
