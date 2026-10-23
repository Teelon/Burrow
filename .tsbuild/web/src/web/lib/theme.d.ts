export type BurrowTheme = 'basalt' | 'modern' | 'light';
export declare function normalizeTheme(raw: string | null | undefined): BurrowTheme;
export declare function getStoredTheme(): BurrowTheme;
export declare function applyThemeToDom(theme: BurrowTheme): void;
export declare const THEME_LABELS: Record<BurrowTheme, string>;
export declare function useTheme(): {
    theme: BurrowTheme;
    setTheme: (next: BurrowTheme) => void;
    cycleTheme: () => BurrowTheme;
    isDark: boolean;
    isModern: boolean;
    isBasalt: boolean;
};
