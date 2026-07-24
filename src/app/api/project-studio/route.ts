import { GoogleGenAI } from "@google/genai";
import { saveMemory, getUserProfileFacts } from "@/lib/supermemory";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

function cleanJson(text: string) {
  return text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const mode = body.mode ?? "start";

    // ---------------------------------------------------------
    // MODE 1: Generate the full project/presentation plan
    // ---------------------------------------------------------
    if (mode === "start") {
      const { brief, requirements, userId } = body as {
        brief: string;
        requirements: string;
        userId?: string;
      };

      let memoryContext = "";
      if (userId) {
        const facts = await getUserProfileFacts(userId, brief);
        if (facts.length > 0) {
          memoryContext = `\n\nWhat you remember about this person from past sessions:\n${facts
            .map((f) => `- ${f}`)
            .join("\n")}`;
        }
      }

      const prompt = `
You are NEXUS AI, an expert project & presentation planner who helps people build projects and presentations on tight budgets and tight timelines.

What the person wants to make:
${brief}

Requirements it has to match (deadline, rubric, constraints, budget, materials on hand, etc.):
${requirements}
${memoryContext}

You MUST reply ONLY with valid JSON. No markdown. No \`\`\`json. No explanations.

Return ONLY this structure:

{
  "title": "string",
  "summary": "string",
  "budgetOptions": [
    { "item": "string", "cheapOption": "string", "estimatedCost": "string", "whereToBuy": "string" }
  ],
  "stepByStep": ["string", "string", "..."],
  "researchSources": [
    { "name": "string", "url": "string", "whatYoullFind": "string" }
  ],
  "researchSummary": "string",
  "designIdeas": ["string", "string", "string"]
}

Rules:
- title: short, clear name for the project/presentation.
- summary: 3-4 sentences summarizing the whole plan and how it meets the stated requirements.
- budgetOptions: 4-8 real, concrete materials/tools needed, each with the CHEAPEST realistic option (generic/budget-brand or free alternative), a rough estimated cost, and a realistic place to buy it (a real retailer or online store name).
- stepByStep: 6-12 detailed, concrete build/prep steps in order. Each item should be 1-3 full sentences, specific enough to actually follow — no vague filler.
- researchSources: 3-5 real, well-known, genuinely relevant websites (use real domains like wikipedia.org, khanacademy.org, nasa.gov, specific well-known sites relevant to the topic) with a short note on what the person will find there.
- researchSummary: 4-6 sentences of genuinely useful synthesized information on the topic itself, written so the person could use it directly in their presentation/project if they're short on time.
- designIdeas: exactly 3 distinct visual design concepts (poster layout, diagram, model appearance, slide design, etc.) described as a single vivid, detailed image-generation prompt each — these will be used to generate real images, so make each one specific and visual (colors, layout, subject, style).
- Never return anything except the JSON object.
`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      const parsed = JSON.parse(cleanJson(response.text ?? ""));

      if (userId) {
        void saveMemory(
          userId,
          `User is working on a project/presentation: "${brief}". Requirements: "${requirements}". Plan title: "${parsed.title}".`,
          { type: "project_studio_started" }
        );
      }

      return Response.json(parsed);
    }

    // ---------------------------------------------------------
    // MODE 2: Answer a question about the current plan
    // ---------------------------------------------------------
    if (mode === "question") {
      const { title, question, userId } = body as {
        title: string;
        question: string;
        userId?: string;
      };

      const prompt = `
You are NEXUS AI, a project & presentation planning assistant.

You MUST reply ONLY with valid JSON. No markdown. No \`\`\`json. No explanations.

Return ONLY this structure:

{
  "reply": "string"
}

Rules:
- The person is currently working on: "${title}"
- Answer ONLY their question below, in the context of this project/presentation.
- Keep the reply focused, practical, and friendly, with a light touch of emojis (1-2 max).

Question: ${question}
`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      const parsed = JSON.parse(cleanJson(response.text ?? ""));

      if (userId) {
        void saveMemory(userId, `Q: ${question}\nA: ${parsed.reply}`, {
          type: "project_studio_qa",
          title,
        });
      }

      return Response.json(parsed);
    }

    // ---------------------------------------------------------
    // MODE 3: Generate an actual design image from a prompt
    // ---------------------------------------------------------
    if (mode === "generate_image") {
      const { prompt } = body as { prompt: string };

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: prompt,
        config: {
          responseModalities: ["TEXT", "IMAGE"],
        },
      });

      const parts = response.candidates?.[0]?.content?.parts ?? [];
      let imageDataUrl: string | null = null;

      for (const part of parts) {
        if (part.inlineData?.data) {
          const mimeType = part.inlineData.mimeType || "image/png";
          imageDataUrl = `data:${mimeType};base64,${part.inlineData.data}`;
          break;
        }
      }

      if (!imageDataUrl) {
        return Response.json(
          { error: "Couldn't generate an image for that concept." },
          { status: 422 }
        );
      }

      return Response.json({ imageDataUrl });
    }

    return Response.json({ error: "Unknown mode." }, { status: 400 });
  } catch (err) {
    console.error(err);

    return Response.json(
      {
        error: "Something went wrong.",
      },
      {
        status: 500,
      }
    );
  }
}