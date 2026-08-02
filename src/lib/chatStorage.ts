export type ChatMessage = {
  role: "assistant" | "user";
  text: string;
};

export type ChatRoadmap = {
  goal: string;
  steps: string[];
};

export type ChatSession = {
  id: string;
  title: string;
  titleIsAuto: boolean; // false until we've auto-named it from the first prompt
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
  messages: ChatMessage[];
  roadmap: ChatRoadmap | null;
};

const DEFAULT_TITLE = "New Chat";

function storageKey(uid: string) {
  return `nexus-chats-${uid}`;
}

function readAll(uid: string): ChatSession[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(storageKey(uid));
    if (!raw) return [];
    return JSON.parse(raw) as ChatSession[];
  } catch (error) {
    console.error("Failed to read chats from storage", error);
    return [];
  }
}

function writeAll(uid: string, chats: ChatSession[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(storageKey(uid), JSON.stringify(chats));
  } catch (error) {
    console.error("Failed to save chats to storage", error);
  }
}

export function getChats(uid: string): ChatSession[] {
  return readAll(uid).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export function getChat(uid: string, chatId: string): ChatSession | null {
  return readAll(uid).find((chat) => chat.id === chatId) ?? null;
}

export function createChat(uid: string): ChatSession {
  const now = new Date().toISOString();

  const chat: ChatSession = {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `chat-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title: DEFAULT_TITLE,
    titleIsAuto: false,
    createdAt: now,
    updatedAt: now,
    messages: [
      {
        role: "assistant",
        text: "What kind of skill are you trying to learn or master today?",
      },
    ],
    roadmap: null,
  };

  const chats = readAll(uid);
  chats.push(chat);
  writeAll(uid, chats);

  return chat;
}

export function saveChat(uid: string, chat: ChatSession) {
  const chats = readAll(uid);
  const index = chats.findIndex((c) => c.id === chat.id);

  const updated: ChatSession = { ...chat, updatedAt: new Date().toISOString() };

  if (index === -1) {
    chats.push(updated);
  } else {
    chats[index] = updated;
  }

  writeAll(uid, chats);
}

export function deleteChat(uid: string, chatId: string) {
  const chats = readAll(uid).filter((chat) => chat.id !== chatId);
  writeAll(uid, chats);
}

// Turns a raw prompt/goal into a short, presentable chat title.
export function makeTitleFromText(text: string): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return DEFAULT_TITLE;

  const maxLength = 40;
  if (cleaned.length <= maxLength) return cleaned;

  return `${cleaned.slice(0, maxLength).trim()}…`;
}

export function isChatFromToday(chat: ChatSession): boolean {
  const created = new Date(chat.createdAt);
  const now = new Date();

  return (
    created.getFullYear() === now.getFullYear() &&
    created.getMonth() === now.getMonth() &&
    created.getDate() === now.getDate()
  );
}