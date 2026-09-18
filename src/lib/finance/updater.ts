/**
 * Otomatik güncelleme kontrolü.
 *
 * EXE (Electron) sürümünde: ana süreçten `app:get-version` ve
 * `app:check-updates` IPC köprüleriyle GitHub Releases'teki son sürüm
 * kontrol edilir. Web sürümünde: /version.json'a bakılır (sessiz geçilir).
 */

export interface UpdateInfo {
  /** Mevcut sürüm (örn. "1.0.1") */
  currentVersion: string;
  /** GitHub'daki en son sürüm */
  latestVersion: string;
  /** Yeni sürüm var mı */
  updateAvailable: boolean;
  /** İndirme sayfası / asset linki */
  releaseUrl: string;
  /** Sürüm notları */
  notes?: string;
}

/** Sürüm dizilerini sayısal karşılaştırır: 1.0.10 > 1.0.9 */
export function isNewerVersion(current: string, candidate: string): boolean {
  const parse = (v: string) =>
    v
      .replace(/^v/i, "")
      .split(".")
      .map((n) => Number.parseInt(n, 10) || 0);
  const a = parse(current);
  const b = parse(candidate);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (y > x) return true;
    if (y < x) return false;
  }
  return false;
}

const GITHUB_REPO = "oseras-cmd/mizan-muhasebe";
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // günde bir
const STORAGE_KEY = "mizan-last-update-check-v1";

/** Electron ana sürecinde mi çalışıyor? */
export function isElectron(): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      (window as unknown as { mizanDesktop?: boolean }).mizanDesktop === true
    );
  } catch {
    return false;
  }
}

function getAppVersion(): string {
  // Electron: ana süreçten; web: meta etiket
  try {
    if (isElectron()) {
      const bridge = (
        window as unknown as {
          mizanBridge?: { getVersion?: () => Promise<string> };
        }
      ).mizanBridge;
      // Eşzamanlı erişim için senkron sürüm de saklanır
      const sync = (
        window as unknown as { mizanVersion?: string }
      ).mizanVersion;
      if (sync) return sync;
      if (bridge?.getVersion) {
        void bridge.getVersion().then((v) => {
          (window as unknown as { mizanVersion?: string }).mizanVersion = v;
        });
      }
    }
  } catch {
    // ignore
  }
  const meta = document.querySelector('meta[name="mizan-version"]');
  return meta?.getAttribute("content") ?? "1.0.1";
}

function shouldCheckNow(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return true;
    const last = Number(raw);
    return !Number.isFinite(last) || Date.now() - last > CHECK_INTERVAL_MS;
  } catch {
    return true;
  }
}

function markChecked(): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

/**
 * Son sürümü kontrol eder. Yeni sürüm varsa UpdateInfo döner;
 * hata/son gün kontrolü durumunda null döner.
 */
export async function checkForUpdates(force = false): Promise<UpdateInfo | null> {
  if (!force && !shouldCheckNow()) return null;

  const currentVersion = getAppVersion();

  try {
    // 1) Electron köprüsü varsa ana süreçten GitHub sürüm bilgisi
    const bridge = (
      window as unknown as {
        mizanBridge?: { checkUpdates?: () => Promise<UpdateInfo | null> };
      }
    ).mizanBridge;
    if (isElectron() && bridge?.checkUpdates) {
      const info = await bridge.checkUpdates();
      if (!force) markChecked();
      if (info) return info;
      return null;
    }

    // 2) Web / Electron yedeği: doğrudan GitHub Releases API
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
      { headers: { Accept: "application/vnd.github+json" } },
    );
    if (!res.ok) return null;
    const payload = (await res.json()) as {
      tag_name?: string;
      html_url?: string;
      body?: string;
      assets?: { browser_download_url: string; name: string }[];
    };
    const tag = payload.tag_name?.replace(/^v/i, "") ?? "";
    if (!tag) return null;

    const updateAvailable = isNewerVersion(currentVersion, tag);
    const exeAsset = payload.assets?.find((a) =>
      a.name.toLowerCase().endsWith(".exe"),
    );

    if (!force) markChecked();

    return {
      currentVersion,
      latestVersion: tag,
      updateAvailable,
      releaseUrl:
        exeAsset?.browser_download_url ?? payload.html_url ?? `https://github.com/${GITHUB_REPO}/releases`,
      notes: payload.body?.slice(0, 500),
    };
  } catch {
    return null;
  }
}

/** Kullanıcıyı yeni sürüme yönlendirir (indirme linkini açar). */
export function openUpdateDownload(url: string): void {
  window.open(url, "_blank", "noopener");
}
