import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  formatFullDate,
  formatInputValue,
  formatNumberInput,
  formatTRY,
  parseTurkishNumber,
  todayIso,
} from "@/lib/finance/format";
import { belgeOku, getGoogleApiKey, setGoogleApiKey } from "@/lib/finance/docReader";
import {
  MAX_DOCUMENT_SIZE,
  addContact,
  addDocument,
  addInvoice,
  addTransaction,
  deleteDocument,
  getDocumentDataUrl,
  setDocumentOkuma,
  setDocumentOkumaDurum,
  updateDocument,
  useFinanceData,
} from "@/lib/finance/store";
import {
  BELGE_TURU_ETIKET,
  BELGE_TURLERI,
  DOCUMENT_CATEGORIES,
  KDV_RATES,
  TRANSACTION_CATEGORIES,
  type BelgeOkuma,
  type BelgeTuru,
  type DocumentCategory,
  type StoredDocument,
  type TransactionCategory,
} from "@/lib/finance/types";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Download,
  ExternalLink,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  KeyRound,
  Pencil,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function isImage(doc: StoredDocument): boolean {
  return doc.mimeType.startsWith("image/");
}

function isPdf(doc: StoredDocument): boolean {
  return doc.mimeType === "application/pdf";
}

interface FormState {
  name: string;
  category: DocumentCategory;
  contactId: string;
  note: string;
}

const emptyForm: FormState = {
  name: "",
  category: "Diğer",
  contactId: "",
  note: "",
};

/** Akıllı okuma taslağının düzenlenebilir formu (tutarlar metin olarak tutulur). */
interface OkumaForm {
  tarih: string;
  cariUnvan: string;
  cariVkn: string;
  belgeNo: string;
  belgeTuru: BelgeTuru;
  /** "" = seçilmemiş — onay için gelir/gider seçilmek zorunda */
  yon: "" | "gelir" | "gider";
  matrah: string;
  kdvOrani: string;
  kdvTutar: string;
  toplamTutar: string;
  hesapId: string;
  /** Onayda kullanılacak gelir/gider kategorisi (AI önerisiyle dolu gelebilir) */
  kategori: TransactionCategory;
  /** Onayda işleme atanacak proje/etiket */
  proje: string;
}

const bosOkumaForm: OkumaForm = {
  tarih: "",
  cariUnvan: "",
  cariVkn: "",
  belgeNo: "",
  belgeTuru: "diger",
  yon: "",
  matrah: "",
  kdvOrani: "0",
  kdvTutar: "",
  toplamTutar: "",
  hesapId: "",
  kategori: "Diğer",
  proje: "",
};

/** Dosyayı data URL'e çevirir; büyük dosyalarda arayüzü bloklamaz. */
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Dosya okunamadı"));
    reader.readAsDataURL(file);
  });
}

/** data:application/pdf;base64,... gibi bir URL'i Blob'a çevirir. */
function dataUrlToBlob(dataUrl: string): Blob | null {
  try {
    const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl);
    if (!match) return null;
    const mime = match[1] || "application/octet-stream";
    if (match[2]) {
      const binary = atob(match[3]);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return new Blob([bytes], { type: mime });
    }
    return new Blob([decodeURIComponent(match[3])], { type: mime });
  } catch {
    return null;
  }
}

export default function Belgeler() {
  const data = useFinanceData();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileData, setSelectedFileData] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("hepsi");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Akıllı belge okuma
  const [okuyorId, setOkuyorId] = useState<string | null>(null);
  const [okumaDoc, setOkumaDoc] = useState<StoredDocument | null>(null);
  const [okumaMod, setOkumaMod] = useState<"key" | "taslak">("key");
  const [anahtarInput, setAnahtarInput] = useState("");
  const [bekleyenId, setBekleyenId] = useState<string | null>(null);
  const [okuSonra, setOkuSonra] = useState(true);
  const [dupeOnay, setDupeOnay] = useState(false);
  const [oForm, setOForm] = useState<OkumaForm>(bosOkumaForm);
  /** Satır kalemi seçim durumu — null = tümü seçili */
  const [kalemSecim, setKalemSecim] = useState<boolean[] | null>(null);

  // Önizleme modalı
  const [previewDoc, setPreviewDoc] = useState<StoredDocument | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const contactName = useCallback(
    (id?: string) => data.contacts.find((c) => c.id === id)?.name,
    [data.contacts],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("tr");
    return data.documents.filter((doc) => {
      if (categoryFilter !== "hepsi" && doc.category !== categoryFilter)
        return false;
      if (!query) return true;
      const contact = contactName(doc.contactId)?.toLocaleLowerCase("tr") ?? "";
      return (
        doc.name.toLocaleLowerCase("tr").includes(query) ||
        doc.fileName.toLocaleLowerCase("tr").includes(query) ||
        (doc.note?.toLocaleLowerCase("tr").includes(query) ?? false) ||
        contact.includes(query)
      );
    });
  }, [data.documents, data.contacts, search, categoryFilter, contactName]);

  const totalSize = data.documents.reduce((sum, d) => sum + d.size, 0);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(null);
    setSelectedFileData(null);
    if (!file) return;
    if (file.size > MAX_DOCUMENT_SIZE) {
      toast.error(
        `Dosya çok büyük (${formatBytes(file.size)}). En fazla ${formatBytes(MAX_DOCUMENT_SIZE)} yüklenebilir.`,
      );
      event.target.value = "";
      return;
    }
    setSelectedFile(file);
    if (!form.name.trim()) {
      setForm((prev) => ({
        ...prev,
        name: file.name.replace(/\.[^.]+$/, ""),
      }));
    }
    // Dosyayı hemen arka planda oku — kullanıcı kaydet dediğinde bekleme olmasın
    readFileAsDataUrl(file)
      .then((dataUrl) => {
        setSelectedFileData(dataUrl);
      })
      .catch(() => {
        toast.error("Dosya okunamadı. Lütfen tekrar seçin.");
        setSelectedFile(null);
        setSelectedFileData(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      });
  };

  const resetUploadForm = () => {
    setForm(emptyForm);
    setSelectedFile(null);
    setSelectedFileData(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Lütfen bir dosya seçin.");
      return;
    }
    setUploading(true);
    try {
      const dataUrl = selectedFileData ?? (await readFileAsDataUrl(selectedFile));
      const yeni = await addDocument({
        name: form.name || selectedFile.name,
        category: form.category,
        contactId: form.contactId || undefined,
        note: form.note || undefined,
        fileName: selectedFile.name,
        mimeType: selectedFile.type || "application/octet-stream",
        size: selectedFile.size,
        dataUrl,
      });
      toast.success("Belge kaydedildi.");
      resetUploadForm();
      // Akıllı okuma açıksa belgeyi hemen okut (anahtar yoksa anahtar istemi açılır)
      if (okuSonra) void belgeyiOku(yeni);
    } catch {
      // IndexedDB yazımı başarısız (çok nadir) — genel hata mesajı
      toast.error("Belge kaydedilemedi. Lütfen tekrar deneyin.");
    } finally {
      setUploading(false);
    }
  };

  /* ---------------------- Akıllı belge okuma akışı ---------------------- */

  const okumaModalDoc = okumaDoc
    ? (data.documents.find((d) => d.id === okumaDoc.id) ?? okumaDoc)
    : null;

  const selectSinif =
    "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/40";

  /** Sayıyı TR biçiminde forma yazar (1234,56 → 1.234,56). */
  const formatSayi = (v: number) => formatNumberInput(v);

  const okumaFormuDoldur = (okuma: BelgeOkuma, doc: StoredDocument): OkumaForm => {
    // Model %1/%10/%20 dışındaki oran söyleyebilir — en yakın resmî orana yuvarla
    const oranlar = [0, 1, 10, 20];
    const enYakinOran = oranlar.reduce((prev, curr) =>
      Math.abs(curr - okuma.kdvOrani) < Math.abs(prev - okuma.kdvOrani) ? curr : prev,
    );
    return {
      tarih: okuma.tarih,
      cariUnvan:
        okuma.cariUnvan ||
        data.contacts.find((c) => c.id === doc.contactId)?.name ||
        "",
      cariVkn: okuma.cariVkn,
      belgeNo: okuma.belgeNo,
      belgeTuru: okuma.belgeTuru,
      yon: okuma.yon === "belirsiz" ? "" : okuma.yon,
      matrah: okuma.matrah
        ? formatNumberInput(okuma.matrah)
        : "",
      kdvOrani: String(enYakinOran),
      kdvTutar: okuma.kdvTutar
        ? formatNumberInput(okuma.kdvTutar)
        : "",
      toplamTutar: okuma.toplamTutar
        ? formatNumberInput(okuma.toplamTutar)
        : "",
      hesapId: data.accounts[0]?.id ?? "",
      // AI kategorisi varsa onu kullan; yoksa yön+türden heuristik öner
      kategori:
        okuma.kategori ??
        (okuma.yon === "belirsiz"
          ? "Diğer"
          : kategoriBul(okuma.yon, okuma.belgeTuru)),
      proje: "",
    };
  };

  const belgeyiOku = async (doc: StoredDocument) => {
    if (!getGoogleApiKey()) {
      setBekleyenId(doc.id);
      setAnahtarInput("");
      setOkumaMod("key");
      setOkumaDoc(doc);
      return;
    }
    setOkuyorId(doc.id);
    try {
      const dataUrl = getDocumentDataUrl(doc.id);
      if (!dataUrl) throw new Error("Belge verisi bulunamadı.");
      const okuma = await belgeOku(dataUrl, doc.mimeType);
      setDocumentOkuma(doc.id, okuma);
      setOForm(okumaFormuDoldur(okuma, doc));
      setDupeOnay(false);
      setKalemSecim(null);
      setOkumaMod("taslak");
      setOkumaDoc(doc);
      toast.success("Belge okundu. Bilgileri kontrol edip onaylayın.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Belge okunamadı.");
    } finally {
      setOkuyorId(null);
    }
  };

  const okumaAc = (doc: StoredDocument) => {
    if (doc.okuma) {
      setOForm(okumaFormuDoldur(doc.okuma, doc));
      setDupeOnay(false);
      setKalemSecim(null);
      setOkumaMod("taslak");
      setOkumaDoc(doc);
      return;
    }
    void belgeyiOku(doc);
  };

  const anahtariKaydet = () => {
    if (!anahtarInput.trim()) {
      toast.error("Lütfen bir API anahtarı girin.");
      return;
    }
    setGoogleApiKey(anahtarInput.trim());
    setAnahtarInput("");
    toast.success("API anahtarı kaydedildi.");
    const bekleyen = bekleyenId
      ? data.documents.find((d) => d.id === bekleyenId)
      : undefined;
    setBekleyenId(null);
    if (bekleyen) void belgeyiOku(bekleyen);
    else setOkumaDoc(null);
  };

  const oAlanSet = (patch: Partial<OkumaForm>) => {
    setOForm((prev) => {
      const next = { ...prev, ...patch };
      const matrah = parseTurkishNumber(next.matrah) || 0;
      const oran = parseTurkishNumber(next.kdvOrani) || 0;
      if (patch.matrah !== undefined || patch.kdvOrani !== undefined) {
        const kdv = Math.round(matrah * (oran / 100) * 100) / 100;
        next.kdvTutar = kdv ? formatSayi(kdv) : "";
        next.toplamTutar = formatSayi(Math.round((matrah + kdv) * 100) / 100);
      } else if (patch.kdvTutar !== undefined) {
        const kdv = parseTurkishNumber(next.kdvTutar) || 0;
        next.toplamTutar = formatSayi(Math.round((matrah + kdv) * 100) / 100);
      }
      return next;
    });
    setDupeOnay(false);
  };

  const oMatrah = parseTurkishNumber(oForm.matrah) || 0;
  const oToplam = parseTurkishNumber(oForm.toplamTutar) || 0;
  const oOran = parseTurkishNumber(oForm.kdvOrani) || 0;
  const durum = okumaModalDoc?.okumaDurum ?? "taslak";
  const guven = okumaModalDoc?.okuma?.guven ?? null;
  const oKalemler = okumaModalDoc?.okuma?.kalemler ?? [];
  const oKalemSecim = kalemSecim ?? oKalemler.map(() => true);
  const oSeciliKalemSayisi = oKalemler.filter((_, i) => oKalemSecim[i]).length;
  const oKalemToplam = oKalemler.reduce((a, k) => a + k.toplam, 0);
  const oFaturaUygun =
    oForm.belgeTuru === "fatura" &&
    oMatrah > 0 &&
    KDV_RATES.some((r) => Math.abs(r - oOran) < 0.01);

  // Aynı tarih+tutarla mevcut kayıtlar (mükerrer onay koruması)
  const benzerSayisi =
    okumaModalDoc && oForm.yon && oForm.tarih && oToplam > 0
      ? data.transactions.filter(
          (t) =>
            t.type === oForm.yon &&
            t.date === oForm.tarih &&
            Math.abs(t.amount - oToplam) < 0.01,
        ).length +
        data.invoices.filter(
          (inv) =>
            inv.date === oForm.tarih && Math.abs(inv.total - oToplam) < 0.01,
        ).length
      : 0;

  const onayBasla = (): boolean => {
    if (benzerSayisi > 0 && !dupeOnay) {
      setDupeOnay(true);
      toast.warning(
        "Benzer kayıt bulundu — mükerrer olabilir. Eminseniz butona tekrar tıklayın.",
      );
      return false;
    }
    return true;
  };

  const kategoriBul = (
    yon: "gelir" | "gider",
    tur: BelgeTuru,
  ): TransactionCategory => {
    if (yon === "gelir") return tur === "fatura" ? "Satış" : "Tahsilat";
    if (tur === "fatura") return "Fatura";
    if (tur === "beyanname") return "Vergi";
    return "Diğer";
  };

  const onaylaHareket = () => {
    const doc = okumaModalDoc;
    if (!doc) return;
    if (!oForm.yon) {
      toast.error("Belge yönünü seçin (gelir / gider).");
      return;
    }
    if (!oForm.hesapId) {
      toast.error("Kasa/banka hesabı seçin.");
      return;
    }
    if (oToplam <= 0) {
      toast.error("Toplam tutar sıfırdan büyük olmalı.");
      return;
    }
    if (!onayBasla()) return;
    const tarih = oForm.tarih || todayIso();
    const aciklama = [
      doc.name,
      oForm.belgeNo ? `No: ${oForm.belgeNo}` : "",
      oForm.cariUnvan ? `— ${oForm.cariUnvan}` : "",
    ]
      .filter(Boolean)
      .join(" ");
    addTransaction({
      type: oForm.yon,
      description: aciklama,
      category: oForm.kategori,
      accountId: oForm.hesapId,
      amount: oToplam,
      date: tarih,
      documentId: doc.id,
      proje: oForm.proje.trim() || undefined,
    });
    setDocumentOkumaDurum(doc.id, "onayli");
    setOkumaDoc(null);
    toast.success("Onaylandı — finansal kayıt oluşturuldu.");
  };

  /** Seçilen satır kalemlerini tek tek ayrı gelir/gider kayıtlarına böler. */
  const kalemleriBol = () => {
    const doc = okumaModalDoc;
    if (!doc) return;
    if (!oForm.yon) {
      toast.error("Belge yönünü seçin (gelir / gider).");
      return;
    }
    if (!oForm.hesapId) {
      toast.error("Kasa/banka hesabı seçin.");
      return;
    }
    const kalemler = doc.okuma?.kalemler ?? [];
    const secim = kalemSecim ?? kalemler.map(() => true);
    const secili = kalemler.filter((_, i) => secim[i]);
    if (secili.length === 0) {
      toast.error("En az bir kalem seçin.");
      return;
    }
    if (!onayBasla()) return;
    const tarih = oForm.tarih || todayIso();
    const cari = oForm.cariUnvan.trim();
    const proje = oForm.proje.trim();
    for (const k of secili) {
      addTransaction({
        type: oForm.yon,
        description: [k.ad, cari ? `— ${cari}` : ""].filter(Boolean).join(" "),
        category: oForm.kategori,
        accountId: oForm.hesapId,
        amount: k.toplam,
        date: tarih,
        documentId: doc.id,
        proje: proje || undefined,
      });
    }
    setDocumentOkumaDurum(doc.id, "onayli");
    setOkumaDoc(null);
    toast.success(`${secili.length} kalem ayrı işlemlere bölündü — toplam ${formatTRY(secili.reduce((a, k) => a + k.toplam, 0))}.`);
  };

  const onaylaFatura = () => {
    const doc = okumaModalDoc;
    if (!doc) return;
    const cari = oForm.cariUnvan.trim();
    if (!cari) {
      toast.error("Fatura kaydı için cari ünvan girin.");
      return;
    }
    if (!oForm.yon) {
      toast.error("Belge yönünü seçin (gelir / gider).");
      return;
    }
    const kdvRate = KDV_RATES.find((r) => Math.abs(r - oOran) < 0.01);
    if (!kdvRate) {
      toast.error("Fatura kaydı için KDV oranı %1, %10 veya %20 olmalı.");
      return;
    }
    if (!onayBasla()) return;
    const tarih = oForm.tarih || todayIso();
    const mevcut = data.contacts.find(
      (c) =>
        c.name.trim().toLocaleLowerCase("tr") === cari.toLocaleLowerCase("tr"),
    );
    const contact =
      mevcut ??
      addContact({
        name: cari,
        type: oForm.yon === "gider" ? "tedarikci" : "musteri",
        taxNo: oForm.cariVkn || undefined,
      });
    addInvoice({
      contactId: contact.id,
      date: tarih,
      items: [
        {
          id: `it-${Date.now().toString(36)}`,
          description: doc.name,
          quantity: 1,
          unitPrice: oMatrah,
          kdvRate,
        },
      ],
    });
    setDocumentOkumaDurum(doc.id, "onayli");
    setOkumaDoc(null);
    toast.success("Onaylandı — fatura kaydı oluşturuldu.");
  };

  const okumayiReddet = () => {
    const doc = okumaModalDoc;
    if (!doc) return;
    setDocumentOkumaDurum(doc.id, "reddedildi");
    setOkumaDoc(null);
    toast.info("Okuma reddedildi. Belge arşivde kalır, kayıt oluşturulmadı.");
  };

  const startEdit = (doc: StoredDocument) => {
    setEditingId(doc.id);
    setConfirmingId(null);
    setEditForm({
      name: doc.name,
      category: doc.category,
      contactId: doc.contactId ?? "",
      note: doc.note ?? "",
    });
  };

  const saveEdit = (docId: string) => {
    updateDocument(docId, {
      name: editForm.name,
      category: editForm.category,
      contactId: editForm.contactId,
      note: editForm.note,
    });
    setEditingId(null);
    toast.success("Belge güncellendi.");
  };

  const downloadDoc = async (doc: StoredDocument) => {
    const dataUrl = getDocumentDataUrl(doc.id);
    if (!dataUrl) {
      toast.error("Belge verisi bulunamadı.");
      return;
    }
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = doc.fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const viewDoc = (doc: StoredDocument) => {
    setPreviewDoc(doc);
    setPreviewLoading(true);
    // Lazy yükle: büyük belgelerde listeyi bloklamadan veriyi çek
    window.setTimeout(async () => {
      const dataUrl = getDocumentDataUrl(doc.id);
      setPreviewUrl(dataUrl);
      setPreviewLoading(false);
    }, 50);
  };

  const closePreview = () => {
    setPreviewDoc(null);
  };

  // data: URL'i Chromium iframe'lerinde PDF olarak gösterilmediği için
  // blob: URL'ine çevir (PDF önizlemesi için gerekli)
  useEffect(() => {
    if (!previewUrl) return;
    const blob = dataUrlToBlob(previewUrl);
    if (!blob) return;
    const objectUrl = URL.createObjectURL(blob);
    setPreviewBlobUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [previewUrl]);

  const displayPreviewUrl = previewBlobUrl ?? previewUrl;

  // ESC ile önizlemeyi kapat
  useEffect(() => {
    if (!previewDoc) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePreview();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewDoc]);

  // ESC ile akıllı okuma modalını kapat
  useEffect(() => {
    if (!okumaDoc) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOkumaDoc(null);
        setBekleyenId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [okumaDoc]);

  return (
    <div className="min-h-screen bg-background pl-64 text-foreground">
      <AppHeader />
      <main className="mx-auto w-full max-w-5xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Belgeler</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Fatura, sözleşme ve makbuz gibi belgeleri yükleyin ve
              carilerinize bağlayın.
            </p>
          </div>
          <p className="text-xs text-muted-foreground tabular-nums">
            {data.documents.length} belge · {formatBytes(totalSize)}
          </p>
        </div>

        {/* Yükleme formu */}
        <section className="mb-8 rounded-lg border border-border/70 bg-card p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Upload className="size-4 text-muted-foreground" />
            Yeni Belge Yükle
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="doc-file">Dosya</Label>
              <input
                id="doc-file"
                ref={fileInputRef}
                type="file"
                onChange={handleFileChange}
                accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx"
                className="block w-full cursor-pointer rounded-md border border-border bg-background px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-muted file:px-3 file:py-1 file:text-sm file:text-foreground hover:file:bg-muted/70"
              />
              {selectedFile && (
                <p className="text-xs text-muted-foreground">
                  {selectedFile.name} · {formatBytes(selectedFile.size)}{" "}
                  <button
                    type="button"
                    className="underline underline-offset-2 hover:text-foreground"
                    onClick={resetUploadForm}
                  >
                    kaldır
                  </button>
                </p>
              )}
              <p className="text-[11px] text-muted-foreground/70">
                PDF, resim veya Office dosyası · en fazla{" "}
                {formatBytes(MAX_DOCUMENT_SIZE)}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-name">Belge Adı</Label>
              <Input
                id="doc-name"
                value={form.name}
                placeholder="Örn. Ağustos KDV Beyannamesi"
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-category">Kategori</Label>
              <select
                id="doc-category"
                value={form.category}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    category: e.target.value as DocumentCategory,
                  }))
                }
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                {DOCUMENT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-contact">Cari (opsiyonel)</Label>
              <select
                id="doc-contact"
                value={form.contactId}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, contactId: e.target.value }))
                }
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                <option value="">Bağlı cari yok</option>
                {data.contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.type === "musteri" ? "müşteri" : "tedarikçi"})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="doc-note">Not (opsiyonel)</Label>
              <Input
                id="doc-note"
                value={form.note}
                placeholder="Belgeyle ilgili kısa not"
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, note: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground select-none">
              <input
                type="checkbox"
                checked={okuSonra}
                onChange={(e) => setOkuSonra(e.target.checked)}
                className="size-3.5 accent-emerald-600"
              />
              Kaydedince akıllı oku — tarih, tutar, KDV ve cari otomatik çıkarılsın
            </label>
            <Button
              type="button"
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
            >
              {uploading ? (
                <>
                  <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Kaydediliyor…
                </>
              ) : (
                <>
                  <Upload className="size-4" />
                  Belgeyi Kaydet
                </>
              )}
            </Button>
          </div>
        </section>

        {/* Filtreleme */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative min-w-48 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Belge ara..."
              className="pl-9"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <option value="hepsi">Tüm kategoriler</option>
            {DOCUMENT_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Belge listesi */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center rounded-lg border border-dashed border-border/70 py-16 text-center">
            <FolderOpen className="size-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm font-medium">
              {data.documents.length === 0
                ? "Henüz belge yüklenmemiş"
                : "Aramanıza uygun belge bulunamadı"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Yukarıdaki formu kullanarak ilk belgenizi yükleyin.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/60 overflow-hidden rounded-lg border border-border/70 bg-card">
            {filtered.map((doc) => {
              const editing = editingId === doc.id;
              return (
                <li key={doc.id} className="px-4 py-3">
                  {editing ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>Belge Adı</Label>
                        <Input
                          value={editForm.name}
                          onChange={(e) =>
                            setEditForm((p) => ({ ...p, name: e.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Kategori</Label>
                        <select
                          value={editForm.category}
                          onChange={(e) =>
                            setEditForm((p) => ({
                              ...p,
                              category: e.target.value as DocumentCategory,
                            }))
                          }
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                        >
                          {DOCUMENT_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Cari</Label>
                        <select
                          value={editForm.contactId}
                          onChange={(e) =>
                            setEditForm((p) => ({
                              ...p,
                              contactId: e.target.value,
                            }))
                          }
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                        >
                          <option value="">Bağlı cari yok</option>
                          {data.contacts.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Not</Label>
                        <Input
                          value={editForm.note}
                          onChange={(e) =>
                            setEditForm((p) => ({ ...p, note: e.target.value }))
                          }
                        />
                      </div>
                      <div className="flex justify-end gap-2 sm:col-span-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingId(null)}
                        >
                          <X className="size-3.5" />
                          İptal
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => saveEdit(doc.id)}
                        >
                          Kaydet
                        </Button>
                      </div>
                    </div>
                  ) : confirmingId === doc.id ? (
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-destructive">
                        Bu belge kalıcı olarak silinsin mi?
                      </p>
                      <div className="flex shrink-0 gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmingId(null)}
                        >
                          Vazgeç
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            deleteDocument(doc.id);
                            setConfirmingId(null);
                            toast.success("Belge silindi.");
                          }}
                        >
                          Sil
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md border border-border/60",
                          isImage(doc)
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {isImage(doc) ? (
                          <ImageIcon className="size-4" />
                        ) : (
                          <FileText className="size-4" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {doc.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {doc.category} · {formatBytes(doc.size)} ·{" "}
                          {formatFullDate(new Date(doc.uploadedAt))}
                          {contactName(doc.contactId) &&
                            ` · ${contactName(doc.contactId)}`}
                        </p>
                        {doc.note && (
                          <p className="mt-0.5 truncate text-xs italic text-muted-foreground/80">
                            {doc.note}
                          </p>
                        )}
                        {doc.okumaDurum && (
                          <button
                            type="button"
                            className={cn(
                              "mt-1.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold",
                              doc.okumaDurum === "taslak" &&
                                "bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-300",
                              doc.okumaDurum === "onayli" &&
                                "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
                              doc.okumaDurum === "reddedildi" &&
                                "bg-muted text-muted-foreground hover:bg-muted/70",
                            )}
                            onClick={() => okumaAc(doc)}
                          >
                            <Sparkles className="size-3" />
                            {doc.okumaDurum === "taslak"
                              ? "Okuma — onay bekliyor"
                              : doc.okumaDurum === "onayli"
                                ? "Okuma — onaylı"
                                : "Okuma — reddedildi"}
                          </button>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-emerald-600"
                          title={doc.okuma ? "Okuma taslağını aç" : "Akıllı oku"}
                          disabled={okuyorId === doc.id}
                          onClick={() => okumaAc(doc)}
                        >
                          {okuyorId === doc.id ? (
                            <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          ) : (
                            <Sparkles className="size-3.5" />
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-foreground"
                          title="Görüntüle"
                          onClick={() => viewDoc(doc)}
                        >
                          <ExternalLink className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-foreground"
                          title="İndir"
                          onClick={() => void downloadDoc(doc)}
                        >
                          <Download className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-foreground"
                          title="Düzenle"
                          onClick={() => startEdit(doc)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-destructive"
                          title="Sil"
                          onClick={() => setConfirmingId(doc.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <p className="mt-4 text-xs text-muted-foreground/70">
          Belgeler tarayıcı deposunda (localStorage) saklanır; JSON
          yedeğinize otomatik dahil edilirler.
        </p>
      </main>

      {/* Önizleme Modalı */}
      {previewDoc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={closePreview}
        >
          <div
            className="relative max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal başlık */}
            <div className="flex items-center justify-between border-b border-border/70 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{previewDoc.name}</p>
                <p className="text-xs text-muted-foreground">
                  {previewDoc.fileName} · {formatBytes(previewDoc.size)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    const url = getDocumentDataUrl(previewDoc.id);
                    if (url) {
                      const link = document.createElement("a");
                      link.href = url;
                      link.download = previewDoc.fileName;
                      document.body.appendChild(link);
                      link.click();
                      link.remove();
                    }
                  }}
                >
                  <Download className="mr-1.5 size-3.5" />
                  İndir
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={closePreview}
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>
            {/* İçerik */}
            <div className="flex min-h-[400px] items-center justify-center overflow-auto bg-muted/30 p-2">
              {previewLoading ? (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <div className="size-6 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  <span className="text-xs">Yükleniyor...</span>
                </div>
              ) : displayPreviewUrl ? (
                isPdf(previewDoc) ? (
                  <iframe
                    src={displayPreviewUrl}
                    className="h-[80vh] w-full border-0"
                    title={previewDoc.name}
                  />
                ) : isImage(previewDoc) ? (
                  <img
                    src={displayPreviewUrl}
                    alt={previewDoc.name}
                    className="max-h-[80vh] max-w-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-3 p-8 text-center">
                    <FileText className="size-12 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">
                      Bu dosya türü tarayıcıda önizlenemiyor.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        const link = document.createElement("a");
                        link.href = displayPreviewUrl;
                        link.download = previewDoc.fileName;
                        document.body.appendChild(link);
                        link.click();
                        link.remove();
                      }}
                    >
                      <Download className="mr-1.5 size-3.5" />
                      Dosyayı İndir
                    </Button>
                  </div>
                )
              ) : (
                <div className="flex flex-col items-center gap-2 text-destructive">
                  <p className="text-sm">Belge verisi bulunamadı.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Akıllı belge okuma — anahtar girişi / taslak onayı */}
      {okumaModalDoc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => {
            setOkumaDoc(null);
            setBekleyenId(null);
          }}
        >
          <div
            className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border/60 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Sparkles className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold tracking-tight">
                    Akıllı Belge Okuma
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {okumaModalDoc.name} · {okumaModalDoc.fileName}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => {
                  setOkumaDoc(null);
                  setBekleyenId(null);
                }}
              >
                <X className="size-4" />
              </Button>
            </div>

            {okumaMod === "key" ? (
              /* ---------- API anahtarı girişi ---------- */
              <div className="grid gap-4">
                <div className="flex items-start gap-2.5 rounded-lg border border-border/70 bg-muted/40 px-4 py-3 text-xs leading-5 text-muted-foreground">
                  <KeyRound className="mt-0.5 size-4 shrink-0" />
                  <p>
                    Tarih, tutar, vergi (KDV) ve cari bilgilerini otomatik çıkarmak için
                    bir Google AI Studio API anahtarı gerekli. Anahtar yalnızca bu cihazın
                    yerel deposunda saklanır; okuma sırasında yalnızca belgenin kendisi
                    (görsel/PDF) modele iletilir.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ai-key">Google AI Studio API Anahtarı</Label>
                  <Input
                    id="ai-key"
                    type="password"
                    autoComplete="off"
                    placeholder="AIza…"
                    value={anahtarInput}
                    onChange={(e) => setAnahtarInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") anahtariKaydet();
                    }}
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-emerald-600 underline underline-offset-2 hover:text-emerald-700"
                  >
                    Ücretsiz anahtar oluştur → aistudio.google.com/apikey
                  </a>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setOkumaDoc(null);
                        setBekleyenId(null);
                      }}
                    >
                      Daha sonra
                    </Button>
                    <Button size="sm" onClick={anahtariKaydet}>
                      <KeyRound className="mr-1.5 size-3.5" />
                      Anahtarı Kaydet ve Oku
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              /* ---------- Taslak inceleme & onay ---------- */
              <div className="grid gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-muted px-2 py-0.5 text-[11px] font-semibold">
                    {BELGE_TURU_ETIKET[oForm.belgeTuru]}
                  </span>
                  {guven !== null && (
                    <span
                      className={cn(
                        "rounded px-2 py-0.5 text-[11px] font-semibold",
                        guven >= 0.8
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                          : guven >= 0.5
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                            : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
                      )}
                      title="Yapay zekânın çıkarımlara güveni"
                    >
                      %{Math.round(guven * 100)} güven
                    </span>
                  )}
                  <span
                    className={cn(
                      "rounded px-2 py-0.5 text-[11px] font-semibold",
                      durum === "taslak" &&
                        "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
                      durum === "onayli" &&
                        "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
                      durum === "reddedildi" && "bg-muted text-muted-foreground",
                    )}
                  >
                    {durum === "taslak"
                      ? "Onay bekliyor"
                      : durum === "onayli"
                        ? "Onaylandı"
                        : "Reddedildi"}
                  </span>
                  {okumaModalDoc.okumaAt && (
                    <span className="text-[11px] text-muted-foreground">
                      {formatFullDate(new Date(okumaModalDoc.okumaAt))} okundu
                    </span>
                  )}
                </div>

                {okumaModalDoc.okuma?.not && (
                  <p className="rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    Model notu: {okumaModalDoc.okuma.not}
                  </p>
                )}

                {durum === "onayli" && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">
                    Bu belge onaylandı ve finansal kayıt oluşturuldu. Düzeltme gerekirse
                    ilgili kaydı Gelir-Gider veya Fatura sayfalarından düzenleyin.
                  </div>
                )}
                {durum === "reddedildi" && (
                  <div className="rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    Bu okuma reddedildi; kayıt oluşturulmadı. Bilgileri düzeltip yeniden
                    onaylayabilirsiniz.
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Belge Türü</Label>
                    <select
                      value={oForm.belgeTuru}
                      onChange={(e) =>
                        oAlanSet({ belgeTuru: e.target.value as BelgeTuru })
                      }
                      className={selectSinif}
                    >
                      {BELGE_TURLERI.map((t) => (
                        <option key={t} value={t}>
                          {BELGE_TURU_ETIKET[t]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Yön *</Label>
                    <select
                      value={oForm.yon}
                      onChange={(e) =>
                        oAlanSet({ yon: e.target.value as OkumaForm["yon"] })
                      }
                      className={selectSinif}
                    >
                      <option value="">Seçiniz…</option>
                      <option value="gelir">Gelir (tahsilat / satış)</option>
                      <option value="gider">Gider (ödeme / alış)</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Kategori</Label>
                    <select
                      value={oForm.kategori}
                      onChange={(e) =>
                        oAlanSet({
                          kategori: e.target.value as TransactionCategory,
                        })
                      }
                      className={selectSinif}
                    >
                      {TRANSACTION_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-muted-foreground">
                      AI önerisiyle dolduruldu — gerekirse değiştirin
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tarih</Label>
                    <Input
                      type="date"
                      value={oForm.tarih}
                      onChange={(e) => oAlanSet({ tarih: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Belge No</Label>
                    <Input
                      value={oForm.belgeNo}
                      placeholder="Örn. GIB2026000001"
                      onChange={(e) => oAlanSet({ belgeNo: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Cari Ünvan</Label>
                    <Input
                      list="cari-okuma-listesi"
                      value={oForm.cariUnvan}
                      placeholder="Mevcut cariden seçin veya yeni ünvan yazın"
                      onChange={(e) => oAlanSet({ cariUnvan: e.target.value })}
                    />
                    <datalist id="cari-okuma-listesi">
                      {data.contacts.map((c) => (
                        <option key={c.id} value={c.name} />
                      ))}
                    </datalist>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Matrah (KDV hariç)</Label>
                    <Input
                      inputMode="decimal"
                      className="text-right tabular-nums"
                      value={oForm.matrah}
                      placeholder="0,00"
                      onChange={(e) =>
                        oAlanSet({ matrah: formatInputValue(e.target.value) })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>KDV Oranı</Label>
                    <select
                      value={oForm.kdvOrani}
                      onChange={(e) => oAlanSet({ kdvOrani: e.target.value })}
                      className={selectSinif}
                    >
                      <option value="0">%0</option>
                      <option value="1">%1</option>
                      <option value="10">%10</option>
                      <option value="20">%20</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>KDV Tutarı</Label>
                    <Input
                      inputMode="decimal"
                      className="text-right tabular-nums"
                      value={oForm.kdvTutar}
                      placeholder="0,00"
                      onChange={(e) =>
                        oAlanSet({ kdvTutar: formatInputValue(e.target.value) })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Toplam Tutar</Label>
                    <Input
                      inputMode="decimal"
                      className="text-right font-semibold tabular-nums"
                      value={oForm.toplamTutar}
                      placeholder="0,00"
                      onChange={(e) =>
                        oAlanSet({ toplamTutar: formatInputValue(e.target.value) })
                      }
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Hesap (kasa/banka) — hareket kaydı için</Label>
                    <select
                      value={oForm.hesapId}
                      onChange={(e) => oAlanSet({ hesapId: e.target.value })}
                      className={selectSinif}
                    >
                      <option value="">Hesap seçin…</option>
                      {data.accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.type === "kasa" ? "Kasa" : "Banka"})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Proje / Etiket</Label>
                    <Input
                      list="proje-okuma-listesi"
                      value={oForm.proje}
                      placeholder="Opsiyonel — kaydı bir projeye bağlar (yeni yazabilirsiniz)"
                      onChange={(e) => oAlanSet({ proje: e.target.value })}
                    />
                    <datalist id="proje-okuma-listesi">
                      {Array.from(
                        new Set(
                          data.transactions
                            .map((t) => t.proje)
                            .filter((p): p is string => !!p),
                        ),
                      ).map((p) => (
                        <option key={p} value={p} />
                      ))}
                    </datalist>
                  </div>
                </div>

                {durum !== "onayli" && oKalemler.length > 0 && (
                  <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-foreground">
                        Fatura Kalemleri ({oKalemler.length})
                      </p>
                      <span className="text-[11px] text-muted-foreground">
                        Seçilenler ayrı işlem olarak bölünür · Toplam {formatTRY(oKalemToplam)}
                      </span>
                    </div>
                    <ul className="mt-2 max-h-44 divide-y divide-border/60 overflow-y-auto rounded-md border bg-background">
                      {oKalemler.map((k, i) => (
                        <li key={`${k.ad}-${i}`} className="flex items-center gap-2.5 px-3 py-2">
                          <input
                            type="checkbox"
                            checked={oKalemSecim[i] ?? true}
                            onChange={(e) =>
                              setKalemSecim((prev) => {
                                const base = prev ?? oKalemler.map(() => true);
                                const next = [...base];
                                next[i] = e.target.checked;
                                return next;
                              })
                            }
                            className="size-4 accent-primary"
                          />
                          <span className="min-w-0 flex-1 truncate text-xs text-foreground">
                            {k.ad}
                          </span>
                          <span className="hidden shrink-0 text-[11px] tabular-nums text-muted-foreground sm:inline">
                            {k.miktar} × {formatTRY(k.birimFiyat)} · %{k.kdvOrani}
                          </span>
                          <span className="w-24 shrink-0 text-right font-mono text-xs tabular-nums text-foreground">
                            {formatTRY(k.toplam)}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        className="text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
                        onClick={() => setKalemSecim(oKalemler.map(() => false))}
                      >
                        Tümünü kaldır
                      </button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={
                          oSeciliKalemSayisi === 0 || !oForm.yon || !oForm.hesapId
                        }
                        onClick={kalemleriBol}
                      >
                        Seçilen {oSeciliKalemSayisi} kalemi işle böle
                      </Button>
                    </div>
                    {!oForm.yon || !oForm.hesapId ? (
                      <p className="mt-1.5 text-[11px] text-amber-700 dark:text-amber-400">
                        Bölme için önce yön ve hesap seçin.
                      </p>
                    ) : null}
                  </div>
                )}

                {!oForm.yon && (
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Yön seçilmedi — onaylamadan önce belgenin gelir mi gider mi olduğunu
                    doğrulayın.
                  </p>
                )}

                {benzerSayisi > 0 && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                    <p>
                      Aynı tarih ve tutarda {benzerSayisi} mevcut kayıt bulundu (
                      {formatTRY(oToplam)}). Onaylarsanız mükerrer oluşabilir —{' '}
                      {dupeOnay
                        ? "eminseniz butona tekrar tıklayarak onaylayın."
                        : "önce mevcut kayıtları kontrol edin."}
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-4">
                  <div className="flex gap-2">
                    {durum !== "onayli" && (
                      <Button variant="ghost" size="sm" onClick={okumayiReddet}>
                        Reddet
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={okuyorId === okumaModalDoc.id}
                      onClick={() => void belgeyiOku(okumaModalDoc)}
                    >
                      {okuyorId === okumaModalDoc.id ? (
                        <>
                          <span className="mr-1.5 size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          Okunuyor…
                        </>
                      ) : (
                        "Yeniden Okut"
                      )}
                    </Button>
                  </div>
                  {durum !== "onayli" && (
                    <div className="flex gap-2">
                      {oFaturaUygun && (
                        <Button variant="outline" size="sm" onClick={onaylaFatura}>
                          Fatura Kaydı Oluştur
                        </Button>
                      )}
                      <Button
                        size="sm"
                        disabled={!oForm.yon || oToplam <= 0}
                        onClick={onaylaHareket}
                      >
                        Onayla ve Kaydet
                      </Button>
                    </div>
                  )}
                </div>

                <p className="text-[11px] leading-4 text-muted-foreground/80">
                  Onay verilmeden bu belgeden hiçbir finansal kayıt oluşmaz; okuma yalnızca
                  belge üzerinde bir taslak olarak durur. Fatura kaydı seçeneği yalnızca fatura
                  belgelerinde ve %1/%10/%20 KDV oranlarında görünür.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
