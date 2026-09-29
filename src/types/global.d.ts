declare global {
  interface Window {
    /**
     * Navigate to the auth page with a custom redirect URL
     * @param redirectUrl - URL to redirect to after successful authentication
     */
    navigateToAuth: (redirectUrl: string) => void;
    /** Electron masaüstü köprüsü (yalnızca EXE'de tanımlı) */
    mizanBridge?: {
      getVersion: () => Promise<string>;
      checkUpdates: () => Promise<unknown>;
      /** TCMB günlük kur XML'ini ana süreç üzerinden çeker */
      fetchTcmb: () => Promise<{ ok: boolean; xml?: string; error?: string }>;
    };
  }
}

export {};