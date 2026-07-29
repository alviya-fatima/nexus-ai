import { supabase } from "./supabaseClient";

export type UserProfile = {
  user_id: string;
  display_name: string;
  age: string;
  interests: string;
  favorite_color: string;
  tone: "gen_z" | "expository" | "normal" | "coaching";
  use_emojis: boolean;
  onboarded: boolean;
};

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("getUserProfile failed:", error);
    return null;
  }

  return data as UserProfile | null;
}

export async function saveUserProfile(profile: Partial<UserProfile> & { user_id: string }) {
  const { error } = await supabase
    .from("user_profiles")
    .upsert({ ...profile, updated_at: new Date().toISOString() }, { onConflict: "user_id" });

  if (error) {
    console.error("saveUserProfile failed:", error);
  }
}

export async function markOnboardingSeen(userId: string) {
  await saveUserProfile({
    user_id: userId,
    display_name: "there",
    age: "",
    interests: "",
    favorite_color: "",
    tone: "normal",
    use_emojis: true,
    onboarded: true,
  });
}

const toneInstructions: Record<UserProfile["tone"], string> = {
  gen_z:
    "Talk in a casual Gen Z tone — relaxed slang, upbeat energy, short punchy sentences. Don't overdo it or sound forced.",
  expository:
    "Talk in a clear, explanatory, slightly formal tone — like a well-organized teacher walking through ideas step by step.",
  normal: "Talk in a normal, friendly, conversational tone.",
  coaching:
    "Talk like a supportive, motivating coach — encouraging, direct, focused on helping the person take action and improve.",
};

export function buildPersonalizationPrompt(profile: UserProfile | null): string {
  if (!profile || !profile.onboarded) return "";

  const parts: string[] = [];
  parts.push(`Always refer to the person as "${profile.display_name}".`);
  parts.push(toneInstructions[profile.tone] ?? toneInstructions.normal);
  parts.push(
    profile.use_emojis
      ? "Feel free to use light, tasteful emojis."
      : "Do NOT use any emojis at all."
  );
  if (profile.age) parts.push(`Their age: ${profile.age}.`);
  if (profile.interests) parts.push(`Their interests: ${profile.interests}.`);
  if (profile.favorite_color) parts.push(`Their favorite color: ${profile.favorite_color}.`);

  return `\n\nPersonalization instructions for how you talk to this person:\n${parts.join("\n")}\n`;
}