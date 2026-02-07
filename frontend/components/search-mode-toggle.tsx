"use client"

import { SparkleIcon } from "./sparkle-icon"

type SearchMode = "exact" | "ask"

interface SearchModeToggleProps {
  mode: SearchMode
  onModeChange: (mode: SearchMode) => void
}

export function SearchModeToggle({ mode, onModeChange }: SearchModeToggleProps) {
  return (
    <div className="flex items-center rounded-full bg-muted p-0.5">
      <button
        type="button"
        onClick={() => onModeChange("exact")}
        className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
          mode === "exact"
            ? "bg-foreground text-background shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Exact
      </button>
      <button
        type="button"
        onClick={() => onModeChange("ask")}
        className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
          mode === "ask"
            ? "bg-imsg-blue text-white shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <SparkleIcon className="h-3 w-3" />
        Ask
      </button>
    </div>
  )
}
