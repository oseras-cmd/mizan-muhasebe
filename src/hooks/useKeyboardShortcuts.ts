/**
 * Klavye kısayolları
 * Ctrl+N → Hızlı gelir/gider ekle
 * Ctrl+F → Global arama
 * Ctrl+K → Global arama (alternatif)
 */

import { useEffect } from "react";

export interface ShortcutHandlers {
  onNewTransaction?: () => void;
  onSearch?: () => void;
  onToggleTheme?: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;

      // Ctrl+N → Yeni işlem
      if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        e.preventDefault();
        handlers.onNewTransaction?.();
      }

      // Ctrl+F veya Ctrl+K → Arama (input'taysa tarayıcının varsayılana izin ver)
      if ((e.ctrlKey || e.metaKey) && (e.key === "f" || e.key === "k") && !isInput) {
        e.preventDefault();
        handlers.onSearch?.();
      }

      // Ctrl+D → Tema değiştir
      if ((e.ctrlKey || e.metaKey) && e.key === "d") {
        e.preventDefault();
        handlers.onToggleTheme?.();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlers]);
}
