import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMemo, useRef, useState } from "react";
import { CalcCard, Field, PrintHeader, InfoNote } from "./shared";
import { PARAMS_2026 } from "./engine/params";
import { ExportButtons } from "./engine/ExportButtons";
import { cn } from "@/lib/utils";

type SirketTipi = "sahis" | "limited" | "anonim";

interface Profil {
  vergiTuru: string;
  sgkStatu: string;
  parametreler: { ad: string; deger: string }[];
  beyanname: { ad: string; periyot: string; sonTarih: string }[];
  riskler: { ad: string; aciklama: string }[];
}

const PROfiller: Record<SirketTipi, Profil> = {
  sahis: {
    vergiTuru: "Gelir Vergisi (artan oranlı tarife) — 2026 1. dilim %15, son dilim %40",
    sgkStatu: "4/b (Bağ-Kur) — SMMM/SM, esnaf ve serbest meslek erbabı",
    parametreler: [
      { ad: "Gelir Vergisi dilimleri (2026)", deger: "%15 / %20 / %27 / %35" },
      { ad: "Brüt asgari ücret (2026)", deger: `${PARAMS_2026.ASGARI_UCRET_BRUT.toLocaleString("tr-TR")} TL` },
      { ad: "Kıdem tazminatı tavanı (2026/2)", deger: `${PARAMS_2026.KIDEM_TAVAN_2.toLocaleString("tr-TR")} TL` },
      { ad: "Yeniden değerleme oranı", deger: "2026'da Ekim'de açıklanır" },
      { ad: "SMM makbuzu GV tevkifatı", deger: "%20" },
      { ad: "e-Defter berat yükleme", deger: "Gelir mükellefleri ayın 10'u" },
      { ad: "Bağ-Kur primi (2026, 4b sigortalı)", deger: "brüt asgari ücret üzerinden %34,75 (34,5 puan+GSS)" },
    ],
    beyanname: [
      { ad: "Yıllık Gelir Vergisi Beyannamesi", periyot: "Yıllık", sonTarih: "Nisan ayının 1-25'i (2026: 15 Nisan)" },
      { ad: "Geçici Vergi Beyannamesi", periyot: "4 dönem (3 aylık)", sonTarih: "Dönem bitimini izleyen 2. ayın 17'si" },
      { ad: "KDV Beyannamesi", periyot: "Aylık", sonTarih: "İzleyen ayın 28'i" },
      { ad: "Muhtasar ve Prim Hizmet Beyannamesi", periyot: "Aylık/3 aylık", sonTarih: "İzleyen ayın 26'sı" },
      { ad: "Ba-Bs Formları", periyot: "—", sonTarih: "KALDIRILDI (565 sıra no'lu VUK GT, Eylül 2024'ten itibaren)" },
    ],
    riskler: [
      { ad: "KDV iade süreçleri", aciklama: "İade istemlerinde belge/mutabakat eksikleri iadeyi geciktirir; iade hak eden işlemler ayrıştırılmalı." },
      { ad: "Belge düzeni", aciklama: "SMM makbuzu ve fatura düzeni VUK m.234/236 denetimlerinde kritik." },
      { ad: "Bağ-Kur prim gecikmesi", aciklama: "Prim borçları vergi ziyaı ve gecikme faizi ile birlikte takip edilir." },
      { ad: "Kasa bakiyesi", aciklama: "Yüksek nakit bakiyesi (500 bin TL+) adat/temerrüt incelemesine konu olabilir." },
    ],
  },
  limited: {
    vergiTuru: "Kurumlar Vergisi %25 (finans kurumları %30)",
    sgkStatu: "Ortaklar: 4/b (Bağ-Kur); Çalışanlar: 4/a (SSK)",
    parametreler: [
      { ad: "Kurumlar vergisi oranı", deger: "%25" },
      { ad: "Finansman gider kısıtlaması (KVK 11/1-i)", deger: "Asan kısım finansman giderinin %10'u KKEG" },
      { ad: "Binek oto amortisman sınırı (2026)", deger: `${PARAMS_2026.BINEK_AMORTISMAN_SINIR_2026.toLocaleString("tr-TR")} TL (tahmini)` },
      { ad: "KDV indirim sınırı (binek oto)", deger: `${PARAMS_2026.BINEK_KDV_SINIR.toLocaleString("tr-TR")} TL` },
      { ad: "SGK işveren payı", deger: "%20,5 (5 puanlık indirimli %15,5)" },
      { ad: "Brüt asgari ücret (2026)", deger: `${PARAMS_2026.ASGARI_UCRET_BRUT.toLocaleString("tr-TR")} TL` },
      { ad: "e-Belge zorunluluğu", deger: "Ciro eşiği aşan mükelleflerde e-fatura/e-defter zorunlu" },
    ],
    beyanname: [
      { ad: "Kurumlar Vergisi Beyannamesi", periyot: "Yıllık", sonTarih: "Hesap dönemini izleyen 4. ayın 30'u (Nisan)" },
      { ad: "Geçici Vergi Beyannamesi", periyot: "4 dönem (3 aylık)", sonTarih: "İzleyen 2. ayın 17'si + asgari KV" },
      { ad: "KDV Beyannamesi", periyot: "Aylık", sonTarih: "İzleyen ayın 28'i" },
      { ad: "Muhtasar ve Prim Hizmet Beyannamesi", periyot: "Aylık/3 aylık", sonTarih: "İzleyen ayın 26'sı" },
      { ad: "Damga Vergisi Beyannamesi", periyot: "Aylık", sonTarih: "İzleyen ayın 26'sı" },
    ],
    riskler: [
      { ad: "Transfer fiyatlandırması", aciklama: "Ortaklar/ilişkili kişilerle işlemlerde emsallere uygunluk ilkesi; belgelendirme yükümlülüğü." },
      { ad: "Örtülü sermaye", aciklama: "Ortaklardan/kontrol edenlerden alınan kredilerin 3 katını aşan kısmın faiz/gideri KKEG'dir." },
      { ad: "Finansman gider kısıtlaması", aciklama: "Yabancı kaynak / özkaynak aşımı kısıtlamayı tetikler — bilançodan hesaplama yapın." },
      { ad: "Örtülü kazanç dağıtımı", aciklama: "Ortaklardan alacaklar (131) ve piyasa dışı işlemler incelenir." },
      { ad: "e-Belge uyumsuzluk", aciklama: "Beyanname tutarları ile e-defter/e-fatura verileri arasındaki farklar risk sinyalidir." },
    ],
  },
  anonim: {
    vergiTuru: "Kurumlar Vergisi %25 (finans kurumları %30)",
    sgkStatu: "Yönetim kurulu üyeleri: 4/a (SSK); Ortaklar: kâr payı stopajı %15",
    parametreler: [
      { ad: "Kurumlar vergisi oranı", deger: "%25" },
      { ad: "Temettü stopajı", deger: "%15 (gerçek kişi ortaklarda %50 istisna beyanname ile)" },
      { ad: "Bağımsız denetim eşiği (2026)", deger: "Ciro/aktif/çalışan kriterlerinden en az 2'sini aşan A.Ş." },
      { ad: "Kıdem tazminatı tavanı (2026/2)", deger: `${PARAMS_2026.KIDEM_TAVAN_2.toLocaleString("tr-TR")} TL` },
      { ad: "Sermaye kaybı / borca batıklık", deger: "TTK m.376 yükümlülükleri — toplam aktif, borçların yarısının altına düşerse bildirim" },
      { ad: "Genel kurul bildirimi", deger: "Ticaret siciline/ipg bildirimleri kurul sonrası 1 ay" },
    ],
    beyanname: [
      { ad: "Kurumlar Vergisi Beyannamesi", periyot: "Yıllık", sonTarih: "Nisan ayının 30'u" },
      { ad: "Geçici Vergi Beyannamesi", periyot: "4 dönem", sonTarih: "İzleyen 2. ayın 17'si" },
      { ad: "KDV Beyannamesi", periyot: "Aylık", sonTarih: "İzleyen ayın 28'i" },
      { ad: "Muhtasar ve Prim Hizmet Beyannamesi", periyot: "Aylık/3 aylık", sonTarih: "İzleyen ayın 26'sı" },
      { ad: "Temettü Stopaj Beyannamesi (Geç.67 kapsamı dışı ise muhtasar)", periyot: "Ödeme sırasında", sonTarih: "Muhtasar ile birlikte" },
      { ad: "Yıllık Faaliyet Raporu ve Denetim Raporu", periyot: "Yıllık", sonTarih: "Genel kurul öncesi" },
    ],
    riskler: [
      { ad: "Bağımsız denetim", aciklama: "Eşikleri aşan A.Ş.'lerde denetim raporu yoksa beyanname işlemleri askıya alınabilir." },
      { ad: "Transfer fiyatlandırması ve örtülü kazanç", aciklama: "İlişkili şirketlerle işlemlerde emsallere uygunluk belgesi (yıllık rapor zorunlulukları)." },
      { ad: "Temettü planlaması", aciklama: "Kar dağıtımında %15 stopaj; ortak profiline göre toplam vergi yükü değişir." },
      { ad: "Yönetim kurulu SGK statüsü", aciklama: "Ücret alan YK üyeleri 4/a; sadece tazminat alanlar farklı değerlendirilir." },
      { ad: "Sermaye kaybı bildirimleri", aciklama: "TTK m.376 durumlarında yönetim kurulu bildirimi gecikirse sorumluluk doğar." },
    ],
  },
};

const TIP_ADLARI: Record<SirketTipi, string> = {
  sahis: "Şahıs İşletmesi / Serbest Meslek",
  limited: "Limited Şirket",
  anonim: "Anonim Şirket",
};

export function MukellefProfilHesap() {
  const [tip, setTip] = useState<SirketTipi>("limited");
  const areaRef = useRef<HTMLDivElement>(null);
  const profil = useMemo(() => PROfiller[tip], [tip]);

  const excelSections = [
    {
      title: `Mükellef Profili — ${TIP_ADLARI[tip]}`,
      headers: ["Alan", "Bilgi"],
      rows: [
        ["Vergi Türü", profil.vergiTuru],
        ["SGK Statüsü", profil.sgkStatu],
        ...profil.parametreler.map((p) => [p.ad, p.deger] as [string, string]),
      ],
    },
    {
      title: "Beyanname Yükümlülükleri",
      headers: ["Beyanname", "Periyot", "Son Tarih"],
      rows: profil.beyanname.map((b) => [b.ad, b.periyot, b.sonTarih]),
    },
    {
      title: "Risk Alanları",
      headers: ["Risk", "Açıklama"],
      rows: profil.riskler.map((r) => [r.ad, r.aciklama]),
      notes: ["Bu profil bilgilendirme amaçlıdır; mali/hukuki danışmanlık yerine geçmez."],
    },
  ];

  return (
    <div className="print-area" ref={areaRef}>
      <PrintHeader title="Mükellef Profil Analizi" subtitle={TIP_ADLARI[tip]} />
      <CalcCard
        title="Mükellef Profil Analizi"
        subtitle="Şirket tipine göre risk alanları, yükümlülükler ve güncel parametreler"
        actions={
          <ExportButtons
            excelName="mizan-mukellef-profil"
            excelTitle="Mükellef Profil Analizi"
            excelSheet="Mükellef Profili"
            excelSections={excelSections}
            pdfTargetRef={areaRef}
            pdfName="mizan-mukellef-profil"
            disabled={false}
          />
        }
      >
        <div className="grid gap-6">
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Şirket Tipi">
              <Select value={tip} onValueChange={(v) => setTip(v as SirketTipi)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(TIP_ADLARI) as SirketTipi[]).map((t) => (
                    <SelectItem key={t} value={t}>{TIP_ADLARI[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="rounded-lg border bg-muted/30 px-4 py-3 sm:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vergi & SGK Bilgisi</p>
              <p className="mt-1 text-sm"><strong>Vergi:</strong> {profil.vergiTuru}</p>
              <p className="mt-1 text-sm"><strong>SGK:</strong> {profil.sgkStatu}</p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Takip Edilmesi Gereken Parametreler</p>
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <tbody>
                    {profil.parametreler.map((p, i) => (
                      <tr key={i} className="border-t first:border-t-0">
                        <td className="px-3 py-2 text-xs text-muted-foreground">{p.ad}</td>
                        <td className="px-3 py-2 text-right font-medium tabular-nums">{p.deger}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Beyanname Yükümlülükleri</p>
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Beyanname</th>
                      <th className="px-3 py-2 font-medium">Periyot</th>
                      <th className="px-3 py-2 font-medium">Son Tarih</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profil.beyanname.map((b, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-3 py-2">{b.ad}</td>
                        <td className="px-3 py-2 text-xs">{b.periyot}</td>
                        <td className={cn("px-3 py-2 text-xs", b.sonTarih.includes("KALDIRILDI") && "line-through text-muted-foreground")}>{b.sonTarih}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Risk Alanları</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {profil.riskler.map((r, i) => (
                <div key={i} className="rounded-lg border bg-card px-4 py-3 print-avoid-break">
                  <p className="text-sm font-semibold">{r.ad}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{r.aciklama}</p>
                </div>
              ))}
            </div>
          </div>

          <InfoNote>
            Vergi idaresi, beyanname tutarları ile e-defter/e-fatura verileri arasındaki uyumsuzlukları, yüksek
            kasa bakiyelerini ve ortaklardan alacakları öncelikli olarak inceler. Parametreler her yıl
            güncellenir; yanlış/eski bilgiyle yapılan hesaplamalar ciddi vergisel sonuçlar doğurabilir.
          </InfoNote>
        </div>
      </CalcCard>
    </div>
  );
}
