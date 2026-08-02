import { supabase } from "./supabaseClient";

export type ChatEntry = {
  id: string;
  user_id: string;
  feature: string;
  title: string;
  description: string;
  route: string;
  updated_at: string;
};

export async function upsertChat(params: {
  id: string;
  userId: string;
  feature: string;
  title: string;
  description?: string;
  route: string;
}) {
  try {
    const { error } = await supabase.from("chats").upsert(
      {
        id: params.id,
        user_id: params.userId,
        feature: params.feature,
        title: params.title,
        description: params.description ?? "",
        route: params.route,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    if (error) {
      console.error("upsertChat failed:", error.message, error.details, error.hint);
    }
  } catch (err) {
    console.error("upsertChat failed:", err);
  }
}

export async function fetchChats(userId: string): Promise<ChatEntry[]> {
  try {
    const { data, error } = await supabase
      .from("chats")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("fetchChats failed:", error.message, error.details, error.hint);
      return [];
    }

    return (data as ChatEntry[]) ?? [];
  } catch (err) {
    console.error("fetchChats failed:", err);
    return [];
  }
}

export async function generateChatMeta(
  firstPrompt: string
): Promise<{ title: string; description: string }> {
  try {
    const res = await fetch("/api/generate-chat-meta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstPrompt }),
    });
    return await res.json();
  } catch (err) {
    console.error("generateChatMeta failed:", err);
    return { title: "New Chat", description: "" };
  }
}
export async function loadSessionRow(table: string, id: string): Promise<any | null> {
  try {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("loadSessionRow failed:", error.message, error.details, error.hint);
      return null;
    }
    return data;
  } catch (err) {
    console.error("loadSessionRow failed:", err);
    return null;
  }
}