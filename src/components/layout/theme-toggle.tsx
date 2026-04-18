"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

function resolveDarkFromDom(): boolean {
  const stored = localStorage.getItem("drift-theme");
  if (stored) return stored === "dark";
  return document.documentElement.classList.contains("dark");
}

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsDark(resolveDarkFromDom());
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.classList.toggle("light", !isDark);
    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";
  }, [isDark, mounted]);

  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    localStorage.setItem("drift-theme", next ? "dark" : "light");
    document.documentElement.classList.toggle("light", !next);
    document.documentElement.classList.toggle("dark", next);
    document.documentElement.style.colorScheme = next ? "dark" : "light";
  };

  const btnStyle = {
    background: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.72)",
    borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.10)",
    color: isDark ? "rgba(255,255,255,0.62)" : "rgba(10,13,18,0.56)",
    boxShadow: isDark
      ? "inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 24px rgba(0,0,0,0.18)"
      : "inset 0 1px 0 rgba(255,255,255,0.85), 0 10px 24px rgba(12,16,24,0.08)",
  } as const;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle theme"
      aria-pressed={isDark}
      className="flex h-8 w-8 items-center justify-center rounded-full border transition-all duration-200 hover:scale-105 active:scale-95"
      style={btnStyle}
      suppressHydrationWarning
    >
      {!mounted ? (
        <span className="h-3.5 w-3.5 rounded-sm bg-current opacity-25" aria-hidden />
      ) : isDark ? (
        <Sun className="h-3.5 w-3.5" strokeWidth={1.5} />
      ) : (
        <Moon className="h-3.5 w-3.5" strokeWidth={1.5} />
      )}
    </button>
  );
}
