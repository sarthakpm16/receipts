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
 * Real search: uses the /search endpoint to get context windows around keyword matches.
 */
async function searchMessages(
  query: string,
  mode: "exact" | "ask",
  filter: ContactFilter
): Promise<Thread[]> {
  if (mode === "ask") {
    // For ask mode, also use limited context
    // TODO: Implement proper semantic ask endpoint
    const q = query.trim().toLowerCase()
    const threads = await getThreads(50)
    const results: Thread[] = []

    // Filter threads first if needed
    const threadsToSearch = filter.type === "all" 
      ? threads 
      : threads.filter(t => t.title === filter.name)

    for (const thread of threadsToSearch) {
      const messages = await getMessages(thread.chat_id, 50)
      const chronological = [...messages].reverse()
      const matchIndex = chronological.findIndex((m) => m.text && m.text.toLowerCase().includes(q))
      if (matchIndex === -1) continue

      // Only include context window around the match (2 before, match, 2 after)
      const start = Math.max(0, matchIndex - 2)
      const end = Math.min(chronological.length, matchIndex + 3)
      const contextWindow = chronological.slice(start, end)
      
      const uiMessages = contextWindow.map((msg, idx) => ({
        ...apiMessageToUiMessage(msg),
        isMatch: start + idx === matchIndex
      }))
      
      results.push({
        id: String(thread.chat_id),
        date: formatThreadDate(thread.last_message_at),
        context: thread.title,
        messages: uiMessages,
        matchIndex: matchIndex - start,
        hasMoreBefore: start > 0,
        hasMoreAfter: end < chronological.length,
        chatId: thread.chat_id
      })
    }

    return results.slice(0, 20)
  }

  // For exact mode, use the new /search endpoint with context_size=2
  // Pass the filter to the backend for efficient SQL filtering
  let url = `http://localhost:8000/search?query=${encodeURIComponent(query)}&context_size=2`
  if (filter.type !== "all" && filter.name) {
    url += `&title=${encodeURIComponent(filter.name)}`
  }
  
  const response = await fetch(url)
  
  if (!response.ok) {
    throw new Error(`Search failed: ${response.statusText}`)
  }
  
  const data = await response.json()
  
  // Transform backend response to Thread format
  const threads: Thread[] = data.results.map((result: any) => {
    // Format messages
    const messages = result.messages.map((msg: any, idx: number) => ({
      sender: msg.sender_name === "ME" ? "You" : msg.sender_name,
      text: msg.text,
      time: formatMessageTime(msg.sent_at),
      isUser: msg.sender_name === "ME",
      isMatch: msg.is_match // Add flag to highlight the matching message
    }))
    
    // Extract date from the first message
    const firstMsg = result.messages[0]
    const date = formatThreadDate(firstMsg.sent_at)
    
    return {
      id: `${result.chat_id}-${result.match_message_id}`,
      date,
      context: result.title,
      messages,
      matchIndex: result.match_index,
      hasMoreBefore: result.has_more_before,
      hasMoreAfter: result.has_more_after,
      chatId: result.chat_id,
      matchMessageId: result.match_message_id
    }
  })
  
  return threads
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
