import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

function cleanJson(text: string) {
  return text.replace(/```json/g, "").replace(/```/g, "").trim();
}

export async function POST(req: Request) {
  try {
    const { firstPrompt } = await req.json();

    const prompt = `
Generate a short chat title and one-line description for this conversation, based on what the person first asked — like how ChatGPT auto-titles a new chat.

You MUST reply ONLY with valid JSON. No markdown. No explanations.

Return ONLY:
{
  "title": "string",
  "description": "string"
}

Rules:
- title: max 6 words, properly worded, like a real chat app auto-title.
- description: one short sentence (max 15 words) summarizing what this chat is about.
- Never return anything except the JSON object.

First message: ${firstPrompt}
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const parsed = JSON.parse(cleanJson(response.text ?? ""));
    return Response.json(parsed);
  } catch (err) {
    console.error(err);
    return Response.json({ title: "New Chat", description: "" }, { status: 200 });
  }
}