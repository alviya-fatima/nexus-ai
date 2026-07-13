import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

export async function POST(req: Request) {
  try {
    const { message } = await req.json();

    const prompt = `
You are NEXUS AI.

You are an AI mentor.

You MUST reply ONLY with valid JSON.

Do NOT use markdown.

Do NOT use \`\`\`json.

Do NOT write explanations.

Return ONLY this structure:

{
  "goal": "string",
  "roadmap": [
    "string",
    "string",
    "string",
    "string",
    "string"
  ],
  "lesson": {
    "title": "string",
    "whatYouLearn": "string",
    "whyImportant": "string",
    "whatToDo": [
      "string",
      "string",
      "string"
    ],
    "miniTask": "string"
  }
}

Rules:

- goal = learning goal.
- roadmap = complete roadmap.
- lesson = ONLY Step 1.
- whatToDo must be an array.
- Never teach Step 2.
- Never return anything except JSON.

User request:

${message}
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

   const cleaned = (response.text ?? "")
  .replace(/```json/g, "")
  .replace(/```/g, "")
  .trim();

const parsed = JSON.parse(cleaned);

return Response.json(parsed);

  } catch (err) {
    console.error(err);

    return Response.json(
      {
        error: "Something went wrong."
      },
      {
        status: 500
      }
    );
  }
}