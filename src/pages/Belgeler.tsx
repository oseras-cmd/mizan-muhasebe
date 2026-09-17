import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatFullDate } from "@/lib/finance/format";
import {
  MAX_DOCUMENT_SIZE,
  addDocument,
  deleteDocument,
  getDocumentDataUrl,
  updateDocument,
  useFinanceData,
} from "@/lib/finance/store";
import {
  DOCUMENT_CATEGORIES,
  type DocumentCategory,
  type StoredDocument,
} from "@/lib/finance/types";
import { cn } from "@/lib/utils";
import {
  Download,
  ExternalLink,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Pencil,
  Search,
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
      addDocument({
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
    } catch (error) {
      if (error instanceof Error && error.message === "DOC_STORAGE_FULL") {
        toast.error(
          "Tarayıcı depolaması dolu. Daha küçük bir dosya deneyin veya eski belgeleri silin.",
        );
      } else {
        toast.error("Dosya okunamadı. Lütfen tekrar deneyin.");
      }
    } finally {
      setUploading(false);
    }
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

  const downloadDoc = (doc: StoredDocument) => {
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
    window.setTimeout(() => {
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
          <div className="mt-4 flex justify-end">
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
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5">
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
                          onClick={() => downloadDoc(doc)}
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
                  onClick={() => {
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
    </div>
  );
}
