"use client";

export type MemoryCitation = {
  id: string;
  snippet: string;
  score: number;
  source_title?: string | null;
  source_url?: string | null;
};

export type SearchMemoryEntry = {
  id: string;
  title: string;
  question: string;
  answer: string;
  citations: MemoryCitation[];
  createdAt: string;
};

export type KnowledgeEntry = SearchMemoryEntry;

const SEARCH_KEY = "rag_search_memory_v1";
const KNOWLEDGE_KEY = "rag_knowledge_memory_v1";

function safeParse<T>(value: string | null): T[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch (_error) {
    return [];
  }
}

function safeStorage() {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

export function listSearchMemory() {
  const storage = safeStorage();
  if (!storage) return [];
  return safeParse<SearchMemoryEntry>(storage.getItem(SEARCH_KEY));
}

export function listKnowledge() {
  const storage = safeStorage();
  if (!storage) return [];
  return safeParse<KnowledgeEntry>(storage.getItem(KNOWLEDGE_KEY));
}

export function upsertSearchMemory(entry: SearchMemoryEntry) {
  const storage = safeStorage();
  if (!storage) return;
  const entries = listSearchMemory().filter((item) => item.id !== entry.id);
  entries.unshift(entry);
  storage.setItem(SEARCH_KEY, JSON.stringify(entries.slice(0, 40)));
}

export function renameSearchMemory(id: string, title: string) {
  const storage = safeStorage();
  if (!storage) return;
  const entries = listSearchMemory().map((item) => (item.id === id ? { ...item, title } : item));
  storage.setItem(SEARCH_KEY, JSON.stringify(entries));
}

export function saveKnowledge(entry: KnowledgeEntry) {
  const storage = safeStorage();
  if (!storage) return;
  const entries = listKnowledge().filter((item) => item.id !== entry.id);
  entries.unshift(entry);
  storage.setItem(KNOWLEDGE_KEY, JSON.stringify(entries.slice(0, 80)));
}

export function renameKnowledge(id: string, title: string) {
  const storage = safeStorage();
  if (!storage) return;
  const entries = listKnowledge().map((item) => (item.id === id ? { ...item, title } : item));
  storage.setItem(KNOWLEDGE_KEY, JSON.stringify(entries));
}
