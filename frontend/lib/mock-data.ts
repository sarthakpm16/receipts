import type { Thread, Contact, SearchData, ContactFilter } from "@/components/search-interface"

// Mock contacts data
export const mockAllContacts: Contact[] = [
  { name: "Alex", type: "person" },
  { name: "Jordan", type: "person" },
  { name: "Taylor", type: "person" },
  { name: "Morgan", type: "person" },
  { name: "Casey", type: "person" },
  { name: "Riley", type: "person" },
  { name: "Beach Week Crew", type: "group" },
  { name: "Work Team", type: "group" },
  { name: "Family", type: "group" },
  { name: "College Friends", type: "group" },
]

export const mockRecentContacts: Contact[] = [
  { name: "Alex", type: "person" },
  { name: "Jordan", type: "person" },
  { name: "Beach Week Crew", type: "group" },
  { name: "Work Team", type: "group" },
]

// Mock threads for "exact" search mode
export const mockExactThreads: Thread[] = [
  {
    id: "1",
    date: "March 15, 2024",
    context: "Beach Week Crew",
    messages: [
      { sender: "Alex", text: "yo who's bringing the speaker", time: "2:45 PM" },
      { sender: "Jordan", text: "I got it", time: "2:47 PM" },
      { sender: "You", text: "perfect. don't forget the aux cord this time lol", time: "2:48 PM", isUser: true },
    ],
  },
  {
    id: "2",
    date: "March 14, 2024",
    context: "Alex",
    messages: [
      { sender: "Alex", text: "dude I just found out the house has a pool table", time: "11:20 AM" },
      { sender: "You", text: "no way that's sick", time: "11:22 AM", isUser: true },
      { sender: "Alex", text: "yeah I'm hyped. you better be ready to lose", time: "11:23 AM" },
      { sender: "You", text: "lmao we'll see about that", time: "11:25 AM", isUser: true },
    ],
  },
  {
    id: "3",
    date: "March 13, 2024",
    context: "Taylor",
    messages: [
      { sender: "Taylor", text: "what time are we leaving Friday?", time: "4:30 PM" },
      { sender: "You", text: "probably around 10am if that works", time: "4:35 PM", isUser: true },
      { sender: "Taylor", text: "sounds good I'll be ready", time: "4:36 PM" },
    ],
  },
]

// Mock threads for "ask" search mode
export const mockAskThreads: Thread[] = [
  {
    id: "4",
    date: "March 12, 2024",
    context: "Jordan",
    messages: [
      { sender: "Jordan", text: "hey did you get the groceries for the trip?", time: "7:15 PM" },
      { sender: "You", text: "yeah I got chips, drinks, and stuff for breakfast", time: "7:20 PM", isUser: true },
      { sender: "Jordan", text: "awesome thanks", time: "7:21 PM" },
    ],
  },
  {
    id: "5",
    date: "March 10, 2024",
    context: "Beach Week Crew",
    messages: [
      { sender: "Morgan", text: "so the house address is 123 Ocean Drive right?", time: "3:00 PM" },
      { sender: "Casey", text: "yeah that's it", time: "3:02 PM" },
      { sender: "You", text: "I'll put it in my GPS", time: "3:05 PM", isUser: true },
    ],
  },
  {
    id: "6",
    date: "March 8, 2024",
    context: "Alex",
    messages: [
      { sender: "Alex", text: "bro are you packed for beach week yet", time: "11:30 AM" },
      { sender: "You", text: "literally haven't started. leaving tomorrow lmao", time: "11:32 AM", isUser: true },
    ],
  },
]

// Real search function that calls the backend
export async function realSearch(
  query: string,
  mode: "exact" | "ask",
  filter: ContactFilter
): Promise<Thread[]> {
  const API_BASE = "http://localhost:8000"
  
  if (mode === "exact") {
    // Call the /search endpoint
    const response = await fetch(`${API_BASE}/search?query=${encodeURIComponent(query)}&context_size=5`)
    if (!response.ok) {
      throw new Error(`Search failed: ${response.statusText}`)
    }
    
    const data = await response.json()
    
    // Transform backend response to Thread format
    const threads: Thread[] = data.results.map((result: any) => {
      // Format messages
      const messages: TextMessage[] = result.messages.map((msg: any) => ({
        sender: msg.sender_name === "ME" ? "You" : msg.sender_name,
        text: msg.text,
        time: new Date(msg.sent_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        isUser: msg.sender_name === "ME",
        isMatch: msg.is_match // Add flag to highlight the matching message
      }))
      
      // Extract date from the match message
      const matchMsg = result.messages[result.match_index]
      const date = new Date(matchMsg.sent_at).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })
      
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
  } else {
    // For "ask" mode, use the /ask endpoint (existing implementation)
    // For now, return mock data
    await new Promise((resolve) => setTimeout(resolve, 2500))
    return mockAskThreads
  }
}

// Mock search function for development
export async function mockSearch(
  query: string,
  mode: "exact" | "ask",
  filter: ContactFilter
): Promise<Thread[]> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 2500))
  
  // Return appropriate threads based on mode
  return mode === "ask" ? mockAskThreads : mockExactThreads
}

// Export the search data object (using real search)
export const searchData: SearchData = {
  allContacts: mockAllContacts,
  recentContacts: mockRecentContacts,
  onSearch: realSearch,
}

// Export mock version for testing
export const mockSearchData: SearchData = {
  allContacts: mockAllContacts,
  recentContacts: mockRecentContacts,
  onSearch: mockSearch,
}
