import type { Thread, Contact, SearchData, ContactFilter } from "@/components/search-interface"

// Mock contacts data
export const mockAllContacts: Contact[] = [
  { name: "Alex", type: "person" },
  { name: "Jordan", type: "person" },
  { name: "Sam", type: "person" },
  { name: "Riley", type: "person" },
  { name: "Taylor", type: "person" },
  { name: "Morgan", type: "person" },
  { name: "Casey", type: "person" },
  { name: "Avery", type: "person" },
  { name: "Drew", type: "person" },
  { name: "Blake", type: "person" },
  { name: "Beach Week Planning", type: "group" },
  { name: "Family", type: "group" },
  { name: "Work Team", type: "group" },
  { name: "College Friends", type: "group" },
  { name: "Roommates", type: "group" },
  { name: "Soccer Squad", type: "group" },
  { name: "Dinner Club", type: "group" },
  { name: "Study Group", type: "group" },
]

export const mockRecentContacts: Contact[] = [
  { name: "Alex", type: "person" },
  { name: "Jordan", type: "person" },
  { name: "Sam", type: "person" },
  { name: "Beach Week Planning", type: "group" },
  { name: "Family", type: "group" },
]

// Mock thread data for "Ask" mode
const mockAskThreads: Thread[] = [
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

// Mock thread data for "Exact" mode
const mockExactThreads: Thread[] = [
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

// Mock search function that simulates backend call
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

// Export the search data object
export const mockSearchData: SearchData = {
  allContacts: mockAllContacts,
  recentContacts: mockRecentContacts,
  onSearch: mockSearch,
}
