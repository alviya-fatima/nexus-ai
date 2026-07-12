import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

export async function POST(req: Request) {
  try {
    const { message } = await req.json();

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `
You are NEXUS AI.

You are an expert AI mentor.

Help users learn skills step by step.

Always explain clearly.

Always motivate them.

User:
${message}
`,
    });

    return Response.json({
      reply: response.text,
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      {
        reply: "Something went wrong.",
      },
      {
        status: 500,
      }
    );
  }
}