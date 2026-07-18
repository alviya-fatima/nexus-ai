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

function parseDataUrl(dataUrl: string): { mimeType: string; data: string } {
  const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!match) {
    return { mimeType: "image/png", data: dataUrl };
  }
  return { mimeType: match[1], data: match[2] };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const mode = body.mode ?? "start";

    // ---------------------------------------------------------
    // MODE 1: Start a new task — generate the full step plan +
    // the first step's detailed content
    // ---------------------------------------------------------
    if (mode === "start") {
      const { taskDescription, userId } = body as {
        taskDescription: string;
        userId?: string;
      };

      let memoryContext = "";
      if (userId) {
        const facts = await getUserProfileFacts(userId, taskDescription);
        if (facts.length > 0) {
          memoryContext = `\n\nHere is what you already know about this learner from previous sessions — use it to personalize your response where relevant, but don't force it in if it's not applicable:\n${facts
            .map((f: string) => `- ${f}`)
            .join("\n")}`;
        }
      }

      const prompt = `
You are NEXUS AI, a friendly, encouraging AI mentor that helps people get ANY task done — big or small — by breaking it into a clear, doable, step-by-step plan.

You MUST reply ONLY with valid JSON. No markdown. No \`\`\`json. No explanations.

Return ONLY this structure:

{
  "goal": "string",
  "steps": ["string", "string", "..."],
  "lesson": {
    "title": "string",
    "whatYouLearn": "string",
    "whyImportant": "string",
    "whatToDo": ["string", "string", "string"]
  }
}

Rules:
- goal = the task, phrased clearly, with 1 emoji.
- steps = the FULL plan needed to finish this task from start to end — use as many steps as the task genuinely needs (could be as few as 3 for a simple task, or 12+ for something complex). Do not pad it out artificially, and do not compress it either.
- Each step must be a genuinely descriptive phrase (aim for 8-14 words) that clearly conveys what happens in that step, not just a short label.
- lesson = the FULL detailed content for step 1 ONLY, and it must be EXTREMELY thorough — this is the person's only guide for this step, so leave nothing vague or assumed.
- Step 1 must be the very first concrete action for this specific task — e.g. "go to linkedin.com and click Join Now", named specifically, with exact URLs/buttons/fields where relevant.
- whatYouLearn: write 3-5 full sentences explaining what this step actually involves.
- whyImportant: write 3-4 full sentences with genuine reasoning for why this step matters and what goes wrong if it's skipped or rushed.
- whatToDo: an array of 4-8 detailed, concrete, actionable steps. Each item MUST be 1-3 full sentences, spelling out exact websites/buttons/fields/menu items/commands and expected results — assume zero prior context.
- Use small, tasteful emojis throughout whatYouLearn, whyImportant, and whatToDo (1-2 per field, not excessive).
- Never teach step 2 or later.
- Never return anything except the JSON object.
${memoryContext}

Task the person wants help with: ${taskDescription}
`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      const parsed = JSON.parse(cleanJson(response.text ?? ""));

      if (userId) {
        void saveMemory(
          userId,
          `User started a new task: "${taskDescription}". NEXUS AI framed the goal as: "${parsed.goal}".`,
          { type: "task_started" }
        );
      }

      return Response.json({ ...parsed, usedMemory: memoryContext.length > 0 });
    }

    // ---------------------------------------------------------
    // MODE 2: Generate the detailed content for a specific step
    // ---------------------------------------------------------
    if (mode === "step") {
      const { goal, steps, stepIndex, userId } = body as {
        goal: string;
        steps: string[];
        stepIndex: number;
        userId?: string;
      };
      const stepTitle = steps[stepIndex];

      const prompt = `
You are NEXUS AI, an AI mentor helping someone complete a task step by step.

Overall goal: ${goal}
Full plan: ${JSON.stringify(steps)}
The person just finished all previous steps and is now starting this step:
Step ${stepIndex + 1}: "${stepTitle}"

You MUST reply ONLY with valid JSON. No markdown. No \`\`\`json. No explanations.

Return ONLY this structure:

{
  "title": "string",
  "whatYouLearn": "string",
  "whyImportant": "string",
  "whatToDo": ["string", "string", "string"]
}

Rules:
- This must cover ONLY step ${stepIndex + 1} ("${stepTitle}"), and it must be EXTREMELY thorough — this is the person's only guide for this step.
- whatYouLearn: write 3-5 full sentences explaining what this step actually involves.
- whyImportant: write 3-4 full sentences with genuine reasoning for why this step matters.
- whatToDo: an array of 4-8 detailed, concrete, actionable steps. Each item MUST be 1-3 full sentences, spelling out exact websites/buttons/fields/menu items/commands and expected results.
- Use small, tasteful emojis throughout whatYouLearn, whyImportant, and whatToDo (1-2 per field, not excessive).
- Never reference or teach any other step.
- Never return anything except the JSON object.
`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      const lesson = JSON.parse(cleanJson(response.text ?? ""));

      if (userId) {
        void saveMemory(
          userId,
          `User completed a step toward the goal "${goal}" and moved on to: "${stepTitle}".`,
          { type: "step_progress" }
        );
      }

      return Response.json({ lesson });
    }

    // ---------------------------------------------------------
    // MODE 3: Answer a question scoped to the current step
    // Supports optional image attachments and reference links
    // ---------------------------------------------------------
    if (mode === "question") {
      const { lessonTitle, question, images, links, userId } = body as {
        lessonTitle: string;
        question: string;
        images?: string[];
        links?: string[];
        userId?: string;
      };

      const linkContext =
        links && links.length > 0
          ? `\n\nThe person also shared these reference link(s) for context (you cannot browse them, but consider what they likely are based on the URL and the question): ${links.join(
              ", "
            )}`
          : "";

      const imageContext =
        images && images.length > 0
          ? `\n\nThe person also attached ${images.length} image(s) — look at them carefully and use them to answer.`
          : "";

      const prompt = `
You are NEXUS AI, an AI mentor.

You MUST reply ONLY with valid JSON. No markdown. No \`\`\`json. No explanations.

Return ONLY this structure:

{
  "reply": "string"
}

Rules:
- The person is currently on this step: "${lessonTitle}"
- Answer ONLY the person's question below, in the context of this step.
- If image(s) are attached, describe/use what you see in them as part of your answer.
- Do NOT generate a new plan or a new step.
- Keep the reply focused, practical, and friendly, with a light touch of emojis (1-2 max).
${linkContext}${imageContext}

Question: ${question}
`;

      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [{ text: prompt }];

      if (images && images.length > 0) {
        for (const img of images) {
          const { mimeType, data } = parseDataUrl(img);
          parts.push({ inlineData: { mimeType, data } });
        }
      }

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts }],
      });

      const parsed = JSON.parse(cleanJson(response.text ?? ""));

      if (userId) {
        void saveMemory(
          userId,
          `Q: ${question}\nA: ${parsed.reply}`,
          { type: "qa", lessonTitle }
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