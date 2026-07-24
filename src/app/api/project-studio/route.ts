import { GoogleGenAI } from "@google/genai";
import { saveMemory, getUserProfileFacts } from "../../../lib/supermemory";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

function cleanJson(text: string) {
  return text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();
}

// Completely free, keyless fallback image source (community-run,
// no signup, no billing). Used only if Gemini's image model fails
// or the free-tier rate limit is hit.
async function generateWithPollinations(prompt: string): Promise<string | null> {
  try {
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(
      prompt
    )}?width=768&height=768&nologo=true`;

    const res = await fetch(url);
    if (!res.ok) return null;

    const arrayBuffer = await res.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    return `data:image/png;base64,${base64}`;
  } catch (err) {
    console.error("Pollinations fallback failed:", err);
    return null;
  }
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
    // Tries Gemini's free-tier image model first, then falls back
    // to a completely free, keyless image source if that fails
    // ---------------------------------------------------------
    if (mode === "generate_image") {
      const { prompt } = body as { prompt: string };

      let imageDataUrl: string | null = null;
      let source: "gemini" | "pollinations" = "gemini";

      try {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash-image",
          contents: prompt,
          config: {
            responseModalities: ["TEXT", "IMAGE"],
          },
        });

        const parts = response.candidates?.[0]?.content?.parts ?? [];

        for (const part of parts) {
          if (part.inlineData?.data) {
            const mimeType = part.inlineData.mimeType || "image/png";
            imageDataUrl = `data:${mimeType};base64,${part.inlineData.data}`;
            break;
          }
        }
      } catch (err) {
        console.error("Gemini image generation failed, falling back:", err);
      }

      if (!imageDataUrl) {
        imageDataUrl = await generateWithPollinations(prompt);
        source = "pollinations";
      }

      if (!imageDataUrl) {
        return Response.json(
          { error: "Couldn't generate an image for that concept — both image sources failed." },
          { status: 422 }
        );
      }

      return Response.json({ imageDataUrl, source });
    }

    // ---------------------------------------------------------
    // MODE 4: Suggest project/presentation ideas for a theme
    // ---------------------------------------------------------
    if (mode === "suggest_ideas") {
      const { theme, userId } = body as { theme: string; userId?: string };

      let memoryContext = "";
      if (userId) {
        const facts = await getUserProfileFacts(userId, theme);
        if (facts.length > 0) {
          memoryContext = `\n\nWhat you remember about this person from past sessions:\n${facts
            .map((f) => `- ${f}`)
            .join("\n")}`;
        }
      }

      const prompt = `
You are NEXUS AI, an expert project & presentation idea generator.

The person wants project/presentation ideas within this theme: "${theme}"
${memoryContext}

You MUST reply ONLY with valid JSON. No markdown. No \`\`\`json. No explanations.

Return ONLY this structure:

{
  "ideas": [
    { "title": "string", "description": "string" }
  ]
}

Rules:
- Generate exactly 6 genuinely distinct, creative project/presentation ideas that fit the theme.
- Vary the type of idea (some hands-on/build projects, some presentation/research-style, some experiment-based) so there's real variety to choose from.
- title: a short, catchy name for the idea (max ~8 words).
- description: 1-2 sentences explaining what it involves and why it's a good pick — specific enough that picking it gives real direction, not generic.
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
          `User browsed project ideas for the theme "${theme}".`,
          { type: "project_studio_ideas", theme }
        );
      }

      return Response.json(parsed);
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