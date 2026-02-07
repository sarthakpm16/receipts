"use client"

import { useState, useRef, useEffect } from "react"
import type { Contact } from "./search-interface"

export type ContactFilter = {
  type: "all" | "person" | "group"
  name?: string
}

interface ContactSelectorProps {
  filter: ContactFilter
  onFilterChange: (filter: ContactFilter) => void
  allContacts: Contact[]
  recentContacts: Contact[]
}

export function ContactSelector({ filter, onFilterChange, allContacts, recentContacts }: ContactSelectorProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [showAbove, setShowAbove] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setSearchQuery("")
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  useEffect(() => {
    if (open && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [open])

  // Check if dropdown should appear above the button
  useEffect(() => {
    if (open && ref.current) {
      const rect = ref.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
      const dropdownHeight = 400 // approximate height with search
      
      setShowAbove(spaceBelow < dropdownHeight && spaceAbove > spaceBelow)
    }
  }, [open])

  const label =
    filter.type === "all"
      ? "All Messages"
      : filter.name || (filter.type === "person" ? "Person" : "Group")

  // Show recent by default, search all when user types
  const isSearching = searchQuery.length > 0
  const contactsToSearch = isSearching ? allContacts : recentContacts
  
  const filteredPeople = contactsToSearch
    .filter((c) => c.type === "person" && c.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .map((c) => c.name)
  
  const filteredGroups = contactsToSearch
    .filter((c) => c.type === "group" && c.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .map((c) => c.name)

  const hasResults = filteredPeople.length > 0 || filteredGroups.length > 0

  return (
    <div className="relative flex items-center gap-1" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-all hover:bg-gray-50"
      >
        {filter.type === "all" && (
          <svg className="h-3.5 w-3.5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
        {filter.type === "person" && (
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-iosBlue text-[9px] font-semibold text-white">
            {filter.name?.[0]}
          </span>
        )}
        {filter.type === "group" && (
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-gray-500 text-[9px] font-semibold text-white">
            {filter.name?.[0] || "#"}
          </span>
        )}
        <span className="max-w-[110px] truncate">{label}</span>
        <svg className={`h-3 w-3 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      
      {filter.type !== "all" && (
        <button
          type="button"
          onClick={() => onFilterChange({ type: "all" })}
          className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          aria-label="Clear filter"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}

      {open && (
        <div className={`absolute left-0 z-50 w-72 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl ${
          showAbove ? "bottom-full mb-2" : "top-full mt-2"
        }`}>
          {/* Search input */}
          <div className="border-b border-gray-100 p-2.5">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full rounded-md bg-gray-50 py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-gray-400 focus:bg-gray-100 focus:outline-none"
              />
            </div>
          </div>

          <div className="max-h-[320px] overflow-y-auto">
            {/* All Messages option */}
            {searchQuery === "" && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onFilterChange({ type: "all" })
                    setOpen(false)
                    setSearchQuery("")
                  }}
                  className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-gray-50 ${
                    filter.type === "all" ? "bg-blue-50" : ""
                  }`}
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100">
                    <svg className={`h-4 w-4 ${filter.type === "all" ? "text-iosBlue" : "text-gray-500"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  </div>
                  <span className={`text-sm ${filter.type === "all" ? "font-semibold text-iosBlue" : "font-medium text-gray-900"}`}>
                    All Messages
                  </span>
                </button>
                <div className="my-0.5 h-px bg-gray-100" />
              </>
            )}

            {!hasResults && searchQuery && (
              <div className="px-3 py-10 text-center">
                <p className="text-sm text-gray-500">No contacts found</p>
              </div>
            )}

            {/* People section */}
            {filteredPeople.length > 0 && (
              <div>
                <div className="px-3 py-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                    {isSearching ? "People" : "Recent"}
                  </span>
                </div>
                {filteredPeople.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => {
                      onFilterChange({ type: "person", name })
                      setOpen(false)
                      setSearchQuery("")
                    }}
                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-gray-50 ${
                      filter.type === "person" && filter.name === name
                        ? "bg-blue-50"
                        : ""
                    }`}
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-iosBlue text-[11px] font-semibold text-white">
                      {name[0]}
                    </div>
                    <span className={`text-sm ${
                      filter.type === "person" && filter.name === name
                        ? "font-semibold text-iosBlue"
                        : "font-medium text-gray-900"
                    }`}>
                      {name}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Groups section */}
            {filteredGroups.length > 0 && (
              <div className={filteredPeople.length > 0 ? "mt-0.5" : ""}>
                {filteredPeople.length > 0 && <div className="my-0.5 h-px bg-gray-100" />}
                <div className="px-3 py-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                    {isSearching ? "Groups" : "Groups"}
                  </span>
                </div>
                {filteredGroups.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => {
                      onFilterChange({ type: "group", name })
                      setOpen(false)
                      setSearchQuery("")
                    }}
                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-gray-50 ${
                      filter.type === "group" && filter.name === name
                        ? "bg-blue-50"
                        : ""
                    }`}
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-500 text-[11px] font-semibold text-white">
                      {name[0]}
                    </div>
                    <span className={`flex-1 truncate text-sm ${
                      filter.type === "group" && filter.name === name
                        ? "font-semibold text-iosBlue"
                        : "font-medium text-gray-900"
                    }`}>
                      {name}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
