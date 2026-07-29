import { supabase } from "./supabaseClient";

export type ChatHistoryEntry = {
  id: string;
  feature: string;
  title: string;
  session_table: string;
  session_id: string;
  updated_at: string;
};

export async function recordChatHistory(params: {
  userId: string;
  feature: string;
  title: string;
  sessionTable: string;
  sessionId: string;
}) {
  try {
    await supabase.from("chat_history").upsert(
      {
        id: params.sessionId,
        user_id: params.userId,
        feature: params.feature,
        title: params.title,
        session_table: params.sessionTable,
        session_id: params.sessionId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
  } catch (err) {
    console.error("recordChatHistory failed:", err);
  }
}

export async function getChatHistory(
  userId: string,
  feature: string
): Promise<ChatHistoryEntry[]> {
  try {
    const { data, error } = await supabase
      .from("chat_history")
      .select("*")
      .eq("user_id", userId)
      .eq("feature", feature)
      .order("updated_at", { ascending: false });

    if (error) throw error;
    return (data as ChatHistoryEntry[]) ?? [];
  } catch (err) {
    console.error("getChatHistory failed:", err);
    return [];
  }
}

export async function loadSessionRow(
  table: string,
  sessionId: string
): Promise<any | null> {
  try {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("id", sessionId)
      .maybeSingle();
    if (error) throw error;
    return data;
  } catch (err) {
    console.error("loadSessionRow failed:", err);
    return null;
  }
}