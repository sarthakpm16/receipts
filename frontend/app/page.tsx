"use client"

import { SearchInterface } from "@/components/search-interface"
import { mockSearchData } from "@/lib/mock-data"

export default function Page() {
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
        <SearchInterface searchData={mockSearchData} />
      </div>
    </main>
  )
}
