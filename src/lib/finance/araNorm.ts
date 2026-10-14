/**
 * Türkçe duyarlı arama normalizasyonu.
 * "migros" yazınca "MİGROS TİCARET A.Ş." eşleşir; ı/I/İ/i hepsi "i" olur,
 * ş/ğ/ü/ö/ç ASCII karşılıklarına iner.
 */
export function araNorm(metin: string): string {
  return metin
    .toLocaleLowerCase("tr-TR")
    .replace(/\u0307/g, "") // İ'nin küçük harfteki noktasını at (i̇ → i)
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
}

/**
 * Listelerde arama filtresi: sorgudaki TÜM kelimeler değerde geçiyorsa 1 döner.
 * "migros ticaret" → "MİGROS TİCARET A.Ş." ✓ · "migros banka" ✗
 */
export function araFiltre(deger: string, arama: string): number {
  const d = araNorm(deger);
  const kelimeler = araNorm(arama).split(/\s+/).filter(Boolean);
  return kelimeler.every((k) => d.includes(k)) ? 1 : 0;
}
