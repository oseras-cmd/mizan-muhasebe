/**
 * Otomatik güncelleme bildirimi.
 * Uygulama açılışında (günde bir kez) yeni sürüm kontrolü yapar;
 * yeni sürüm varsa sağ altta indirilebilir bildirim gösterir.
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { checkForUpdates, openUpdateDownload, type UpdateInfo } from "@/lib/finance/updater";
import { RefreshCw } from "lucide-react";

export function UpdateChecker() {
  const [info, setInfo] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await checkForUpdates(false);
      if (!cancelled && result?.updateAvailable) {
        setInfo(result);
        toast("Mizan için yeni sürüm mevcut", {
          description: `v${result.currentVersion} → v${result.latestVersion}`,
          duration: 12_000,
          icon: <RefreshCw className="size-4" />,
          action: {
            label: "İndir",
            onClick: () => openUpdateDownload(result.releaseUrl),
          },
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
