import { GoogleGenAI } from "@google/genai";

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
    const mode = body.mode ?? "roadmap";

    // ---------------------------------------------------------
    // MODE 1: Generate the full roadmap + Step 1 lesson
    // ---------------------------------------------------------
    if (mode === "roadmap") {
      const { message } = body;

      const prompt = `
You are NEXUS AI, an AI mentor that builds step-by-step learning roadmaps.

You MUST reply ONLY with valid JSON. No markdown. No \`\`\`json. No explanations.

Return ONLY this structure:

{
  "goal": "string",
  "roadmap": ["string", "string", "string", "string", "string"],
  "lesson": {
    "title": "string",
    "whatYouLearn": "string",
    "whyImportant": "string",
    "whatToDo": ["string", "string", "string"],
    "miniTask": "string"
  }
}

Rules:
- goal = the learning goal, phrased clearly.
- roadmap = the complete list of steps (5-8 short titles), in order.
- lesson = the FULL lesson content for roadmap step 1 ONLY.
- whatToDo must be an array of concrete, actionable instructions (include real links/commands where useful, e.g. actual download URLs).
- Never teach step 2 or later.
- Never return anything except the JSON object.

User request: ${message}
`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      const parsed = JSON.parse(cleanJson(response.text ?? ""));
      return Response.json(parsed);
    }

    // ---------------------------------------------------------
    // MODE 2: Generate the lesson for a specific roadmap step
    // ---------------------------------------------------------
    if (mode === "lesson") {
      const { goal, roadmap, stepIndex } = body;
      const stepTitle = roadmap[stepIndex];

      const prompt = `
You are NEXUS AI, an AI mentor teaching a step-by-step roadmap.

Overall goal: ${goal}
Full roadmap: ${JSON.stringify(roadmap)}
The learner just finished all previous steps and is now starting this step:
Step ${stepIndex + 1}: "${stepTitle}"

You MUST reply ONLY with valid JSON. No markdown. No \`\`\`json. No explanations.

Return ONLY this structure:

{
  "title": "string",
  "whatYouLearn": "string",
  "whyImportant": "string",
  "whatToDo": ["string", "string", "string"],
  "miniTask": "string"
}

Rules:
- This lesson must teach ONLY step ${stepIndex + 1} ("${stepTitle}").
- whatToDo must be an array of concrete, actionable instructions (real links/commands/tools where relevant).
- Never reference or teach any other step.
- Never return anything except the JSON object.
`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      const lesson = JSON.parse(cleanJson(response.text ?? ""));
      return Response.json({ lesson });
    }

    // ---------------------------------------------------------
    // MODE 3: Answer a question scoped to the current lesson
    // ---------------------------------------------------------
    if (mode === "question") {
      const { lessonTitle, question } = body;

      const prompt = `
You are NEXUS AI, an AI mentor.

You MUST reply ONLY with valid JSON. No markdown. No \`\`\`json. No explanations.

Return ONLY this structure:

{
  "reply": "string"
}

Rules:
- The learner is currently on this lesson: "${lessonTitle}"
- Answer ONLY the learner's question below, in the context of this lesson.
- Do NOT generate a roadmap or a new lesson.
- Keep the reply focused and practical.

Student question: ${question}
`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      const parsed = JSON.parse(cleanJson(response.text ?? ""));
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