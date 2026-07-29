import Supermemory from "supermemory";

let client: Supermemory | null = null;

function getClient(): Supermemory {
  if (!client) {
    client = new Supermemory({ apiKey: process.env.SUPERMEMORY_API_KEY! });
  }
  return client;
}

export async function saveMemory(
  containerTag: string,
  content: string,
  metadata?: Record<string, string | number | boolean | string[]>
): Promise<void> {
  try {
    const sm = getClient();
    await sm.add({ content, containerTag, metadata });
  } catch (err) {
    console.error("Supermemory saveMemory failed:", err);
  }
}

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

export async function saveQuizToMemory(
  userId: string,
  profile: {
    display_name: string;
    age?: string;
    interests?: string;
    favorite_color?: string;
    tone: string;
    use_emojis: boolean;
  }
) {
  const facts = [
    `This person's name is ${profile.display_name}, always refer to them by this name.`,
    `They want NEXUS AI to talk to them in a "${profile.tone}" tone.`,
    profile.use_emojis
      ? "They like emojis in responses."
      : "They do NOT want emojis in responses.",
    profile.age ? `Their age: ${profile.age}.` : "",
    profile.interests ? `Their interests: ${profile.interests}.` : "",
    profile.favorite_color ? `Their favorite color: ${profile.favorite_color}.` : "",
  ].filter(Boolean);

  for (const fact of facts) {
    await saveMemory(userId, fact, { type: "onboarding_quiz" });
  }
}