/**
 * Kullanıcının kendisinin eklediği ünvan + vergi numarası kayıtları.
 *
 * `src/data/masrafListesi.ts` içindeki UNVANLAR listesi Excel'den üretilen
 * sabit bir rehberdir; elle girilen firmalar kaybolmasın diye bu depoya
 * yazılır ve açılışta rehbere eklenir.
 */

const STORAGE_KEY = "mizan-unvan-rehberi-v1";

/** Tek bir rehber kaydı: ünvan (firma adı) + vergi numarası. */
export interface RehberKaydi {
  kod: string;
  unvan: string;
}

/** Yazım normalizasyonu: aynı yazım ⇢ aynı kayıt. */
function normKayit(deger: string): string {
  return deger.trim().toLocaleUpperCase("tr-TR");
}

/** Rehberi yerel depodan yükler; bozuk veride temiz döner. */
export function rehberYukle(): RehberKaydi[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (k): k is RehberKaydi =>
          !!k &&
          typeof (k as RehberKaydi).unvan === "string" &&
          typeof (k as RehberKaydi).kod === "string" &&
          (k as RehberKaydi).unvan.trim().length >= 2,
      )
      .map((k) => ({ kod: k.kod.trim(), unvan: k.unvan.trim() }));
  } catch {
    return [];
  }
}

/** Rehberi yerel depoya yazar; depo erişilemezse sessizce devreder. */
export function rehberKaydet(kayitlar: RehberKaydi[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(kayitlar));
  } catch {
    // Depolama dolu veya erişilemez — sessizce devam et.
  }
}

/** Kaydın rehberde zaten var olduğunu denetler (ünvan veya vergi no eşleşmesi). */
export function rehberIceriyorMu(rehber: RehberKaydi[], kayit: RehberKaydi): boolean {
  const unvan = normKayit(kayit.unvan);
  const kod = kayit.kod.trim();
  return rehber.some(
    (k) => normKayit(k.unvan) === unvan || (kod !== "" && k.kod === kod),
  );
}

/** Yeni kaydı mevcut rehbere ekler; aynı kayıt zaten varsa listeyi değiştirmez. */
export function rehberEkle(rehber: RehberKaydi[], kayit: RehberKaydi): RehberKaydi[] {
  if (!rehberIceriyorMu(rehber, kayit)) return [...rehber, kayit];
  return rehber;
}
