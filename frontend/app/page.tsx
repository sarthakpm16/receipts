"use client"

import { useState, useEffect } from "react"
import { SearchInterface } from "@/components/search-interface"
import type { SearchData } from "@/components/search-interface"
import { getSearchData } from "@/lib/search-data"

export default function Page() {
  const [searchData, setSearchData] = useState<SearchData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getSearchData()
      .then(setSearchData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
  }, [])

  return (
    <main
      className="relative flex h-dvh flex-col overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse at 0% 0%, rgba(77,161,255,0.55) 0%, rgba(77,161,255,0.25) 25%, rgba(77,161,255,0.08) 50%, #ffffff 80%)",
      }}
    >

      {/* Header */}
      <header className="flex items-center justify-between px-6 pb-2 pt-5 md:px-10">
        <div className="flex items-center gap-2.5">
          <span className="font-serif text-3xl italic text-foreground">
            receipts
          </span>
        </div>
      </header>

      {/* Chat interface */}
      <div className="flex-1 overflow-hidden">
        {error ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 max-w-md">
            <p className="text-center text-sm font-medium text-foreground">Could not load messages</p>
            <p className="text-center text-sm text-muted-foreground">{error}</p>
            {error.includes("processed.db") ? (
              <p className="text-center text-xs text-muted-foreground mt-2">
                From the project root run: <code className="rounded bg-muted px-1.5 py-0.5 text-xs">python scripts/import_imessage.py</code> (requires <code className="rounded bg-muted px-1.5 py-0.5 text-xs">input/chat.db</code> and optionally <code className="rounded bg-muted px-1.5 py-0.5 text-xs">input/contacts.vcf</code>).
              </p>
            ) : (
              <p className="text-center text-xs text-muted-foreground">Make sure the API is running: <code className="rounded bg-muted px-1.5 py-0.5 text-xs">uvicorn app.main:app --reload</code></p>
            )}
          </div>
        ) : searchData ? (
          <SearchInterface searchData={searchData} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-iosBlue border-t-transparent" />
            <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
          </div>
        )}
      </div>
    </main>
  )
}
