"use client"

import React from "react"
import { useState, useRef, useEffect } from "react"
import { SearchModeToggle } from "./search-mode-toggle"
import { ContactSelector, type ContactFilter } from "./contact-selector"

type SearchMode = "exact" | "ask"

interface TextMessage {
  sender: string
  text: string
  time: string
  isUser?: boolean
}

interface Thread {
  id: string
  date: string
  context: string
  messages: TextMessage[]
}

const mockThreads: Thread[] = [
  {
    id: "t1",
    date: "Jun 10, 2025 - 3:42 PM",
    context: "Beach Week Planning",
    messages: [
      { sender: "Alex", text: "yo are we actually doing beach week this year or what", time: "3:42 PM" },
      { sender: "You", text: "im so down, when were we thinking?", time: "3:43 PM", isUser: true },
      { sender: "Jordan", text: "i can do june 18-22", time: "3:45 PM" },
      { sender: "Sam", text: "same, i found a sick airbnb in OBX for like $200/night split", time: "3:47 PM" },
      { sender: "You", text: "bet, send the link", time: "3:48 PM", isUser: true },
    ],
  },
  {
    id: "t2",
    date: "Jun 13, 2025 - 7:15 PM",
    context: "Beach Week Planning",
    messages: [
      { sender: "Sam", text: "ok i just booked the airbnb, everyone venmo me $50 deposit", time: "7:15 PM" },
      { sender: "Alex", text: "done. who's driving?", time: "7:18 PM" },
      { sender: "Jordan", text: "i can drive, my car fits 4 + luggage", time: "7:20 PM" },
      { sender: "You", text: "i'll bring the speaker and the cooler", time: "7:22 PM", isUser: true },
      { sender: "Riley", text: "what should i bring??", time: "7:25 PM" },
      { sender: "You", text: "snacks and good vibes lol", time: "7:26 PM", isUser: true },
    ],
  },
  {
    id: "t3",
    date: "Jun 17, 2025 - 11:30 AM",
    context: "Alex",
    messages: [
      { sender: "Alex", text: "bro are you packed for beach week yet", time: "11:30 AM" },
      { sender: "You", text: "literally haven't started. leaving tomorrow lmao", time: "11:32 AM", isUser: true },
      { sender: "Alex", text: "classic. don't forget sunscreen this time", time: "11:33 AM" },
    ],
  },
]

const exactThreads: Thread[] = [
  {
    id: "e1",
    date: "Jun 10, 2025 - 3:42 PM",
    context: "Beach Week Planning",
    messages: [
      { sender: "Alex", text: "yo are we actually doing beach week this year or what", time: "3:42 PM" },
      { sender: "You", text: "im so down, when were we thinking?", time: "3:43 PM", isUser: true },
    ],
  },
  {
    id: "e2",
    date: "Jun 13, 2025 - 7:15 PM",
    context: "Beach Week Planning",
    messages: [
      { sender: "Sam", text: "ok i just booked the airbnb for beach week, everyone venmo me $50", time: "7:15 PM" },
    ],
  },
  {
    id: "e3",
    date: "Jun 17, 2025 - 11:30 AM",
    context: "Alex",
    messages: [
      { sender: "Alex", text: "bro are you packed for beach week yet", time: "11:30 AM" },
      { sender: "You", text: "literally haven't started. leaving tomorrow lmao", time: "11:32 AM", isUser: true },
    ],
  },
]

/* ── iMessage-style bubble for a single message ── */
function MessageBubble({ msg, showSender }: { msg: TextMessage; showSender: boolean }) {
  if (msg.isUser) {
    return (
      <div className="flex flex-col items-end">
        <div className="max-w-[75%] rounded-2xl rounded-br-md bg-[#007AFF] px-3.5 py-2">
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
          className="flex w-full items-center justify-center gap-1 border-t border-black/[0.04] py-2.5 text-[12px] font-medium text-[#007AFF] transition-colors hover:bg-black/[0.01]"
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
export function SearchInterface() {
  const [results, setResults] = useState<Thread[] | null>(null)
  const [input, setInput] = useState("")
  const [mode, setMode] = useState<SearchMode>("ask")
  const [filter, setFilter] = useState<ContactFilter>({ type: "all" })
  const [loading, setLoading] = useState(false)
  const [searchedQuery, setSearchedQuery] = useState("")
  const [unfilteredResults, setUnfilteredResults] = useState<Thread[] | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim()) return

    setSearchedQuery(input.trim())
    setInput("")
    setLoading(true)

    setTimeout(() => {
      const baseResults = mode === "ask" ? mockThreads : exactThreads
      setUnfilteredResults(baseResults)
      const filteredResults = filterThreadsByContact(baseResults)
      setResults(filteredResults)
      setLoading(false)
    }, 800)
  }

  function handleClear() {
    setResults(null)
    setUnfilteredResults(null)
    setSearchedQuery("")
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
      ? 'Search keywords like "beach", "dinner plans"...'
      : 'Ask anything like "when did we plan beach week?"'

  const hasResults = results !== null

  return (
    <div className="flex h-full flex-col">
      {/* Top area: empty state or results */}
      <div className="flex-1 overflow-y-auto">
        {!hasResults && !loading ? (
          <div className="flex h-full flex-col items-center justify-center px-4 pb-24">
            <h2 className="text-balance text-center font-serif text-4xl italic text-foreground md:text-5xl">
              What are you looking for?
            </h2>
            <p className="mt-1 text-center text-muted-foreground">
              Search your messages or ask about your conversations.
            </p>
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

            {/* Loading state */}
            {loading && (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#007AFF] border-t-transparent" />
                <p className="mt-3 text-sm text-muted-foreground">Searching your messages...</p>
              </div>
            )}

            {/* Conversation threads */}
            {!loading && results && (
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
          className={`pointer-events-none absolute inset-0 bg-gradient-to-r blur-2xl from-blue-500/40 to-purple-500/40 transition-opacity duration-500 ${
            mode === "ask" ? "opacity-100" : "opacity-0"
          }`}
          style={{ zIndex: 0 }}
        />
        
        {/* Content layer with backdrop blur - sits in front of glow */}
        <div className="relative bg-white/75 px-4 pb-6 pt-4 backdrop-blur-xl md:px-8" style={{ zIndex: 1 }}>
          <div className="mx-auto max-w-xl">
            {/* Filter + Mode row */}
            <div className="mb-2.5 flex items-center justify-between">
              <ContactSelector filter={filter} onFilterChange={setFilter} />
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
                className="w-full rounded-full border border-border/60 bg-white py-3 pl-4 pr-12 text-sm text-foreground shadow-sm placeholder:text-muted-foreground/70 focus:border-[#007AFF]/40 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/15"
              />
              <button
                type="submit"
                disabled={!input.trim()}
                className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-[#007AFF] text-white transition-opacity disabled:opacity-30"
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
