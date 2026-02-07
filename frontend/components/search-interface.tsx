"use client"

import React from "react"
import { useState, useRef, useEffect } from "react"
import { SearchModeToggle } from "./search-mode-toggle"
import { ContactSelector, type ContactFilter } from "./contact-selector"
import Tapback from "./tapback"

type SearchMode = "exact" | "ask"

// Re-export for convenience
export type { ContactFilter }

export interface TextMessage {
  sender: string
  text: string
  time: string
  isUser?: boolean
}

export interface Thread {
  id: string
  date: string
  context: string
  messages: TextMessage[]
}

export interface Contact {
  name: string
  type: "person" | "group"
}

export interface AskResult {
  answer: string
  sources: { chat_id: number; title: string }[]
}

export interface SearchData {
  allContacts: Contact[]
  recentContacts: Contact[]
  onSearch: (query: string, mode: SearchMode, filter: ContactFilter) => Promise<Thread[]>
  onAsk?: (query: string, filter: ContactFilter) => Promise<AskResult>
}

/* ── iMessage-style bubble for a single message ── */
function MessageBubble({ msg, showSender }: { msg: TextMessage; showSender: boolean }) {
  if (msg.isUser) {
    return (
      <div className="flex flex-col items-end">
        <div className="max-w-[75%] rounded-2xl rounded-br-md bg-iosBlue px-3.5 py-2">
          <p className="text-[15px] leading-snug text-white">{msg.text}</p>
        </div>
        <span className="mt-0.5 pr-1 text-[10px] text-muted-foreground/60">{msg.time}</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-start">
      {showSender && (
        <span className="mb-0.5 pl-1 text-[11px] font-medium text-muted-foreground">{msg.sender}</span>
      )}
      <div className="max-w-[75%] rounded-2xl rounded-bl-md bg-[#E9E9EB] px-3.5 py-2">
        <p className="text-[15px] leading-snug text-foreground">{msg.text}</p>
      </div>
      <span className="mt-0.5 pl-1 text-[10px] text-muted-foreground/60">{msg.time}</span>
    </div>
  )
}

/* ── Skeleton loader for threads ── */
function ThreadSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl bg-white/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.05] backdrop-blur-sm">
      {/* Header skeleton */}
      <div className="flex items-center justify-between border-b border-black/[0.04] px-4 py-2.5">
        <div className="h-4 w-32 overflow-hidden rounded bg-gray-200">
          <div className="h-full w-full animate-shimmer bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%]" />
        </div>
        <div className="h-3 w-24 overflow-hidden rounded bg-gray-200">
          <div className="h-full w-full animate-shimmer bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] [animation-delay:100ms]" />
        </div>
      </div>
      
      {/* Message bubbles skeleton */}
      <div className="space-y-2 px-3 py-3">
        {/* Incoming message */}
        <div className="flex justify-start">
          <div className="h-12 w-48 overflow-hidden rounded-2xl rounded-bl-md bg-gray-200">
            <div className="h-full w-full animate-shimmer bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] [animation-delay:200ms]" />
          </div>
        </div>
        {/* Outgoing message */}
        <div className="flex justify-end">
          <div className="h-10 w-36 overflow-hidden rounded-2xl rounded-br-md bg-gray-200">
            <div className="h-full w-full animate-shimmer bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] [animation-delay:400ms]" />
          </div>
        </div>
        {/* Incoming message */}
        <div className="flex justify-start">
          <div className="h-14 w-52 overflow-hidden rounded-2xl rounded-bl-md bg-gray-200">
            <div className="h-full w-full animate-shimmer bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] [animation-delay:600ms]" />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── A conversation thread card ── */
function ConversationThread({ thread }: { thread: Thread }) {
  const [expanded, setExpanded] = useState(false)
  const previewCount = 3
  const hasMore = thread.messages.length > previewCount
  const displayMessages = expanded ? thread.messages : thread.messages.slice(0, previewCount)

  return (
    <div className="overflow-hidden rounded-2xl bg-white/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.05] backdrop-blur-sm">
      {/* Conversation header - like a message thread */}
      <div className="flex items-center justify-between border-b border-black/[0.04] px-4 py-2.5">
        <span className="text-sm font-semibold text-gray-900">{thread.context}</span>
        <span className="text-xs text-gray-500">{thread.date}</span>
      </div>

      {/* iMessage bubble area */}
      <div className="space-y-1.5 px-3 py-3">
        {displayMessages.map((msg, i) => {
          const prevMsg = i > 0 ? displayMessages[i - 1] : null
          const showSender = !msg.isUser && (!prevMsg || prevMsg.sender !== msg.sender || !!prevMsg.isUser)
          return <MessageBubble key={`${thread.id}-${i}`} msg={msg} showSender={showSender} />
        })}
      </div>

      {/* Expand/collapse */}
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center justify-center gap-1 border-t border-black/[0.04] py-2.5 text-[12px] font-medium text-iosBlue transition-colors hover:bg-black/[0.01]"
        >
          <svg
            className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
          {expanded
            ? "Show less"
            : `${thread.messages.length - previewCount} more`}
        </button>
      )}
    </div>
  )
}

/* ── Main search interface ── */
export function SearchInterface({ searchData }: { searchData: SearchData }) {
  const [results, setResults] = useState<Thread[] | null>(null)
  const [askResult, setAskResult] = useState<AskResult | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [input, setInput] = useState("")
  const [mode, setMode] = useState<SearchMode>("ask")
  const [filter, setFilter] = useState<ContactFilter>({ type: "all" })
  const [loading, setLoading] = useState(false)
  const [searchedQuery, setSearchedQuery] = useState("")
  const [unfilteredResults, setUnfilteredResults] = useState<Thread[] | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  
  // Animation states for empty state
  const [showFirstMessage, setShowFirstMessage] = useState(false)
  const [showTapback, setShowTapback] = useState(false)
  const [showTyping, setShowTyping] = useState(false)
  const [showSecondMessage, setShowSecondMessage] = useState(false)
  
  // Animate empty state messages
  useEffect(() => {
    if (!results && !askResult && !loading && !searchedQuery) {
      // Reset animation
      setShowFirstMessage(false)
      setShowTapback(false)
      setShowTyping(false)
      setShowSecondMessage(false)
      
      // Sequence the animation - faster timing
      const timer1 = setTimeout(() => setShowFirstMessage(true), 100)
      const timer2 = setTimeout(() => setShowTapback(true), 400)
      const timer3 = setTimeout(() => setShowTyping(true), 650)
      const timer4 = setTimeout(() => {
        setShowTyping(false)
        setShowSecondMessage(true)
      }, 1400)
      
      return () => {
        clearTimeout(timer1)
        clearTimeout(timer2)
        clearTimeout(timer3)
        clearTimeout(timer4)
      }
    }
  }, [results, askResult, loading, searchedQuery])

  function filterThreadsByContact(threads: Thread[]): Thread[] {
    if (filter.type === "all") return threads
    
    return threads.filter((thread) => {
      if (filter.type === "person") {
        // For person filter, show threads where context is the person OR they participated
        return (
          thread.context === filter.name ||
          thread.messages.some((msg) => msg.sender === filter.name)
        )
      } else if (filter.type === "group") {
        // For group filter, show only threads with matching context
        return thread.context === filter.name
      }
      return true
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim()) return

    const query = input.trim()
    setSearchedQuery(query)
    setInput("")
    setLoading(true)
    setSearchError(null)
    setAskResult(null)
    setResults(null)
    setUnfilteredResults(null)

    try {
      if (mode === "ask" && searchData.onAsk) {
        const ask = await searchData.onAsk(query, filter)
        setAskResult(ask)
      } else {
        const baseResults = await searchData.onSearch(query, mode, filter)
        setUnfilteredResults(baseResults)
        const filteredResults = filterThreadsByContact(baseResults)
        setResults(filteredResults)
      }
    } catch (error) {
      console.error(mode === "ask" ? "Ask error:" : "Search error:", error)
      setSearchError(error instanceof Error ? error.message : "Something went wrong")
      setResults([])
      setAskResult(null)
    } finally {
      setLoading(false)
    }
  }

  function handleClear() {
    setInput("")
    setResults(null)
    setAskResult(null)
    setSearchError(null)
    setUnfilteredResults(null)
    setSearchedQuery("")
    setLoading(false)
    inputRef.current?.focus()
  }

  // Re-filter results when filter changes
  useEffect(() => {
    if (unfilteredResults) {
      const filteredResults = filterThreadsByContact(unfilteredResults)
      setResults(filteredResults)
    }
  }, [filter])

  const placeholder =
    mode === "exact"
      ? 'Search keywords like "dinner", "meeting"...'
      : 'Ask anything like "when did we plan to meet?"'

  const hasResults = results !== null || askResult !== null

  return (
    <div className="flex h-full flex-col">
      {/* Top area: empty state or results */}
      <div className="flex-1 overflow-y-auto">
        {!hasResults && !loading ? (
          <div className="flex h-full flex-col items-center justify-center px-4 pb-24">
            <div className="w-full max-w-md space-y-2.5">
              {/* First message - incoming */}
              {showFirstMessage && (
                <div className="flex justify-start animate-in fade-in slide-in-from-left-3 duration-150">
                  <div className="relative">
                    <div className="rounded-[18px] rounded-bl-md bg-white/95 px-4 py-2.5 shadow-[0_1px_3px_rgba(0,0,0,0.1)] backdrop-blur-sm">
                      <p className="text-[15px] leading-snug text-gray-900">
                        What are you looking for?
                      </p>
                    </div>
                    {/* Tapback pops in separately */}
                    {showTapback && (
                      <div className="absolute -top-4 -right-4 animate-in zoom-in-50 duration-150">
                        <Tapback transform="" />
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Typing indicator - blue */}
              {showTyping && (
                <div className="flex justify-end animate-in fade-in slide-in-from-right-3 duration-150">
                  <div className="rounded-[18px] rounded-br-md bg-iosBlue px-4 py-3">
                    <div className="flex gap-1">
                      <div className="h-2 w-2 animate-bounce rounded-full bg-white/70 [animation-delay:-0.3s]" />
                      <div className="h-2 w-2 animate-bounce rounded-full bg-white/70 [animation-delay:-0.15s]" />
                      <div className="h-2 w-2 animate-bounce rounded-full bg-white/70" />
                    </div>
                  </div>
                </div>
              )}
              
              {/* Second message - outgoing */}
              {showSecondMessage && (
                <div className="flex justify-end animate-in fade-in slide-in-from-right-3 duration-150">
                  <div className="max-w-[50%] rounded-[18px] rounded-br-md bg-iosBlue px-4 py-2.5 shadow-[0_2px_8px_rgba(0,122,255,0.3)]">
                    <p className="text-[15px] leading-snug text-white">
                      Search messages or ask questions about past conversations.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-xl px-4 pt-6 pb-8 md:px-0">
            {/* Results header - minimal and subtle */}
            {searchedQuery && (
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-baseline gap-2 text-sm text-gray-900/60">
                  <span>
                    Results for <span className="font-semibold text-gray-900">"{searchedQuery}"</span>
                  </span>
                  {filter.type === "person" && (
                    <span>
                      with <span className="font-semibold text-gray-900">{filter.name}</span>
                    </span>
                  )}
                  {filter.type === "group" && (
                    <span>
                      in <span className="font-semibold text-gray-900">{filter.name}</span>
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-sm text-gray-500 transition-colors hover:text-gray-900"
                >
                  Clear
                </button>
              </div>
            )}

            {/* Loading state - skeleton loaders */}
            {loading && (
              <div className="space-y-6">
                <ThreadSkeleton />
                <div className="mx-auto h-px w-16 bg-foreground/[0.06]" />
                <ThreadSkeleton />
                <div className="mx-auto h-px w-16 bg-foreground/[0.06]" />
                <ThreadSkeleton />
              </div>
            )}

            {/* Error state (e.g. API unreachable) */}
            {!loading && searchError && (
              <div className="rounded-2xl border border-red-200 bg-red-50/90 px-4 py-4 text-sm text-red-800">
                <p className="font-medium">Request failed</p>
                <p className="mt-1 text-red-700">{searchError}</p>
                <button
                  type="button"
                  onClick={handleClear}
                  className="mt-3 text-sm font-medium text-red-600 hover:underline"
                >
                  Clear
                </button>
              </div>
            )}

            {/* Ask mode: answer + sources */}
            {!loading && askResult && (
              <div className="space-y-6 pb-6">
                <div className="overflow-hidden rounded-2xl bg-white/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.05] backdrop-blur-sm">
                  <div className="border-b border-black/[0.04] px-4 py-2.5">
                    <span className="text-sm font-semibold text-gray-900">Answer</span>
                  </div>
                  <div className="whitespace-pre-wrap px-4 py-4 text-[15px] leading-snug text-foreground">
                    {askResult.answer}
                  </div>
                </div>
                {askResult.sources.length > 0 && (
                  <>
                    <p className="text-xs font-medium text-muted-foreground">Based on conversations with:</p>
                    <ul className="space-y-1 text-sm text-foreground">
                      {askResult.sources.map((s) => (
                        <li key={s.chat_id} className="rounded-lg bg-white/60 px-3 py-2 ring-1 ring-black/[0.04]">
                          {s.title}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}

            {/* Exact mode: conversation threads */}
            {!loading && !askResult && results && (
              <>
                {results.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <div className="rounded-full bg-muted/50 p-4">
                      <svg className="h-8 w-8 text-muted-foreground/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8" />
                        <path d="m21 21-4.35-4.35" />
                      </svg>
                    </div>
                    <p className="mt-4 text-center text-sm font-medium text-foreground">No messages found</p>
                    <p className="mt-1 text-center text-sm text-muted-foreground">
                      {filter.type !== "all" 
                        ? `Try changing your contact filter or search query`
                        : `Try a different search query`}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6 pb-6">
                    {results.map((thread, i) => (
                      <React.Fragment key={thread.id}>
                        <ConversationThread thread={thread} />
                        {i < results.length - 1 && (
                          <div className="mx-auto h-px w-16 bg-foreground/[0.06]" />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Fixed bottom search bar */}
      <div className="relative border-t border-black/[0.04]">
        {/* AI glow behind everything - absolute positioned with lower z-index */}
        <div 
          className={`pointer-events-none absolute inset-x-0 -top-40 bottom-0 bg-gradient-to-t from-iosBlue/20 via-purple-500/10 to-transparent transition-opacity duration-300 ${
            mode === "ask" ? "opacity-100" : "opacity-0"
          }`}
          style={{ zIndex: 0 }}
        />
        
        {/* Content layer with backdrop blur - sits in front of glow */}
        <div className="relative bg-white/80 px-4 pb-6 pt-3 backdrop-blur-sm md:px-8" style={{ zIndex: 1 }}>
          <div className="mx-auto max-w-xl">
            {/* Filter + Mode row */}
            <div className="mb-2.5 flex items-center justify-between">
              <ContactSelector 
                filter={filter} 
                onFilterChange={setFilter}
                allContacts={searchData.allContacts}
                recentContacts={searchData.recentContacts}
              />
              <SearchModeToggle mode={mode} onModeChange={setMode} />
            </div>

            {/* Search bar */}
            <form onSubmit={handleSubmit} className="relative">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={placeholder}
                className="w-full rounded-full border border-border/60 bg-white py-3 pl-4 pr-12 text-sm text-foreground shadow-sm placeholder:text-muted-foreground/70 focus:border-iosBlue/40 focus:outline-none focus:ring-2 focus:ring-iosBlue/15"
              />
              <button
                type="submit"
                disabled={!input.trim()}
                className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-iosBlue text-white transition-opacity disabled:opacity-30"
                aria-label="Search"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="12" y1="19" x2="12" y2="5" />
                  <polyline points="5 12 12 5 19 12" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
