"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/useTheme";

export function ThemeToggle() {
  const { theme, setTheme, isDark } = useTheme();

  return (
    <div className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.06] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]">
      <button
        type="button"
        onClick={() => setTheme("light")}
        aria-pressed={!isDark}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition-all ${!isDark ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500 hover:text-zinc-200"}`}
        title="Light mode"
      >
        <Sun className="h-4 w-4" strokeWidth={1.75} />
      </button>
      <button
        type="button"
        onClick={() => setTheme("dark")}
        aria-pressed={isDark}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition-all ${isDark ? "bg-white/[0.14] text-white shadow-[0_0_18px_rgba(255,255,255,0.08)]" : "text-zinc-500 hover:text-zinc-900"}`}
        title="Dark mode"
      >
        <Moon className="h-4 w-4" strokeWidth={1.75} />
      </button>
      <button
        type="button"
        onClick={() => setTheme("system")}
        aria-pressed={theme === "system"}
        className={`px-3 text-xs font-medium transition-colors ${theme === "system" ? "text-foreground" : "text-zinc-500 hover:text-foreground"}`}
        title="System theme"
      >
        Auto
      </button>
    </div>
  );
}
