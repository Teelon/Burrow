import { useEffect, useState } from 'react';
import { Outlet } from '@tanstack/react-router';
import { Bell, Menu } from 'lucide-react';
import { Toaster } from 'sonner';
import { Sidebar } from './Sidebar';
import { CommandPalette } from '../CommandPalette';
import { ShortcutHelp } from './ShortcutHelp';

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // "?" opens the shortcuts help (unless typing in a field or using a modifier).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '?' || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      e.preventDefault();
      setShortcutsOpen((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg text-text">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex shrink-0">
        <Sidebar />
      </div>

      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
        />
      )}

      {/* Mobile Drawer: flush --side panel, viewport edges stay square (0px) */}
      <div
        className={`fixed inset-y-0 left-0 z-50 transform md:hidden transition-transform duration-200 ease-in-out bg-side ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar onCloseMobile={() => setMobileOpen(false)} />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Dense 48px slate header bar (--side) */}
        <header className="h-12 border-b border-line flex items-center justify-between px-4 shrink-0 bg-side">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden flex h-11 w-11 items-center justify-center text-muted hover:text-text hover:bg-hi transition"
              aria-label="Open sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="font-semibold text-sm tracking-tight hidden md:inline-block">
              Burrow
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="notifications-bell"
              className="relative flex h-11 w-11 md:h-8 md:w-8 items-center justify-center text-muted hover:text-text hover:bg-hi transition"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              <span className="sr-only">Notifications</span>
            </button>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <Outlet />
        </main>
      </div>

      {/* Global Command Palette */}
      <CommandPalette />

      {/* Keyboard shortcuts help ("?") */}
      {shortcutsOpen && <ShortcutHelp onClose={() => setShortcutsOpen(false)} />}

      {/* Toasts (sonner) */}
      <Toaster position="bottom-right" richColors />
    </div>
  );
}
