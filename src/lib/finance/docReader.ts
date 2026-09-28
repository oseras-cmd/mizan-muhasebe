/**
 * Akıllı belge okuma — fatura/fiş görsellerini ve PDF'lerini Gemini ile
 * okuyup tarih, tutar, KDV ve cari bilgilerini JSON olarak çıkarır.
 *
 * Önemli: Çıkan sonuç bir TASLAKTIR. Kayıt, muhasebeci onaylamadan
 * hiçbir finansal veriye yazılmaz (bkz. Belgeler sayfası / store).
 */
import type { BelgeOkuma, BelgeTuru, BelgeYon } from "./types";

const KEY_STORAGE = "mizan-google-api-key";
/** Birincil model; bulunamazsa yedeğe düşülür. */
const MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"];

const SUPPORTED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
];

/** Kullanıcının kaydettiği Google AI Studio API anahtarını okur. */
export function getGoogleApiKey(): string {
  try {
    const stored = window.localStorage.getItem(KEY_STORAGE);
    if (stored && stored.trim()) return stored.trim();
  } catch {
    // localStorage kapalı olabilir
  }
  const env = import.meta.env.VITE_GOOGLE_API_KEY as string | undefined;
  return typeof env === "string" && env.trim() ? env.trim() : "";
}

/** API anahtarını yerel depolamaya yazar (yalnızca bu cihazda saklanır). */
export function setGoogleApiKey(key: string) {
  const trimmed = key.trim();
  if (!trimmed) {
    window.localStorage.removeItem(KEY_STORAGE);
    return;
  }
  window.localStorage.setItem(KEY_STORAGE, trimmed);
}

/** Modelin verdiği JSON'u güvenli biçimde ayrıştırır (kod çitleri temizlenir). */
function parseJson(raw: string): unknown {
  let text = raw.trim();
  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fence) text = fence[1];
  return JSON.parse(text);
}

/** Model çıktısındaki değeri sayıya çevirir.
 *  Hem "1.234,56" (TR) hem "1,234.56" / "1234.56" (EN) biçimlerini kabul eder. */
function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return fallback;
  const s = value.trim().replace(/[^\d.,-]/g, "");
  if (!s) return fallback;
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  let normalized: string;
  if (hasComma && hasDot) {
    // İkisi de varsa en son görülen ayraç ondalık ayırıcıdır
    normalized =
      s.lastIndexOf(",") > s.lastIndexOf(".")
        ? s.replace(/\./g, "").replace(",", ".")
        : s.replace(/,/g, "");
  } else if (hasComma) {
    // Tek virgül ve sondan en fazla 2 hane → ondalık
    normalized = /,\d{1,2}$/.test(s) ? s.replace(",", ".") : s.replace(/,/g, "");
  } else if (hasDot) {
    // Tek nokta ve sondan en fazla 2 hane → ondalık, aksi halde binlik
    normalized = /\.\d{1,2}$/.test(s) ? s : s.replace(/\./g, "");
  } else {
    normalized = s;
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : fallback;
}

/** Farklı tarih formatlarını ISO'ya çevirir; bulunamazsa boş döner. */
function toIsoDate(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  const dmy = trimmed.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (dmy) {
    const [, g, a, y] = dmy;
    return `${y}-${g.padStart(2, "0")}-${a.padStart(2, "0")}`;
  }
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return "";
}

const TUR_LERI: BelgeTuru[] = ["fatura", "fis", "makbuz", "dekont", "beyanname", "diger"];
const YON_LER: BelgeYon[] = ["gelir", "gider", "belirsiz"];

const PROMPT = `Sağdaki mali belgeyi (fatura, fiş, makbuz, dekont veya beyanname) oku ve SADECE şu şemada JSON döndür:
{
  "belgeTuru": "fatura" | "fis" | "makbuz" | "dekont" | "beyanname" | "diger",
  "yon": "gelir" | "gider" | "belirsiz",
  "tarih": "YYYY-MM-DD",
  "cariUnvan": "string",
  "cariVkn": "VKN/TCKN veya boş string",
  "belgeNo": "fatura/makbuz numarası veya boş string",
  "matrah": sayı,
  "kdvOrani": yüzde sayı (0, 1, 10 veya 20),
  "kdvTutar": sayı,
  "toplamTutar": sayı,
  "guven": 0 ile 1 arası sayı,
  "not": "belirsiz veya okunamayan noktalar hakkında kısa Türkçe not"
}
Kurallar:
- "yon": işletmeye giren para ise "gelir" (satış faturası/tahsilat), çıkan para ise "gider" (alış faturası/ödeme); anlaşılamıyorsa "belirsiz".
- Tüm sayılar TL olarak düz ondalık sayı olsun (binlik ayracı kullanma).
- Tarih bilinmiyorsa bugünün tarihini değil, boş string kullan.
- Sadece belgede açıkça yazan bilgileri ver; uydurma yok.`;

function splitDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl);
  if (!match) return null;
  return { mimeType: match[1] || "application/octet-stream", data: match[3] };
}

async function callGemini(
  model: string,
  apiKey: string,
  payload: unknown,
): Promise<Response> {
  return fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
}

function httpError(status: number): Error {
  if (status === 400 || status === 401 || status === 403) {
    return new Error("API anahtarı geçersiz veya yetkisiz. Anahtarı kontrol edin.");
  }
  if (status === 404) return new Error("MODEL_NOT_FOUND");
  if (status === 429) {
    return new Error("Google kotası doldu. Biraz sonra tekrar deneyin.");
  }
  if (status >= 500) return new Error("Google servisinde geçici bir sorun var. Tekrar deneyin.");
  return new Error(`Belge okunamadı (HTTP ${status}).`);
}

/** Model çıktısını normalize edip BelgeOkuma'ya çevirir. */
function normalize(raw: unknown): BelgeOkuma {
  const obj = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;

  const belgeTuru: BelgeTuru = TUR_LERI.includes(obj.belgeTuru as BelgeTuru)
    ? (obj.belgeTuru as BelgeTuru)
    : "diger";
  const yon: BelgeYon = YON_LER.includes(obj.yon as BelgeYon)
    ? (obj.yon as BelgeYon)
    : "belirsiz";

  const matrah = toNumber(obj.matrah);
  const kdvOrani = Math.min(100, Math.max(0, toNumber(obj.kdvOrani)));
  let kdvTutar = toNumber(obj.kdvTutar);
  let toplamTutar = toNumber(obj.toplamTutar);

  if (kdvTutar === 0 && matrah > 0 && kdvOrani > 0) {
    kdvTutar = Math.round(matrah * (kdvOrani / 100) * 100) / 100;
  }
  if (toplamTutar === 0) {
    toplamTutar = Math.round((matrah + kdvTutar) * 100) / 100;
  }
  if (matrah === 0 && toplamTutar > 0) {
    // Matrah yoksa toplamı koru; kdv düşülmüş hali approximasyondur.
    const oran = kdvOrani / 100;
    const hesapMatrah = oran > 0 ? toplamTutar / (1 + oran) : toplamTutar;
    return {
      belgeTuru,
      yon,
      tarih: toIsoDate(obj.tarih),
      cariUnvan: typeof obj.cariUnvan === "string" ? obj.cariUnvan.trim() : "",
      cariVkn: typeof obj.cariVkn === "string" ? obj.cariVkn.trim() : "",
      belgeNo: typeof obj.belgeNo === "string" ? obj.belgeNo.trim() : "",
      matrah: Math.round(hesapMatrah * 100) / 100,
      kdvOrani,
      kdvTutar,
      toplamTutar,
      guven: Math.min(1, Math.max(0, toNumber(obj.guven, 0.5))),
      not: typeof obj.not === "string" ? obj.not.trim() : "",
    };
  }

  return {
    belgeTuru,
    yon,
    tarih: toIsoDate(obj.tarih),
    cariUnvan: typeof obj.cariUnvan === "string" ? obj.cariUnvan.trim() : "",
    cariVkn: typeof obj.cariVkn === "string" ? obj.cariVkn.trim() : "",
    belgeNo: typeof obj.belgeNo === "string" ? obj.belgeNo.trim() : "",
    matrah: Math.round(matrah * 100) / 100,
    kdvOrani,
    kdvTutar: Math.round(kdvTutar * 100) / 100,
    toplamTutar: Math.round(toplamTutar * 100) / 100,
    guven: Math.min(1, Math.max(0, toNumber(obj.guven, 0.5))),
    not: typeof obj.not === "string" ? obj.not.trim() : "",
  };
}

/**
 * Belgeyi okur ve çıkarılan alanları döndürür.
 * Hata mesajları kullanıcıya gösterilebilir Türkçe'dedir.
 */
export async function belgeOku(
  dataUrl: string,
  mimeType: string,
): Promise<BelgeOkuma> {
  const apiKey = getGoogleApiKey();
  if (!apiKey) throw new Error("API anahtarı yok.");

  const mime = (mimeType || "").toLowerCase();
  const isSupported = SUPPORTED_MIME.includes(mime) || mime.startsWith("image/");
  if (!isSupported) {
    throw new Error(
      "Bu dosya türü okunamıyor. PDF, JPG, PNG veya WEBP yükleyin.",
    );
  }

  const parts = splitDataUrl(dataUrl);
  if (!parts) throw new Error("Belge verisi okunamadı.");

  const payload = {
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: parts.mimeType || mime, data: parts.data } },
          { text: PROMPT },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
    },
  };

  let lastError: Error | null = null;
  for (const model of MODELS) {
    let res: Response;
    try {
      res = await callGemini(model, apiKey, payload);
    } catch {
      throw new Error("İnternet bağlantınızı kontrol edin.");
    }
    if (res.status === 404) {
      lastError = httpError(res.status);
      continue; // model bulunamadıysa yedek modeli dene
    }
    if (!res.ok) throw httpError(res.status);

    const body = (await res.json().catch(() => null)) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    } | null;
    const text = body?.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("");
    if (!text) throw new Error("Model boş yanıt verdi. Tekrar deneyin.");

    let parsed: unknown;
    try {
      parsed = parseJson(text);
    } catch {
      throw new Error("Model yanıtı çözümlenemedi. Tekrar deneyin.");
    }
    return normalize(parsed);
  }
  throw lastError ?? new Error("Belge okunamadı.");
}
