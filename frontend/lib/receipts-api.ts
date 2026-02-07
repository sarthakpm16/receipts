/**
 * Client for the FastAPI receipts backend (threads + messages from data/processed.db).
 */

const API_BASE =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000")
    : process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface ApiThread {
  chat_id: number;
  title: string;
  last_message_at: string;
}

export interface ApiMessage {
  sent_at: string;
  sender_name: string;
  text: string;
}

export interface ThreadsResponse {
  threads: ApiThread[];
}

export interface MessagesResponse {
  chat_id: number;
  messages: ApiMessage[];
}

export async function getThreads(limit = 50): Promise<ApiThread[]> {
  const res = await fetch(`${API_BASE}/threads?limit=${limit}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(typeof err.detail === "string" ? err.detail : "Failed to fetch threads");
  }
  const data: ThreadsResponse = await res.json();
  return data.threads;
}

export async function getMessages(chatId: number, limit = 100): Promise<ApiMessage[]> {
  const res = await fetch(`${API_BASE}/threads/${chatId}/messages?limit=${limit}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(typeof err.detail === "string" ? err.detail : "Failed to fetch messages");
  }
  const data: MessagesResponse = await res.json();
  return data.messages;
}

export interface AskSource {
  chat_id: number;
  title: string;
}

export interface AskResponse {
  answer: string;
  sources: AskSource[];
}

export async function askQuery(query: string, threadIds?: number[]): Promise<AskResponse> {
  try {
    const res = await fetch(`${API_BASE}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: query.trim(), thread_ids: threadIds ?? null }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(typeof err.detail === "string" ? err.detail : "Ask failed");
    }
    return res.json();
  } catch (e) {
    const isNetworkError =
      e instanceof TypeError ||
      (e instanceof Error && (e.message === "Failed to fetch" || /fetch|network/i.test(e.message)));
    if (isNetworkError) {
      throw new Error(
        `Could not reach the API at ${API_BASE}. Make sure the backend is running: uvicorn app.main:app --reload`
      );
    }
    throw e;
  }
}
