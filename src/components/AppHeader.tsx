import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { overduePayments } from "@/lib/finance/dashboard";
import { useFinanceData } from "@/lib/finance/store";
import { getResolvedTheme, setTheme } from "@/lib/finance/theme";
import { useGlobalSearch, getSearchKindLabel } from "@/lib/finance/search";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Calculator,
  CalendarClock,
  Download,
  FolderOpen,
  LayoutDashboard,
  LayoutList,
  LogOut,
  Moon,
  Search,
  Settings,
  Sun,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router";
import { toast } from "sonner";
import { NotificationCenter } from "./NotificationCenter";
import { Wordmark } from "./Wordmark";
import {
  exportContactsCSV,
  exportPaymentsCSV,
  exportTodosCSV,
  exportTransactionsCSV,
  exportAccountsCSV,
} from "@/lib/finance/csvExport";
import { exportAllExcel } from "@/lib/finance/excelExport";

const navGroups = [
  {
    label: "Genel",
    items: [
      { to: "/dashboard", label: "Genel Bakış", icon: LayoutDashboard },
      { to: "/odemeler", label: "Ödemeler", icon: CalendarClock },
      { to: "/gorevler", label: "Görevler", icon: LayoutList },
    ],
  },
  {
    label: "Finans",
    items: [

      { to: "/odeme-gecmisi", label: "Ödeme Geçmişi", icon: Wallet },
      { to: "/rapor", label: "Rapor", icon: BarChart3 },
    ],
  },
  {
    label: "Araçlar",
    items: [
      { to: "/belgeler", label: "Belgeler", icon: FolderOpen },
      { to: "/hesaplayicilar", label: "Hesaplayıcı", icon: Calculator },
    ],
  },
  {
    label: "Sistem",
    items: [{ to: "/ayarlar", label: "Ayarlar", icon: Settings }],
  },
];

export function AppHeader() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const data = useFinanceData();
  const overdueCount = overduePayments(data).length;
  const [isDark, setIsDark] = useState(() => getResolvedTheme() === "dark");
  const [showSearch, setShowSearch] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [activeResult, setActiveResult] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const { query, setQuery, results } = useGlobalSearch();

  const toggleTheme = useCallback(() => {
    const next = isDark ? "light" : "dark";
    setTheme(next);
    setIsDark(next === "dark");
  }, [isDark]);

  const openSearch = useCallback(() => setShowSearch(true), []);

  const closeSearch = useCallback(() => {
    setShowSearch(false);
    setQuery("");
  }, [setQuery]);

  /** Ctrl+K modalinin klavye navigasyonu: ↑/↓ ile seç, Enter ile aç, Esc ile kapat */
  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveResult((prev) => (results.length === 0 ? 0 : (prev + 1) % results.length));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveResult((prev) =>
          results.length === 0 ? 0 : (prev - 1 + results.length) % results.length,
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        const r = results[activeResult];
        if (r) {
          navigate(r.url);
          closeSearch();
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        closeSearch();
      }
    },
    [results, activeResult, navigate, closeSearch],
  );

  useKeyboardShortcuts({
    onSearch: openSearch,
    onToggleTheme: toggleTheme,
  });

  useEffect(() => {
    if (showSearch && searchRef.current) {
      searchRef.current.focus();
    }
  }, [showSearch]);

  // Sorgu değişince seçili sonucu sıfırla
  useEffect(() => {
    setActiveResult(0);
  }, [query]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const handleExport = (kind: string) => {
    setShowExport(false);
    switch (kind) {
      case "contacts":
        exportContactsCSV(data.contacts);
        break;
      case "payments":
        exportPaymentsCSV(data.upcomingPayments);
        break;
      case "todos":
        exportTodosCSV(data.todos, data.todoSections);
        break;
      case "transactions":
        exportTransactionsCSV(data.transactions);
        break;
      case "accounts":
        exportAccountsCSV(data.accounts);
        break;
      case "excel":
        exportAllExcel(data);
        toast.dismiss();
        toast.success("Excel dosyası indirildi — tüm sayfalar.");
        return;
    }
    toast.success("CSV dosyası indirildi.");
  };

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-20 flex w-64 flex-col border-r border-sidebar-border/80 bg-sidebar">
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border/60 px-6">
          <NavLink to="/dashboard" className="shrink-0">
            <Wordmark />
          </NavLink>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-5">
          {navGroups.map((group) => (
            <div key={group.label} className="mb-6 last:mb-0">
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/50">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors",
                        isActive
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon
                          className={cn("size-4 shrink-0", !isActive && "opacity-75")}
                        />
                        <span>{item.label}</span>
                        {item.to === "/odemeler" && overdueCount > 0 && (
                          <span
                            className={cn(
                              "ml-auto rounded-full px-1.5 py-px font-mono text-[10px] font-semibold tabular-nums",
                              isActive
                                ? "bg-primary-foreground/25 text-primary-foreground"
                                : "bg-destructive/10 text-destructive",
                            )}
                          >
                            {overdueCount}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t border-sidebar-border/60 p-3">
          <div className="flex items-center gap-3 rounded-xl bg-muted/50 px-3 py-2.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-xs font-bold uppercase text-primary ring-1 ring-primary/20">
              {(user?.email ?? "MZ").slice(0, 2)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-foreground">Oturum</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {user?.email ?? "—"}
              </p>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              title="Çıkış"
              className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="size-3.5" />
            </button>
          </div>
          <div className="mt-2 flex items-center gap-1 px-1">
            <Button type="button" variant="ghost" size="sm" className="h-8 flex-1 justify-start gap-2 text-xs text-muted-foreground hover:text-foreground" onClick={toggleTheme} title="Tema değiştir">
              {isDark ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
              {isDark ? "Aydınlık" : "Karanlık"} tema
            </Button>
            <Button type="button" variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-foreground" onClick={() => setShowSearch(true)} title="Ara (Ctrl+F)">
              <Search className="size-3.5" />
            </Button>
          </div>
        </div>
      </aside>
      <div className="pl-64">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="flex h-14 items-center justify-between gap-4 px-6">
          <div className="flex min-w-0 items-center gap-5">
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {/* Arama */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 text-muted-foreground hover:text-foreground"
              onClick={() => setShowSearch(true)}
              title="Ara (Ctrl+F)"
            >
              <Search className="size-4" />
            </Button>

            {/* CSV Dışa Aktar */}
            <div className="relative">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 text-muted-foreground hover:text-foreground"
                onClick={() => setShowExport(!showExport)}
                title="Dışa Aktar"
              >
                <Download className="size-4" />
              </Button>
              {showExport && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowExport(false)} />
                  <div className="absolute right-0 top-full z-50 mt-2 w-52 rounded-lg border bg-card shadow-lg">
                    {[
                      { kind: "transactions", label: "İşlemler" },
                      { kind: "contacts", label: "Cariler" },
                      { kind: "payments", label: "Ödemeler" },
                      { kind: "todos", label: "Görevler" },
                      { kind: "accounts", label: "Hesaplar" },
                      { kind: "excel", label: "Tümü (Excel)" },
                    ].map((item) => (
                      <button
                        key={item.kind}
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted"
                        onClick={() => handleExport(item.kind)}
                      >
                        <Download className="size-3.5 text-muted-foreground" />
                        {item.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <NotificationCenter />
          </div>
        </div>
      </header>
      </div>

      {/* Global Arama Modal */}
      {showSearch && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[15vh]" onClick={() => { setShowSearch(false); setQuery(""); }}>
          <div className="w-full max-w-lg rounded-lg border bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 border-b border-border/70 px-4 py-3">
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <input
                ref={searchRef}
                type="text"
                placeholder="Tüm modüllerde ara... (cariler, işlemler, ödemeler, görevler)"
                className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
              />
              <Button type="button" variant="ghost" size="icon" className="size-6" onClick={closeSearch}>
                <X className="size-3.5" />
              </Button>
            </div>
            {results.length > 0 && (
              <ul className="max-h-72 overflow-y-auto p-1">
                {results.map((r, idx) => (
                  <li key={`${r.kind}-${r.id}`}>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm",
                        idx === activeResult ? "bg-muted" : "hover:bg-muted",
                      )}
                      onMouseEnter={() => setActiveResult(idx)}
                      onClick={() => { navigate(r.url); setShowSearch(false); setQuery(""); }}
                    >
                      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        {getSearchKindLabel(r.kind)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-foreground">{r.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{r.subtitle}</p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {query && results.length === 0 && (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-muted-foreground">Sonuç bulunamadı</p>
              </div>
            )}
            {!query && (
              <div className="px-4 py-6 text-center">
                <p className="text-xs text-muted-foreground">Aramak istediğiniz terimi yazın</p>
                <p className="mt-1 text-[10px] text-muted-foreground/60">
                  Klavye kısayolu: Ctrl+K veya Ctrl+F · ↑↓ gezin · Enter aç · Esc kapat
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
