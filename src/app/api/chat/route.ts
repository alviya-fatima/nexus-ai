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
    const mode = body.mode ?? "roadmap";

    // ---------------------------------------------------------
    // MODE 1: Generate the full roadmap + Step 1 lesson
    // ---------------------------------------------------------
    if (mode === "roadmap") {
      const { message } = body;

      const prompt = `
You are NEXUS AI, a friendly, encouraging AI mentor that builds complete, end-to-end step-by-step learning roadmaps.

You MUST reply ONLY with valid JSON. No markdown. No \`\`\`json. No explanations.

Return ONLY this structure:

{
  "goal": "string",
  "roadmap": ["string", "string", "string", "..."],
  "lesson": {
    "title": "string",
    "whatYouLearn": "string",
    "whyImportant": "string",
    "whatToDo": ["string", "string", "string"]
  }
}

Rules:
- goal = the learning goal, phrased clearly, with 1 emoji.
- roadmap = the FULL journey needed to go from complete beginner to confidently capable in this skill — do not shorten it artificially. Use as many steps as genuinely needed (typically 10-16), covering setup, fundamentals, core concepts, hands-on practice/projects, and advanced/real-world topics, in logical order.
- Each roadmap step must be a genuinely descriptive phrase (aim for 8-14 words), not just a short label — it should clearly convey WHAT the learner will do and WHY it matters at that stage, while still reading as one scannable line (e.g. "Install VS Code and configure the C++ compiler toolchain for your OS" rather than just "Install VS Code").
- lesson = the FULL lesson content for roadmap step 1 ONLY, and it must be EXTREMELY thorough and detailed — this is the learner's only guide for this step, so leave nothing vague or assumed.
- Step 1 must always be the very first practical beginner action for this specific skill — e.g. for a coding skill this usually means installing the right code editor (like VS Code) and any required extension/compiler/SDK, named specifically, with exact download links and clear click-by-click instructions on where to go and what to click.
- whatYouLearn: write 4-6 full sentences giving real depth — explain the concept itself, not just that it exists.
- whyImportant: write 4-5 full sentences with genuine reasoning, real-world context, and what goes wrong if this step is skipped or done poorly.
- whatToDo: an array of 5-8 detailed, concrete, actionable steps. Each item MUST be 2-3 full sentences, spelling out exact tool names, exact download links, exact menu items/buttons/settings to click, exact commands to type, and expected results after each action — assume the learner has zero prior context and cannot infer anything you don't say explicitly.
- Use small, tasteful emojis throughout whatYouLearn, whyImportant, and whatToDo to keep the tone warm and encouraging (1-2 emojis per field, not excessive).
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
  "whatToDo": ["string", "string", "string"]
}

Rules:
- This lesson must teach ONLY step ${stepIndex + 1} ("${stepTitle}"), and it must be EXTREMELY thorough and detailed — this is the learner's only guide for this step, so leave nothing vague or assumed.
- whatYouLearn: write 4-6 full sentences giving real depth — explain the concept itself, not just that it exists.
- whyImportant: write 4-5 full sentences with genuine reasoning, real-world context, and what goes wrong if this step is skipped or done poorly.
- whatToDo: an array of 5-8 detailed, concrete, actionable steps. Each item MUST be 2-3 full sentences, spelling out exact tool names, exact links/commands/buttons/settings, and expected results after each action — assume the learner needs everything spelled out.
- Use small, tasteful emojis throughout whatYouLearn, whyImportant, and whatToDo to keep the tone warm and encouraging (1-2 emojis per field, not excessive).
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
    // Supports optional image attachments and reference links
    // ---------------------------------------------------------
    if (mode === "question") {
      const { lessonTitle, question, images, links } = body as {
        lessonTitle: string;
        question: string;
        images?: string[];
        links?: string[];
      };

      const linkContext =
        links && links.length > 0
          ? `\n\nThe learner also shared these reference link(s) for context (you cannot browse them, but consider what they likely are based on the URL and the question): ${links.join(
              ", "
            )}`
          : "";

      const imageContext =
        images && images.length > 0
          ? `\n\nThe learner also attached ${images.length} image(s) — look at them carefully and use them to answer.`
          : "";

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
- If image(s) are attached, describe/use what you see in them as part of your answer (e.g. spot errors in a screenshot, read on-screen text, confirm setup steps).
- Do NOT generate a roadmap or a new lesson.
- Keep the reply focused, practical, and friendly, with a light touch of emojis (1-2 max).
${linkContext}${imageContext}

Student question: ${question}
`;

      const parts: Array<
        { text: string } | { inlineData: { mimeType: string; data: string } }
      > = [{ text: prompt }];

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