import { Moon, Sparkles, Sun } from 'lucide-react';
import { toast } from 'sonner';
import { THEME_LABELS, useTheme } from '../../lib/theme';

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className = '' }: ThemeToggleProps) {
  const { theme, cycleTheme } = useTheme();

  const handleToggle = () => {
    const next = cycleTheme();
    toast.success(`Theme: ${THEME_LABELS[next]}`);
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`flex h-11 w-11 md:h-8 md:w-8 items-center justify-center theme-radius-md text-ink-muted hover:text-text hover:bg-hi transition cursor-pointer ${className}`.trim()}
      title={`Theme: ${THEME_LABELS[theme]} (click to switch)`}
      aria-label="Toggle theme"
    >
      {theme === 'modern' ? (
        <Sparkles className="w-4 h-4" />
      ) : theme === 'light' ? (
        <Sun className="w-4 h-4" />
      ) : (
        <Moon className="w-4 h-4" />
      )}
    </button>
  );
}
