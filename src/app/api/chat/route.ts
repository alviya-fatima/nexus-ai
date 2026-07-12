import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

export async function POST(req: Request) {
  const { message } = await req.json();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const response = await ai.models.generateContentStream({
          model: "gemini-2.5-flash",
          contents: `
You are NEXUS AI.

You are an expert AI mentor.

Always teach step by step.

Be encouraging.

User:
${message}
`,
        });

        for await (const chunk of response) {
          controller.enqueue(
            new TextEncoder().encode(chunk.text ?? "")
          );
        }

        controller.close();
      } catch (err) {
        console.error(err);
        controller.error(err);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}