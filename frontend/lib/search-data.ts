import { format } from "date-fns"
import type { Thread, Contact, SearchData, ContactFilter, AskResult } from "@/components/search-interface"
import { getThreads, getMessages, askQuery, type ApiThread, type ApiMessage } from "./receipts-api"

function parseDate(s: string): Date {
  // SQLite datetime "2024-03-15 14:30:00" or ISO
  const normalized = s.replace(" ", "T")
  return new Date(normalized)
}

function formatMessageTime(sentAt: string): string {
  return format(parseDate(sentAt), "h:mm a")
}

function formatThreadDate(lastMessageAt: string): string {
  return format(parseDate(lastMessageAt), "MMMM d, yyyy")
}

function apiMessageToUiMessage(m: ApiMessage): { sender: string; text: string; time: string; isUser?: boolean } {
  return {
    sender: m.sender_name === "ME" ? "You" : m.sender_name,
    text: m.text,
    time: formatMessageTime(m.sent_at),
    isUser: m.sender_name === "ME",
  }
}

/**
 * Build Contact list from thread titles (no person/group from API; treat all as person for filter UX).
 */
function threadsToContacts(threads: ApiThread[]): Contact[] {
  return threads.map((t) => ({ name: t.title, type: "person" as const }))
}

/**
 * Real search: fetch threads, load messages for each, filter by query in message text, map to Thread[].
 */
async function searchMessages(
  query: string,
  _mode: "exact" | "ask",
  _filter: ContactFilter
): Promise<Thread[]> {
  const q = query.trim().toLowerCase()
  const threads = await getThreads(80)

  const results: Thread[] = []

  for (const thread of threads) {
    const messages = await getMessages(thread.chat_id, 100)
    // API returns newest first; we want chronological for display
    const chronological = [...messages].reverse()
    const matching = chronological.filter((m) => m.text && m.text.toLowerCase().includes(q))
    if (matching.length === 0) continue

    const uiMessages = chronological.map(apiMessageToUiMessage)
    results.push({
      id: String(thread.chat_id),
      date: formatThreadDate(thread.last_message_at),
      context: thread.title,
      messages: uiMessages,
    })
  }

  // Keep order by last_message_at (threads are already sorted by API)
  return results.slice(0, 20)
}

let cachedThreads: ApiThread[] | null = null

async function ensureThreads(): Promise<ApiThread[]> {
  if (cachedThreads) return cachedThreads
  cachedThreads = await getThreads(50)
  return cachedThreads
}

/**
 * SearchData backed by FastAPI: contacts from thread list, search runs against real messages.
 */
export async function getSearchData(): Promise<SearchData> {
  const threads = await ensureThreads()
  const allContacts = threadsToContacts(threads)
  const recentContacts = threadsToContacts(threads.slice(0, 8))

  async function onAsk(query: string, _filter: ContactFilter): Promise<AskResult> {
    return askQuery(query)
  }

  return {
    allContacts,
    recentContacts,
    onSearch: searchMessages,
    onAsk,
  }
}
