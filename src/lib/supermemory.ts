import Supermemory from "supermemory";

// Server-only helper — never import this file from a "use client" component.
// It uses SUPERMEMORY_API_KEY (no NEXT_PUBLIC_ prefix) so the key stays
// on the server and is never sent to the browser.

let client: Supermemory | null = null;

function getClient(): Supermemory {
  if (!client) {
    client = new Supermemory({ apiKey: process.env.SUPERMEMORY_API_KEY! });
  }
  return client;
}

/**
 * Store a memory scoped to a specific user (containerTag).
 * Fire-and-forget: failures are logged but never break the main request.
 */
export async function saveMemory(
  containerTag: string,
  content: string,
  metadata?: Record<string, string | number | boolean | string[]>
): Promise<void> {
  try {
    const sm = getClient();
    await sm.add({
      content,
      containerTag,
      metadata,
    });
  } catch (err) {
    console.error("Supermemory saveMemory failed:", err);
  }
}

/**
 * Retrieve what Supermemory knows about a user, optionally scoped
 * to a query, so the AI can personalize its response.
 * Returns an empty array on any failure so callers can treat it
 * as "no extra context available" rather than crashing.
 */
export async function getUserProfileFacts(
  containerTag: string,
  query?: string
): Promise<string[]> {
  try {
    const sm = getClient();
    const result: any = await sm.profile({ containerTag, q: query });
    const staticFacts: string[] = result?.profile?.static ?? [];
    const dynamicFacts: string[] = result?.profile?.dynamic ?? [];
    return [...staticFacts, ...dynamicFacts];
  } catch (err) {
    console.error("Supermemory getUserProfileFacts failed:", err);
    return [];
  }
}