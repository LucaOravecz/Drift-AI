import { useEffect, useState, useCallback } from "react";

type Theme = "light" | "dark" | "system";

interface UseThemeOptions {
  storageKey?: string;
}

/**
 * Hook for managing light/dark theme
 * Stores preference in localStorage and applies to document
 */
export function useTheme({ storageKey = "theme-preference" }: UseThemeOptions = {}) {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  // Initialize theme from localStorage after mount (avoid SSR/hydration mismatch).
  useEffect(() => {
    const stored = localStorage.getItem(storageKey) as Theme | null;
    queueMicrotask(() => {
      if (stored && ["light", "dark", "system"].includes(stored)) {
        setTheme(stored);
      }
      setMounted(true);
    });
  }, [storageKey]);

  // Apply theme to document
  useEffect(() => {
    if (!mounted) return;

    const root = document.documentElement;
    const isDark =
      theme === "dark" ||
      (theme === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);

    if (isDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme, mounted]);

  const setThemePreference = useCallback(
    (newTheme: Theme) => {
      setTheme(newTheme);
      localStorage.setItem(storageKey, newTheme);
    },
    [storageKey]
  );

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "light" ? "dark" : "light";
      localStorage.setItem(storageKey, next);
      return next;
    });
  }, [storageKey]);

  return {
    theme,
    setTheme: setThemePreference,
    toggleTheme,
    isDark: theme === "dark" || (theme === "system" && mounted && window.matchMedia("(prefers-color-scheme: dark)").matches),
  };
}
